import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { AuthUser, Product, StockTransactionType } from '../../common/types.js';
import { hasPermission, Permission } from '../../common/permissions.js';
import { InventoryService } from '../../inventory/inventory.service.js';
import { ProductsService } from '../../products/products.service.js';
import { AssistantAction, AssistantProduct, AssistantToolCall } from './assistant.types.js';

/**
 * Bộ công cụ của trợ lý (docs/AI_ASSISTANT.md mục 5).
 * - Chỉ đọc dữ liệu hoặc tạo *đề xuất*; không công cụ nào ghi dữ liệu.
 * - Luôn dùng storeId từ JWT; model không thể chỉ định cửa hàng.
 * - Danh sách công cụ được lọc theo quyền; quyền được kiểm tra lại khi chạy.
 */

export class ToolInputError extends Error {}

/** Trạng thái thu thập trong một lượt hỏi để trả về mobile. */
export class ToolRunContext {
  readonly products = new Map<string, AssistantProduct>();
  readonly actions: AssistantAction[] = [];
  readonly calls: AssistantToolCall[] = [];

  constructor(
    readonly user: AuthUser,
    readonly productsService: ProductsService,
    readonly inventoryService: InventoryService,
  ) {}

  can(permission: Permission) {
    return hasPermission(this.user.role, permission);
  }

  /** Rút gọn sản phẩm; ẩn giá nhập với người không có quyền xem. */
  present(product: Product): AssistantProduct {
    const showCost = this.can(Permission.REPORT_VIEW) || this.can(Permission.PRODUCT_CREATE);
    const summary: AssistantProduct = {
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      category: product.category,
      unit: product.unit,
      quantity: product.quantity,
      minStock: product.minStock,
      price: product.price,
      ...(showCost ? { costPrice: product.costPrice } : {}),
      imageUrl: product.imageUrl,
      status: product.quantity <= 0 ? 'OUT' : product.quantity <= product.minStock ? 'LOW' : 'OK',
    };
    this.products.set(product.id, summary);
    return summary;
  }
}

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Anthropic.Beta.BetaTool.InputSchema;
  /** Cần MỘT trong các quyền này để được cấp công cụ. */
  anyOf: Permission[];
  summary: (input: Record<string, unknown>) => string;
  run: (input: Record<string, unknown>, ctx: ToolRunContext) => unknown;
}

const STOCK_PERMISSION: Record<StockTransactionType, Permission> = {
  [StockTransactionType.IMPORT]: Permission.STOCK_IMPORT,
  [StockTransactionType.EXPORT]: Permission.STOCK_EXPORT,
  [StockTransactionType.ADJUSTMENT]: Permission.STOCK_ADJUST,
};

/* ----------------------------- Đọc & kiểm tra đầu vào ----------------------------- */

/** Chỉ hiển thị giá trị nguyên thủy (dùng cho dòng "Đã tra" trên mobile). */
function label(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function str(input: Record<string, unknown>, key: string, max = 200): string | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new ToolInputError(`${key} phải là chuỗi`);
  return value.trim().slice(0, max) || undefined;
}

function int(input: Record<string, unknown>, key: string, min: number, max: number): number | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ToolInputError(`${key} phải là số nguyên trong khoảng ${min}-${max}`);
  }
  return number;
}

function num(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new ToolInputError(`${key} phải là số không âm`);
  return number;
}

function daysAgo(days?: number): string | undefined {
  if (!days) return undefined;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.toISOString();
}

function findProduct(ctx: ToolRunContext, input: Record<string, unknown>): Product {
  const id = str(input, 'product_id', 100);
  const barcode = str(input, 'barcode', 64);
  if (!id && !barcode) throw new ToolInputError('Cần product_id hoặc barcode');
  try {
    return id ? ctx.productsService.findById(id, ctx.user) : ctx.productsService.findByBarcode(barcode!, ctx.user);
  } catch {
    throw new ToolInputError('Không tìm thấy sản phẩm. Hãy dùng search_products để lấy product_id đúng.');
  }
}

/* --------------------------------- Định nghĩa --------------------------------- */

