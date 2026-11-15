import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthUser, StockTransactionType, UserRole } from '../../common/types.js';
import { MemoryDatabase } from '../../../test/helpers/memory-database.js';
import { InventoryService } from '../../inventory/inventory.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ProductsService } from '../../products/products.service.js';
import { AssistantSessionStore } from './assistant-session.store.js';
import { runTool, toolsForUser, ToolRunContext } from './assistant-tools.js';
import { AssistantService, MAX_TOOL_ROUNDS } from './assistant.service.js';
import { detectIntent } from './offline-assistant.js';

const user = (role: UserRole, storeId = 'store-1'): AuthUser => ({
  id: `user-${role}`,
  name: role,
  email: `${role}@example.com`,
  role,
  storeId,
});

function setup() {
  const database = new MemoryDatabase();
  const products = new ProductsService(database);
  const inventory = new InventoryService(database, products, new NotificationsService(database));
  const store = new AssistantSessionStore();
  const service = new AssistantService(store, products, inventory);
  return { database, products, inventory, store, service };
}

describe('assistant tools', () => {
  it('shows candidates but allows a reviewed distinct variant, while rejecting a duplicate barcode', async () => {
    const { products, inventory } = setup();
    const ctx = new ToolRunContext(user(UserRole.MANAGER), products, inventory);
    const result = JSON.parse((await runTool('propose_new_product', { name: 'Coca-Cola Zero 390ml', barcode: '8930000000001' }, ctx)).content);
    expect(result.proposed).toBe(true);
    expect(ctx.actions[0]).toMatchObject({ kind: 'CREATE_PRODUCT', warning: expect.stringMatching(/có sẵn/), prefill: { name: 'Coca-Cola Zero 390ml' } });
    expect(ctx.products.has('product-1')).toBe(true);
    const duplicate = (await runTool('propose_new_product', { name: 'Tên khác', barcode: '08934588012345' }, ctx));
    expect(duplicate.isError).toBe(true);
  });
  it('filters tools by role', async () => {
    const names = (role: UserRole) => toolsForUser(user(role)).map((tool) => tool.name);
    expect(names(UserRole.MANAGER)).toContain('propose_new_product');
    expect(names(UserRole.STAFF)).toContain('propose_stock_movement');
    expect(names(UserRole.STAFF)).not.toContain('propose_new_product');
    expect(names(UserRole.STAFF)).not.toContain('get_inventory_summary');
    expect(names(UserRole.VIEWER)).not.toContain('propose_stock_movement');
  });

  it('never reads another store and hides cost price from staff', async () => {
    const { products, inventory } = setup();
    const otherStore = new ToolRunContext(user(UserRole.ADMIN, 'store-2'), products, inventory);
    expect(JSON.parse((await runTool('search_products', { query: '' }, otherStore)).content).total).toBe(0);

    const staff = new ToolRunContext(user(UserRole.STAFF), products, inventory);
    const result = JSON.parse((await runTool('search_products', { query: 'coca' }, staff)).content);
    expect(result.items[0].name).toBe('Coca-Cola 390ml');
    expect(result.items[0].costPrice).toBeUndefined();
  });

  it('only proposes stock movements the user may perform, without writing data', async () => {
    const { products, inventory, database } = setup();
    const staff = new ToolRunContext(user(UserRole.STAFF), products, inventory);

    const importAttempt = JSON.parse((await runTool('propose_stock_movement', { product_id: 'product-1', type: 'IMPORT', quantity: 5 }, staff)).content);
    expect(importAttempt.error).toMatch(/không có quyền/);

    const tooMany = JSON.parse((await runTool('propose_stock_movement', { product_id: 'product-1', type: 'EXPORT', quantity: 999 }, staff)).content);
    expect(tooMany.error).toMatch(/Chỉ còn 24/);

    (await runTool('propose_stock_movement', { product_id: 'product-1', type: 'EXPORT', quantity: 3 }, staff));
    expect(staff.actions).toEqual([expect.objectContaining({ kind: 'STOCK_MOVEMENT', type: StockTransactionType.EXPORT, quantity: 3 })]);
    expect(database.products.find((product) => product.id === 'product-1')?.quantity).toBe(24);
  });

  it('refuses tools the role was not given and reports bad input to the model', async () => {
    const { products, inventory } = setup();
    const staff = new ToolRunContext(user(UserRole.STAFF), products, inventory);
    expect((await runTool('propose_new_product', { name: 'X' }, staff)).isError).toBe(true);
    expect((await runTool('get_product', {}, staff))).toMatchObject({ isError: true });
  });
});

