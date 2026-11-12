import { Permission } from '../../common/permissions.js';
import { searchKey } from '../../products/products.service.js';
import { AssistantProduct } from './assistant.types.js';
import { runTool, ToolRunContext } from './assistant-tools.js';

/**
 * Trợ lý chạy không cần AI (docs/AI_ASSISTANT.md mục 7): nhận diện ý định bằng từ khóa
 * tiếng Việt đã bỏ dấu, rồi gọi CÙNG bộ công cụ với Claude để giữ nguyên quyền và định dạng.
 */

export type OfflineIntent = 'movement' | 'low_stock' | 'summary' | 'transactions' | 'product' | 'help';

const STOP_WORDS = new Set(
  'con bao nhieu ton kho gia ban nhap cua la bn may hang san pham co khong the nao vay a oi cho toi xem kiem tra tim mat ma sp ban'.split(' '),
);
const UNITS = 'chai|lon|goi|hop|cai|kg|thung|loc|vi|tui';

export function detectIntent(message: string): { intent: OfflineIntent; key: string } {
  const key = searchKey(message).replace(/[?!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (new RegExp(`\\b(nhap|xuat)\\s+\\d+\\s+`).test(key)) return { intent: 'movement', key };
  if (/sap het|het hang|can nhap|thieu hang|nhap them|duoi muc|canh bao/.test(key)) return { intent: 'low_stock', key };
  if (/tong quan|bao cao|doanh thu|gia tri|thong ke|tinh hinh/.test(key)) return { intent: 'summary', key };
  if (/giao dich|lich su|gan day|vua nhap|vua xuat|hom nay .*(nhap|xuat)/.test(key)) return { intent: 'transactions', key };
  if (/^(xin chao|chao|hello|hi|help|giup|huong dan|ban lam duoc gi)/.test(key)) return { intent: 'help', key };
  return { intent: 'product', key };
}

function parseDays(key: string): number | undefined {
  if (/hom nay/.test(key)) return 1;
  const explicit = /(\d+)\s*ngay/.exec(key);
  if (explicit) return Math.min(365, Math.max(1, Number(explicit[1])));
  if (/tuan/.test(key)) return 7;
  if (/thang/.test(key)) return 30;
  return undefined;
}

function productQuery(key: string): string {
  return key
    .split(' ')
    .filter((word) => word && !STOP_WORDS.has(word))
    .join(' ');
}

function line(product: AssistantProduct): string {
  const status = product.status === 'OUT' ? ' - HẾT HÀNG' : product.status === 'LOW' ? ' - sắp hết' : '';
  return `- ${product.name}: còn ${product.quantity} ${product.unit} (tối thiểu ${product.minStock})${status}`;
}

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(value))} ₫`;

const TYPE_LABEL: Record<string, string> = { IMPORT: 'Nhập', EXPORT: 'Xuất', ADJUSTMENT: 'Kiểm kê' };

/** Trả về câu trả lời; sản phẩm/thẻ đề xuất được ghi vào `ctx`. */
export function answerOffline(message: string, ctx: ToolRunContext): string {
  const { intent, key } = detectIntent(message);
  const call = (name: string, input: Record<string, unknown> = {}) => {
    const result = runTool(name, input, ctx);
    return JSON.parse(result.content) as Record<string, unknown> & { error?: string };
  };

  switch (intent) {
    case 'movement': {
      const match = new RegExp(`\\b(nhap|xuat)\\s+(\\d+)\\s+(?:(?:${UNITS})\\s+)?(.+)$`).exec(key)!;
      const type = match[1] === 'nhap' ? 'IMPORT' : 'EXPORT';
      const quantity = Number(match[2]);
      const query = productQuery(match[3]) || match[3];
      const found = call('search_products', { query, limit: 3 }) as { items?: AssistantProduct[]; error?: string };
      const candidates = found.items ?? [];
      if (!candidates.length) return `Không tìm thấy sản phẩm khớp "${match[3]}". Hãy thử tên khác hoặc quét mã vạch.`;
      if (candidates.length > 1 && searchKey(candidates[0].name) !== query) {
        return `Có ${candidates.length} sản phẩm khớp "${match[3]}":\n${candidates.map(line).join('\n')}\nHãy nói rõ tên sản phẩm bạn muốn ${type === 'IMPORT' ? 'nhập' : 'xuất'}.`;
      }
      const product = candidates[0];
      const result = call('propose_stock_movement', { product_id: product.id, type, quantity, reason: type === 'EXPORT' ? 'Bán lẻ' : undefined });
      if (result.error) return String(result.error);
      return `Mình đã chuẩn bị phiếu ${type === 'IMPORT' ? 'nhập' : 'xuất'} ${quantity} ${product.unit} ${product.name} (hiện còn ${product.quantity}). Bấm "Xác nhận" để lưu.`;
    }

    case 'low_stock': {
      const result = call('list_low_stock') as { items?: AssistantProduct[]; total?: number };
      const items = result.items ?? [];
      if (!items.length) return 'Tồn kho đang ở mức an toàn, chưa có sản phẩm nào dưới mức tối thiểu.';
      return `Có ${result.total} sản phẩm cần chú ý:\n${items.map(line).join('\n')}`;
    }

    case 'summary': {
      if (!ctx.can(Permission.REPORT_VIEW)) return 'Tài khoản của bạn chưa có quyền xem báo cáo tổng hợp.';
      const days = parseDays(key);
      const s = call('get_inventory_summary', { days }) as Record<string, number> & { topExported?: { productName: string; exported: number }[] };
      const period = days === 1 ? 'hôm nay' : days ? `${days} ngày qua` : 'từ trước đến nay';
      const top = s.topExported?.length
        ? `\nXuất nhiều nhất: ${s.topExported.slice(0, 3).map((item) => `${item.productName} (${item.exported})`).join(', ')}.`
        : '';
      return (
        `Tổng quan ${period}:\n` +
        `- ${s.productCount} sản phẩm, tổng tồn ${s.totalQuantity}\n` +
        `- Đã nhập ${s.importedQuantity}, đã xuất ${s.exportedQuantity}, ${s.adjustmentCount} lần kiểm kê\n` +
        `- Doanh thu ước tính: ${money(s.exportRevenue)}\n` +
        `- Giá trị tồn kho (giá nhập): ${money(s.stockValue)}\n` +
        `- ${s.lowStockCount} sắp hết, ${s.outOfStockCount} hết hàng${top}`
      );
    }

    case 'transactions': {
      const days = parseDays(key) ?? (/hom nay/.test(key) ? 1 : undefined);
      const type = /xuat/.test(key) ? 'EXPORT' : /nhap/.test(key) ? 'IMPORT' : undefined;
      const result = call('list_transactions', { days, type, limit: 5 }) as {
        items?: { product: string; type: string; quantity: number; after: number; by: string }[];
        total?: number;
      };
      const items = result.items ?? [];
      if (!items.length) return 'Chưa có giao dịch nào phù hợp.';
      return `${result.total} giao dịch, mới nhất:\n${items
        .map((item) => `- ${TYPE_LABEL[item.type]} ${Math.abs(item.quantity)} ${item.product} (còn ${item.after}) - ${item.by}`)
        .join('\n')}`;
    }

    case 'product': {
      const query = productQuery(key);
      if (query) {
        const result = call('search_products', { query, limit: 5 }) as { items?: AssistantProduct[] };
        const items = result.items ?? [];
        if (items.length) {
          const priced = /gia/.test(key);
          return items
            .map((product) => (priced ? `${line(product)}, giá bán ${money(product.price)}` : line(product)))
            .join('\n');
        }
      }
      return HELP;
    }

    default:
      return HELP;
  }
}

const HELP =
  'Mình là trợ lý kho (chế độ offline). Bạn có thể hỏi:\n' +
  '- "Hàng nào sắp hết?"\n' +
  '- "Coca còn bao nhiêu?" / "Giá sữa Vinamilk"\n' +
  '- "Tổng quan 7 ngày"\n' +
  '- "Giao dịch hôm nay"\n' +
  '- "Xuất 3 chai coca" hoặc "Nhập 10 mì hảo hảo" (tạo phiếu để bạn xác nhận)';