const TOOLS: ToolDefinition[] = [
  {
    name: 'search_products',
    description:
      'Tìm sản phẩm của cửa hàng theo tên, barcode, danh mục hoặc nhà cung cấp (không phân biệt dấu). Trả về tồn kho, giá bán, trạng thái. Dùng trước khi trả lời bất kỳ câu hỏi nào về một sản phẩm cụ thể.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Từ khóa, ví dụ "coca" hoặc "mi hao hao". Để trống để liệt kê.' },
        category: { type: 'string', description: 'Lọc đúng tên danh mục (tùy chọn)' },
        low_stock_only: { type: 'boolean', description: 'Chỉ lấy hàng sắp hết / hết hàng' },
        limit: { type: 'integer', description: 'Số kết quả tối đa, 1-20, mặc định 10' },
      },
      additionalProperties: false,
    },
    anyOf: [Permission.PRODUCT_VIEW],
    summary: (input) => `Tìm sản phẩm "${label(input.query)}"`,
    run: (input, ctx) => {
      const page = ctx.productsService.list(ctx.user, {
        search: str(input, 'query') ?? '',
        category: str(input, 'category', 80),
        lowStock: input.low_stock_only === true ? 'true' : undefined,
        limit: String(int(input, 'limit', 1, 20) ?? 10),
      });
      return { total: page.total, items: page.items.map((product) => ctx.present(product)) };
    },
  },
  {
    name: 'get_product',
    description: 'Lấy chi tiết một sản phẩm (theo product_id hoặc barcode) kèm 5 giao dịch nhập/xuất gần nhất.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        barcode: { type: 'string' },
      },
      additionalProperties: false,
    },
    anyOf: [Permission.PRODUCT_VIEW],
    summary: () => 'Xem chi tiết sản phẩm',
    run: (input, ctx) => {
      const product = findProduct(ctx, input);
      const history = ctx.inventoryService.transactions(ctx.user, { productId: product.id, limit: '5' });
      return {
        product: { ...ctx.present(product), description: product.description, supplier: product.supplier },
        recentTransactions: history.items.map((item) => ({
          type: item.type,
          quantity: item.quantity,
          after: item.quantityAfter,
          by: item.createdByName,
          at: item.createdAt,
          reason: item.reason,
        })),
      };
    },
  },
  {
    name: 'list_low_stock',
    description: 'Liệt kê sản phẩm đang dưới mức tồn tối thiểu hoặc đã hết hàng, sắp xếp từ ít nhất.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    anyOf: [Permission.PRODUCT_VIEW],
    summary: () => 'Tra hàng sắp hết',
    run: (_input, ctx) => {
      const items = ctx.inventoryService.lowStock(ctx.user);
      return { total: items.length, items: items.slice(0, 20).map((product) => ctx.present(product)) };
    },
  },
  {
    name: 'list_transactions',
    description: 'Lịch sử giao dịch kho (nhập IMPORT, xuất EXPORT, kiểm kê ADJUSTMENT), mới nhất trước.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Lọc theo sản phẩm (tùy chọn)' },
        type: { type: 'string', enum: ['IMPORT', 'EXPORT', 'ADJUSTMENT'] },
        days: { type: 'integer', description: 'Chỉ lấy N ngày gần nhất, 1 = hôm nay' },
        limit: { type: 'integer', description: '1-20, mặc định 10' },
      },
      additionalProperties: false,
    },
    anyOf: [Permission.PRODUCT_VIEW],
    summary: (input) => `Xem lịch sử giao dịch${input.days ? ` ${label(input.days)} ngày` : ''}`,
    run: (input, ctx) => {
      const type = str(input, 'type', 20);
      if (type && !Object.values(StockTransactionType).includes(type as StockTransactionType)) {
        throw new ToolInputError('type không hợp lệ');
      }
      const page = ctx.inventoryService.transactions(ctx.user, {
        productId: str(input, 'product_id', 100),
        type: type as StockTransactionType | undefined,
        from: daysAgo(int(input, 'days', 1, 365)),
        limit: String(int(input, 'limit', 1, 20) ?? 10),
      });
      return {
        total: page.total,
        items: page.items.map((item) => ({
          product: item.productName,
          productId: item.productId,
          type: item.type,
          quantity: item.quantity,
          before: item.quantityBefore,
          after: item.quantityAfter,
          by: item.createdByName,
          at: item.createdAt,
          reason: item.reason,
        })),
      };
    },
  },
  {
    name: 'get_inventory_summary',
    description:
      'Số liệu tổng hợp: số sản phẩm, tổng tồn, giá trị tồn (giá nhập và giá bán), số hàng sắp hết/hết, tổng nhập/xuất, doanh thu ước tính (xuất × giá bán), top sản phẩm xuất nhiều.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Khoảng thời gian cho số liệu nhập/xuất, 1 = hôm nay. Bỏ trống = toàn bộ.' } },
      additionalProperties: false,
    },
    anyOf: [Permission.REPORT_VIEW],
    summary: (input) => `Xem tổng quan${input.days ? ` ${label(input.days)} ngày` : ''}`,
    run: (input, ctx) => ctx.inventoryService.summary(ctx.user, { from: daysAgo(int(input, 'days', 1, 365)) }),
  },
  {
    name: 'propose_stock_movement',
    description:
      'Tạo THẺ ĐỀ XUẤT nhập/xuất/kiểm kê để người dùng bấm xác nhận trên app. KHÔNG ghi dữ liệu. Với ADJUSTMENT, quantity là số lượng thực tế đếm được. Luôn lấy product_id từ search_products trước.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        type: { type: 'string', enum: ['IMPORT', 'EXPORT', 'ADJUSTMENT'] },
        quantity: { type: 'integer', description: 'IMPORT/EXPORT: > 0. ADJUSTMENT: số đếm thực tế >= 0' },
        reason: { type: 'string', description: 'Ghi chú/lý do; bắt buộc với ADJUSTMENT' },
      },
      required: ['product_id', 'type', 'quantity'],
      additionalProperties: false,
    },
    anyOf: [Permission.STOCK_IMPORT, Permission.STOCK_EXPORT, Permission.STOCK_ADJUST],
    summary: (input) => `Đề xuất ${label(input.type)} ${label(input.quantity)}`,
    run: (input, ctx) => {
      const type = str(input, 'type', 20) as StockTransactionType | undefined;
      if (!type || !STOCK_PERMISSION[type]) throw new ToolInputError('type phải là IMPORT, EXPORT hoặc ADJUSTMENT');
      if (!ctx.can(STOCK_PERMISSION[type])) {
        return { error: `Người dùng không có quyền ${type}. Hãy giải thích và không đề xuất thao tác này.` };
      }
      const product = findProduct(ctx, input);
      const isAdjustment = type === StockTransactionType.ADJUSTMENT;
      const quantity = int(input, 'quantity', isAdjustment ? 0 : 1, 1_000_000);
      if (quantity === undefined) throw new ToolInputError('Thiếu quantity');
      const reason = str(input, 'reason', 300);
      if (isAdjustment && !reason) throw new ToolInputError('Kiểm kê cần reason');
      if (type === StockTransactionType.EXPORT && quantity > product.quantity) {
        return { error: `Chỉ còn ${product.quantity} ${product.unit}, không thể đề xuất xuất ${quantity}.`, product: ctx.present(product) };
      }
      const action: AssistantAction = {
        id: `act-${randomUUID()}`,
        kind: 'STOCK_MOVEMENT',
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        type,
        quantity,
        reason,
        currentQuantity: product.quantity,
      };
      ctx.actions.push(action);
      ctx.present(product);
      return { proposed: true, actionId: action.id, note: 'Đã hiển thị thẻ đề xuất; dữ liệu CHỈ thay đổi khi người dùng bấm Xác nhận.' };
    },
  },
  {
    name: 'propose_new_product',
    description:
      'Tạo THẺ ĐỀ XUẤT mở form thêm sản phẩm mới đã điền sẵn để người dùng kiểm tra và lưu. KHÔNG ghi dữ liệu. Chỉ dùng khi đã kiểm tra bằng search_products rằng sản phẩm chưa tồn tại.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tên chuẩn, ví dụ "Coca-Cola 390ml"' },
        category: { type: 'string' },
        unit: { type: 'string' },
        price: { type: 'number', description: 'Giá bán VND' },
        cost_price: { type: 'number', description: 'Giá nhập VND' },
        barcode: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    anyOf: [Permission.PRODUCT_CREATE],
    summary: (input) => `Đề xuất tạo "${label(input.name)}"`,
    run: (input, ctx) => {
      const name = str(input, 'name');
      if (!name) throw new ToolInputError('Thiếu name');
      const action: AssistantAction = {
        id: `act-${randomUUID()}`,
        kind: 'CREATE_PRODUCT',
        prefill: {
          name,
          category: str(input, 'category', 80),
          unit: str(input, 'unit', 30),
          price: num(input, 'price'),
          costPrice: num(input, 'cost_price'),
          barcode: str(input, 'barcode', 64),
          description: str(input, 'description', 1000),
        },
      };
      ctx.actions.push(action);
      return { proposed: true, actionId: action.id };
    },
  },
];

/** Công cụ mà vai trò này được dùng (đóng băng vào phiên khi tạo). */
export function toolsForUser(user: AuthUser): Anthropic.Beta.BetaTool[] {
  return TOOLS.filter((tool) => tool.anyOf.some((permission) => hasPermission(user.role, permission))).map(
    ({ name, description, input_schema }) => ({ name, description, input_schema }),
  );
}

/** Chạy một công cụ; lỗi đầu vào trả về cho model tự sửa, quyền được kiểm tra lại. */
export function runTool(
  name: string,
  input: unknown,
  ctx: ToolRunContext,
): { content: string; isError: boolean } {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool || !tool.anyOf.some((permission) => ctx.can(permission))) {
    return { content: JSON.stringify({ error: `Công cụ ${name} không khả dụng với người dùng này` }), isError: true };
  }
  const args = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  try {
    ctx.calls.push({ name, summary: tool.summary(args) });
    return { content: JSON.stringify(tool.run(args, ctx)), isError: false };
  } catch (error) {
    const message = error instanceof ToolInputError ? error.message : 'Lỗi khi tra cứu dữ liệu';
    return { content: JSON.stringify({ error: message }), isError: true };
  }
}
