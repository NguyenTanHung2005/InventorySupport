# Dữ liệu mẫu Mini Mart An Nhiên

Bộ fixture nằm ở `Server/backend/fixtures/mini-mart`. Dữ liệu hư cấu, phục vụ demo, không phải doanh thu/sản phẩm thương mại thực.

| Thành phần | Có sẵn |
| --- | --- |
| Sản phẩm | 60, chia 6 nhóm |
| Tài khoản | 6, đủ ADMIN/MANAGER/STAFF/VIEWER |
| Hoạt động | 30 ngày: 16/10–14/11/2026 |
| Giao dịch | 629 IMPORT/EXPORT/ADJUSTMENT |
| Cảnh báo | 15, có đã/chưa đọc |
| Tồn cuối | 3 hết hàng, 5 sắp hết, 52 bình thường |
| Ảnh | 60 PNG 512×512, một ảnh riêng cho mỗi sản phẩm |
| Phiếu nhập | 3 PNG 1200×1300, mỗi phiếu 6 dòng, kèm đáp án JSON |

`catalog.json` chứa thông tin sản phẩm. `dataset.json` chứa đầy đủ bốn mảng để seed. `manifest.json` liệt kê quy mô và mappings ảnh; không chứa key thật. Mật khẩu demo được hash bằng helper scrypt, pushTokens rỗng.

Ảnh được vẽ nguyên gốc bằng `scripts/generate-demo-images.ps1`, không tải/hotlink ảnh bên ngoài. Tên thương hiệu hư cấu và barcode DEMO không phải GTIN được cấp. Ảnh khác nhau qua hình dạng nhóm và nhãn sản phẩm; ảnh minh họa không chứng minh chất lượng AI trên ảnh bao bì thực.

Có thể tạo lại ảnh bằng `npm run images:demo` trên Windows. Dùng ảnh/đáp án trong `invoices/` để đối chiếu OCR; không mặc định AI luôn đọc đúng. Xem hướng dẫn seed, đổi ngày và mạng tại [MONGODB_LOCAL_SETUP.md](MONGODB_LOCAL_SETUP.md).

`check:demo` kiểm số sản phẩm/tài khoản, ID/email/barcode, tham chiếu cửa hàng, quyền người tạo giao dịch, chuỗi tồn và file PNG runtime. Chạy sau seed khi chưa thay đổi bộ mẫu; sau khi xóa user/tạo thêm sản phẩm, một số tiêu chí bộ mẫu có thể không còn phù hợp. Kiểm tra này không thay thế test đồng thời trên MongoDB thật.
