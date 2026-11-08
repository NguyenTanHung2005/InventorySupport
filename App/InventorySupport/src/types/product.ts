export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
  price: number;
}

export type StockType = 'IMPORT' | 'EXPORT';
