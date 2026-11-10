const currency = new Intl.NumberFormat('vi-VN');

export function formatMoney(value: number): string {
  return `${currency.format(Math.round(value || 0))} ₫`;
}

export function formatNumber(value: number): string {
  return currency.format(value || 0);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** yyyy-mm-dd theo giờ máy. */
export function toDateInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Đọc số người dùng gõ, chấp nhận "15.000" hoặc "15,000". Trả về undefined nếu rỗng/sai. */
export function parseNumberInput(value: string): number | undefined {
  const cleaned = value.replace(/[.,\s]/g, '');
  if (!cleaned) return undefined;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : undefined;
}
