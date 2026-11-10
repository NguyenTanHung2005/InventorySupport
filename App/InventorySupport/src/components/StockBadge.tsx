import { Badge } from './ui';

export function StockBadge({ quantity, minStock }: { quantity: number; minStock: number }) {
  if (quantity <= 0) return <Badge label="Hết hàng" tone="danger" />;
  if (quantity <= minStock) return <Badge label="Sắp hết" tone="warning" />;
  return <Badge label="Ổn định" tone="success" />;
}
