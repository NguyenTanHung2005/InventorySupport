export class NormalizeProductDto {
  text = '';
  imageUrl?: string;
}

export class ScanImageDto {
  /** Đường dẫn trả về từ POST /uploads/image */
  imageUrl = '';
  /** Ghi chú thêm cho AI (tùy chọn), ví dụ "thùng 24 lon". */
  note?: string;
}