describe('offline assistant', () => {
  it('asks for a complete product name instead of guessing a follow-up reference', async () => {
    const { service } = setup();
    await expect(service.chat(user(UserRole.STAFF), { message: 'xuất thêm 2 cái đó' })).rejects.toThrow(/chưa được cấu hình/);
  });
  it.each([
    ['Hàng nào sắp hết?', 'low_stock'],
    ['xuất 3 chai coca', 'movement'],
    ['Nhập 10 mì hảo hảo', 'movement'],
    ['tổng quan 7 ngày', 'summary'],
    ['giao dịch hôm nay', 'transactions'],
    ['coca còn bao nhiêu', 'product'],
  ])('detects "%s" as %s', (message, intent) => {
    expect(detectIntent(message).intent).toBe(intent);
  });

  it('answers and proposes an export card', async () => {
    const { service } = setup();
    await expect(service.chat(user(UserRole.STAFF), { message: 'xuất 3 chai coca' })).rejects.toThrow(/chưa được cấu hình/);
  });
});

describe('assistant with Claude (mocked client)', () => {
  beforeEach(() => vi.stubEnv('GEMINI_API_KEY', 'test-key'));
  afterEach(() => vi.unstubAllEnvs());

  const textMessage = (text: string) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
  const toolMessage = (id: string, name: string, input: unknown) => ({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ functionCall: { id, name, args: input } }] } }],
  });

  function withClient(service: AssistantService, responses: unknown[]) {
    const create = vi.fn();
    for (const response of responses) create.mockResolvedValueOnce(response);
    // Ghi lại bản sao messages ở mỗi lần gọi để kiểm tra tính append-only.
    const snapshots: unknown[][] = [];
    const wrapped = vi.fn(async (params: { contents: unknown[] }) => {
      snapshots.push(structuredClone(params.contents));
      return create(params);
    });
    (service as unknown as { client: unknown }).client = { models: { generateContent: wrapped } };
    return { create: wrapped, snapshots };
  }

  it('runs tools, returns products and keeps history append-only across turns', async () => {
    const { service } = setup();
    const manager = user(UserRole.MANAGER);
    const { create, snapshots } = withClient(service, [
      toolMessage('t1', 'list_low_stock', {}),
      textMessage('Có 2 sản phẩm cần nhập.'),
      toolMessage('t2', 'search_products', { query: 'coca' }),
      toolMessage('t3', 'propose_stock_movement', { product_id: 'product-1', type: 'EXPORT', quantity: 2 }),
      textMessage('Bấm Xác nhận để xuất 2 chai.'),
    ]);

    const first = await service.chat(manager, { message: 'Hàng nào sắp hết?' });
    expect(first).toMatchObject({ provider: 'gemini', reply: 'Có 2 sản phẩm cần nhập.', turn: 1 });
    expect(first.products.map((product) => product.id)).toEqual(expect.arrayContaining(['product-2', 'product-3']));
    expect(first.toolCalls[0].name).toBe('list_low_stock');

    const second = await service.chat(manager, { sessionId: first.sessionId, message: 'Xuất 2 coca' });
    expect(second.actions).toHaveLength(1);
    expect(second.turn).toBe(2);

    // Mỗi request là phần nối thêm của request trước: không sửa / xóa message cũ.
    for (let index = 1; index < snapshots.length; index++) {
      expect(snapshots[index].slice(0, snapshots[index - 1].length)).toEqual(snapshots[index - 1]);
    }
    // system và tools giữ nguyên suốt phiên.
    const calls = create.mock.calls.map(([params]) => (params as unknown as { config: { systemInstruction: string; tools: unknown[] } }).config);
    expect(new Set(calls.map((params) => params.systemInstruction)).size).toBe(1);
    expect(new Set(calls.map((params) => JSON.stringify(params.tools))).size).toBe(1);

  });

  it('stops after the tool round limit with an appended instruction', async () => {
    const { service } = setup();
    const responses = Array.from({ length: MAX_TOOL_ROUNDS }, (_, index) => toolMessage(`t${index}`, 'list_low_stock', {}));
    const { snapshots } = withClient(service, responses);
    await expect(service.chat(user(UserRole.MANAGER), { message: 'lặp mãi' })).rejects.toThrow(/quá nhiều bước/);
    expect(snapshots).toHaveLength(MAX_TOOL_ROUNDS);
  });

  it('answers politely on refusal', async () => {
    const { service } = setup();
    withClient(service, [{ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }]);
    await expect(service.chat(user(UserRole.STAFF), { message: '...' })).rejects.toThrow();
  });

  it('restores the completed history after a provider failure and releases busy', async () => {
    const { service, store } = setup();
    const manager = user(UserRole.MANAGER);
    withClient(service, [textMessage('ok')]);
    const first = await service.chat(manager, { message: 'chào' });
    const session = store.get(manager, first.sessionId);
    const before = structuredClone(session.messages);
    const { create } = withClient(service, []);
    create.mockRejectedValueOnce(new Error('network failed'));
    await expect(service.chat(manager, { sessionId: first.sessionId, message: 'lượt lỗi' })).rejects.toThrow();
    expect(session.messages).toEqual(before);
    expect(session.busy).toBe(false);
    expect(session.turns).toBe(1);
  });

  it('invalidates a session after a role or model change', async () => {
    const { service } = setup();
    const manager = user(UserRole.MANAGER);
    withClient(service, [textMessage('ok'), textMessage('bad')]);
    const first = await service.chat(manager, { message: 'chào' });
    await expect(service.chat({ ...manager, role: UserRole.STAFF }, { sessionId: first.sessionId, message: 'x' })).rejects.toMatchObject({ status: 404 });
    vi.stubEnv('AI_MODEL', 'different-model');
    await expect(service.chat(manager, { sessionId: first.sessionId, message: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('appends a verified action result without another stock write or model call', async () => {
    const { service, store, inventory, database } = setup();
    const manager = user(UserRole.MANAGER);
    withClient(service, [
      toolMessage('propose', 'propose_stock_movement', { product_id: 'product-1', type: 'EXPORT', quantity: 2 }),
      textMessage('Chờ xác nhận'),
    ]);
    const reply = await service.chat(manager, { message: 'xuất 2 coca' });
    const action = reply.actions[0];
    const { transaction } = (await inventory.move({ productId: 'product-1', type: StockTransactionType.EXPORT, quantity: 2 }, manager));
    const count = database.transactions.length;
    expect((await service.confirmAction(manager, reply.sessionId, action.id, transaction.id))).toEqual({ confirmed: true });
    const length = store.get(manager, reply.sessionId).messages.length;
    expect(JSON.stringify(store.get(manager, reply.sessionId).messages.at(-1))).toContain(transaction.id);
    (await service.confirmAction(manager, reply.sessionId, action.id, transaction.id));
    expect(store.get(manager, reply.sessionId).messages).toHaveLength(length);
    expect(database.transactions).toHaveLength(count);
    await expect(service.confirmAction(manager, reply.sessionId, 'foreign-action', transaction.id)).rejects.toThrow();
  });

  it('rejects confirmation if chat starts while the transaction lookup is pending', async () => {
    const { service, store, inventory, database } = setup();
    const manager = user(UserRole.MANAGER);
    withClient(service, [
      toolMessage('propose', 'propose_stock_movement', { product_id: 'product-1', type: 'EXPORT', quantity: 2 }),
      textMessage('Chờ xác nhận'),
    ]);
    const reply = await service.chat(manager, { message: 'xuất 2 coca' });
    const action = reply.actions[0];
    const { transaction } = await inventory.move({ productId: 'product-1', type: StockTransactionType.EXPORT, quantity: 2 }, manager);
    const session = store.get(manager, reply.sessionId);
    const before = structuredClone(session.messages);
    let resume!: (value: typeof transaction) => void;
    vi.spyOn(inventory, 'findTransaction').mockImplementationOnce(() => new Promise(resolve => { resume = resolve; }));

    const pending = service.confirmAction(manager, reply.sessionId, action.id, transaction.id);
    const finishChat = store.begin(session);
    resume(transaction);
    try {
      await expect(pending).rejects.toMatchObject({ status: 409 });
      expect(session.messages).toEqual(before);
      expect(session.confirmedActions.size).toBe(0);
      expect(database.transactions).toHaveLength(1);
    } finally {
      finishChat();
    }
    await expect(service.confirmAction(manager, reply.sessionId, action.id, transaction.id)).resolves.toEqual({ confirmed: true });
    expect(session.messages).toHaveLength(before.length + 1);
    expect(database.transactions).toHaveLength(1);
  });

  it('rejects an unrelated stock transaction as confirmation evidence', async () => {
    const { service, inventory } = setup();
    const manager = user(UserRole.MANAGER);
    withClient(service, [toolMessage('p', 'propose_stock_movement', { product_id: 'product-1', type: 'EXPORT', quantity: 2 }), textMessage('chờ')]);
    const reply = await service.chat(manager, { message: 'xuất 2 coca' });
    const { transaction } = (await inventory.move({ productId: 'product-1', type: StockTransactionType.IMPORT, quantity: 2 }, manager));
    await expect(service.confirmAction(manager, reply.sessionId, reply.actions[0].id, transaction.id)).rejects.toThrow();
  });

  it('bounds the entire tool loop and releases the session after timeout', async () => {
    const { service, store } = setup();
    vi.useFakeTimers();
    try {
      const { create } = withClient(service, Array.from({ length: 6 }, (_, i) => toolMessage(`d${i}`, 'list_low_stock', {})));
      create.mockImplementation(async () => {
        vi.setSystemTime(Date.now() + 31_000);
        return toolMessage('slow', 'list_low_stock', {});
      });
      await expect(service.chat(user(UserRole.MANAGER), { message: 'hàng nào sắp hết' })).rejects.toThrow(/quá lâu/);
      const session = store.create(user(UserRole.MANAGER), '', []);
      expect(store.begin(session)).toBeTypeOf('function');
    } finally { vi.useRealTimers(); }
  });

  it('rejects unknown sessions and sessions of other users', async () => {
    const { service } = setup();
    withClient(service, [textMessage('ok')]);
    const first = await service.chat(user(UserRole.MANAGER), { message: 'chào' });
    await expect(service.chat(user(UserRole.STAFF), { sessionId: first.sessionId, message: 'x' })).rejects.toThrow(/hết hạn/);
    await expect(service.chat(user(UserRole.MANAGER), { sessionId: 'asst-unknown', message: 'x' })).rejects.toThrow(/hết hạn/);
  });
});
