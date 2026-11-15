# Sản phẩm thực đã tích hợp

Bộ này gồm60 sản phẩm và60 ảnh lấy từ Open Food Facts. `catalog.json` chỉ giữ trường sản phẩm của project; `sources.json` và `ATTRIBUTION.md` lưu nguồn/giấy phép riêng, không đưa metadata nguồn vào document Product.

Giá VND, costPrice, unit, minStock và supplier được bổ sung theo yêu cầu để mô phỏng: giá không phải giá thị trường đã xác minh, đơn vị là ước lượng theo nhóm/quy cách, nhà cung cấp ghi rõ mô phỏng. Kiểm tra và chỉnh lại trước khi dùng kinh doanh.

Ảnh gốc đóng gói trong `images/`. Khi nhập, script gọi POST /uploads/image để server tự lưu ảnh vào UPLOAD_DIR đang sử dụng và cấp URL đúng. Không dùng URL ảnh nguồn làm ảnh runtime; không cần copy sang frontend.

Tại gốc repo:

```powershell
# Chuẩn bị lại catalog và ảnh từ dữ liệu cào; sẽ tạo lại các giá trị demo
node ScrawlData/prepare-backend.mjs
# Backend phải đang chạy. Mặc định dùng tài khoản demo ADMIN trên localhost:3000.
node ScrawlData/apply-backend.mjs
```

Có thể đặt IMPORT_API_URL (chỉ backend loopback local), IMPORT_EMAIL, IMPORT_PASSWORD trong terminal để dùng cấu hình riêng. Không gửi secret qua chat hoặc commit. Script chỉ tạo sản phẩm barcode chưa có, bỏ qua barcode đã tồn tại; không cập nhật giá/đơn vị/tồn của sản phẩm đã có và không xóa dữ liệu nào.

Mỗi sản phẩm được tạo qua service/API chuẩn với tồn0. Muốn có tồn, nhập kho theo nghiệp vụ. Lịch sử một tháng của bộ mẫu cũ không được gắn giả sang sản phẩm thực. Các request là từng sản phẩm độc lập; nếu lỗi giữa chừng, xem report trong ScrawlData/data/import-*.json rồi chạy lại, không xóa database. Ảnh đã upload nhưng tạo sản phẩm lỗi có thể còn file chưa tham chiếu.

Kết quả lần tích hợp15/11/2026: tạo60 sản phẩm, kiểm chứng đủ60 giá/đơn vị và60 URL ảnh HTTP thành công; tổng danh sách120 sản phẩm vì giữ60 mẫu cũ. Chạy lại tạo0, bỏ qua60. User/tồn kho/lịch sử cũ không bị thay thế.
