import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthUser, StockTransactionType, UserRole } from '../../common/types.js';
import { DatabaseService } from '../../database/database.service.js';
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
  const database = new DatabaseService();
  const products = new ProductsService(database);
  const inventory = new InventoryService(database, products, new NotificationsService(database));
  const store = new AssistantSessionStore();
  const service = new AssistantService(store, products, inventory);
  return { database, products, inventory, store, service };
}

describe('assistant tools', () => {
  it('filters tools by role', () => {
    const names = (role: UserRole) => toolsForUser(user(role)).map((tool) => tool.name);
    expect(names(UserRole.MANAGER)).toContain('propose_new_product');
    expect(names(UserRole.STAFF)).toContain('propose_stock_movement');
    expect(names(UserRole.STAFF)).not.toContain('propose_new_product');
    expect(names(UserRole.STAFF)).not.toContain('get_inventory_summary');
    expect(names(UserRole.VIEWER)).not.toContain('propose_stock_movement');
  });

  it('never reads another store and hides cost price from staff', () => {
    const { products, inventory } = setup();
    const otherStore = new ToolRunContext(user(UserRole.ADMIN, 'store-2'), products, inventory);
    expect(JSON.parse(runTool('search_products', { query: '' }, otherStore).content).total).toBe(0);

    const staff = new ToolRunContext(user(UserRole.STAFF), products, inventory);
    const result = JSON.parse(runTool('search_products', { query: 'coca' }, staff).content);
    expect(result.items[0].name).toBe('Coca-Cola 390ml');
    expect(result.items[0].costPrice).toBeUndefined();
  });

  it('only proposes stock movements the user may perform, without writing data', () => {
    const { products, inventory, database } = setup();
    const staff = new ToolRunContext(user(UserRole.STAFF), products, inventory);

    const importAttempt = JSON.parse(runTool('propose_stock_movement', { product_id: 'product-1', type: 'IMPORT', quantity: 5 }, staff).content);
    expect(importAttempt.error).toMatch(/không có quyền/);

    const tooMany = JSON.parse(runTool('propose_stock_movement', { product_id: 'product-1', type: 'EXPORT', quantity: 999 }, staff).content);
    expect(tooMany.error).toMatch(/Chỉ còn 24/);

    runTool('propose_stock_movement', { product_id: 'product-1', type: 'EXPORT', quantity: 3 }, staff);
    expect(staff.actions).toEqual([expect.objectContaining({ kind: 'STOCK_MOVEMENT', type: StockTransactionType.EXPORT, quantity: 3 })]);
    expect(database.products.find((product) => product.id === 'product-1')?.quantity).toBe(24);
  });

  it('refuses tools the role was not given and reports bad input to the model', () => {
    const { products, inventory } = setup();
    const staff = new ToolRunContext(user(UserRole.STAFF), products, inventory);
    expect(runTool('propose_new_product', { name: 'X' }, staff).isError).toBe(true);
    expect(runTool('get_product', {}, staff)).toMatchObject({ isError: true });
  });
});

describe('offline assistant', () => {
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
    const reply = await service.chat(user(UserRole.STAFF), { message: 'xuất 3 chai coca' });
    expect(reply.provider).toBe('offline');
    expect(reply.actions[0]).toMatchObject({ kind: 'STOCK_MOVEMENT', productId: 'product-1', quantity: 3 });
    expect(reply.reply).toContain('Xác nhận');
  });
});

describe('assistant with Claude (mocked client)', () => {
  beforeEach(() => vi.stubEnv('ANTHROPIC_API_KEY', 'test-key'));
  afterEach(() => vi.unstubAllEnvs());

  const textMessage = (text: string) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text }] });
  const toolMessage = (id: string, name: string, input: unknown) => ({
    stop_reason: 'tool_use',
    content: [{ type: 'thinking', thinking: '', signature: `sig-${id}` }, { type: 'tool_use', id, name, input }],
  });

  function withClient(service: AssistantService, responses: unknown[]) {
    const create = vi.fn();
    for (const response of responses) create.mockResolvedValueOnce(response);
    // Ghi lại bản sao messages ở mỗi lần gọi để kiểm tra tính append-only.
    const snapshots: unknown[][] = [];
    const wrapped = vi.fn(async (params: { messages: unknown[] }) => {
      snapshots.push(structuredClone(params.messages));
      return create(params);
    });
    (service as unknown as { client: unknown }).client = { beta: { messages: { create: wrapped } } };
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
    expect(first).toMatchObject({ provider: 'claude', reply: 'Có 2 sản phẩm cần nhập.', turn: 1 });
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
    const calls = create.mock.calls.map(([params]) => params as unknown as { system: string; tools: unknown[]; fallbacks: string });
    expect(new Set(calls.map((params) => params.system)).size).toBe(1);
    expect(new Set(calls.map((params) => JSON.stringify(params.tools))).size).toBe(1);
    expect(calls[0].fallbacks).toBe('default');
  });

  it('stops after the tool round limit with an appended instruction', async () => {
    const { service } = setup();
    const responses = Array.from({ length: MAX_TOOL_ROUNDS }, (_, index) => toolMessage(`t${index}`, 'list_low_stock', {}));
    const { snapshots } = withClient(service, responses);
    const reply = await service.chat(user(UserRole.MANAGER), { message: 'lặp mãi' });
    expect(reply.reply).toMatch(/quá nhiều bước/);
    const last = snapshots.at(-1)!.at(-1) as { content: { type: string; text?: string }[] };
    expect(last.content.some((block) => block.type === 'text' && /giới hạn tra cứu/.test(block.text ?? ''))).toBe(true);
  });

  it('answers politely on refusal', async () => {
    const { service } = setup();
    withClient(service, [{ stop_reason: 'refusal', content: [] }]);
    const reply = await service.chat(user(UserRole.STAFF), { message: '...' });
    expect(reply.reply).toMatch(/không thể hỗ trợ/);
  });

  it('rejects unknown sessions and sessions of other users', async () => {
    const { service } = setup();
    withClient(service, [textMessage('ok')]);
    const first = await service.chat(user(UserRole.MANAGER), { message: 'chào' });
    await expect(service.chat(user(UserRole.STAFF), { sessionId: first.sessionId, message: 'x' })).rejects.toThrow(/hết hạn/);
    await expect(service.chat(user(UserRole.MANAGER), { sessionId: 'asst-unknown', message: 'x' })).rejects.toThrow(/hết hạn/);
  });
});
