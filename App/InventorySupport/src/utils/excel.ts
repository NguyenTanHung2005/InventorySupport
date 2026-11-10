import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import { productService } from '../services/product.service';

/**
 * Nhập danh sách sản phẩm từ file Excel/CSV. Cột hỗ trợ (tiếng Anh hoặc tiếng Việt):
 * name/Tên sản phẩm, barcode/Mã barcode, category/Danh mục, unit/Đơn vị, description/Mô tả,
 * price/Giá bán, costPrice/Giá nhập, supplier/Nhà cung cấp, minStock/Tồn tối thiểu.
 */
export async function importProductsFromExcel(token: string): Promise<{ imported: number; failed: string[] } | undefined> {
  const selection = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
    copyToCacheDirectory: true,
  });
  if (selection.canceled) return undefined;

  const file = selection.assets[0];
  const workbook = XLSX.read(await (await fetch(file.uri)).arrayBuffer(), { type: 'array' });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

  const pick = (row: Record<string, unknown>, ...keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && String(value).trim() !== '') return String(value).trim();
    }
    return undefined;
  };
  const toNumber = (value?: string) => (value === undefined ? undefined : Number(value.replace(/[.,\s]/g, '')) || 0);

  let imported = 0;
  const failed: string[] = [];
  for (const [index, row] of rows.entries()) {
    const name = pick(row, 'name', 'ten', 'Tên sản phẩm');
    if (!name) continue;
    try {
      await productService.create(token, {
        name,
        barcode: pick(row, 'barcode', 'Mã barcode'),
        description: pick(row, 'description', 'Mô tả'),
        category: pick(row, 'category', 'Danh mục'),
        unit: pick(row, 'unit', 'Đơn vị'),
        price: toNumber(pick(row, 'price', 'Giá', 'Giá bán')),
        costPrice: toNumber(pick(row, 'costPrice', 'Giá nhập')),
        supplier: pick(row, 'supplier', 'Nhà cung cấp'),
        minStock: toNumber(pick(row, 'minStock', 'Tồn tối thiểu')),
      });
      imported += 1;
    } catch (error) {
      failed.push(`Dòng ${index + 2} (${name}): ${(error as Error).message}`);
    }
  }
  return { imported, failed };
}
