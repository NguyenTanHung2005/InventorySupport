export class CreateProductDto {
  /** Để trống thì hệ thống tự sinh mã nội bộ. */
  barcode?: string;
  name = '';
  description?: string;
  category?: string;
  unit?: string;
  price?: number;
  costPrice?: number;
  supplier?: string;
  minStock?: number;
  imageUrl?: string;
}

export class UpdateProductDto {
  barcode?: string;
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
  price?: number;
  costPrice?: number;
  supplier?: string;
  minStock?: number;
  /** Gửi chuỗi rỗng để gỡ ảnh. */
  imageUrl?: string;
}

export interface ProductQuery {
  page?: string;
  limit?: string;
  search?: string;
  category?: string;
  /** `true` để chỉ lấy hàng sắp hết. */
  lowStock?: string;
  sort?: 'name' | 'quantity' | 'updatedAt';
}
