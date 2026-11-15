# Kế hoạch chuyển dữ liệu JSON sang MongoDB Atlas

> Tài liệu đề xuất để xem xét trước khi triển khai; chưa kết nối Atlas, chưa thay đổi dữ liệu hay mã ứng dụng.

**Mục tiêu:** Chuyển dữ liệu hiện có sang MongoDB Atlas, giữ nguyên hợp đồng API và bảo đảm các thao tác kho nhất quán.

**Kiến trúc:** App tiếp tục gọi NestJS; chỉ backend kết nối MongoDB. Thay các thao tác trực tiếp trên mảng bằng truy vấn bất đồng bộ và chuyển tiếp `async/await` qua controller, guard, công cụ AI và các caller. Dùng `@nestjs/mongoose` và `mongoose`, kiểm tra phiên bản tương thích NestJS của repo trước khi cài.

**Nguồn:** `Server/backend/src/common/types.ts`, `database/database.service.ts`, các service nghiệp vụ, `docs/PROJECT_PROGRESS.md`.

## Hiện trạng và phạm vi

`DatabaseService` nạp bốn mảng users, products, transactions, notifications từ `DATA_FILE` hoặc `data/db.json`, sửa trong RAM và ghi lại toàn bộ file. Test có chế độ RAM. Các service auth, users, products, inventory, notifications, JWT guard và AI assistant phụ thuộc trực tiếp hoặc gián tiếp vào dữ liệu này. Không thể chỉ thay nội dung `save()` vì MongoDB là I/O bất đồng bộ và snapshot trong RAM gây mất cập nhật khi nhiều tiến trình chạy.

Ảnh upload đang ở filesystem và lưu đường dẫn trong sản phẩm; Atlas không tự chuyển hoặc lưu ảnh. Phiên AI trong RAM không nằm trong snapshot; duy trì phạm vi hiện tại. Không tự tạo collection stores, suppliers, categories hoặc sessions khi chưa có nghiệp vụ quản lý riêng.

## Đề xuất collection

Giữ `id` chuỗi hiện có làm `_id` MongoDB; chuyển lại thành `id` trong API, không lộ `_id`/`__v`. Giữ `storeId`, `productId`, `createdBy` và `readBy` dạng chuỗi, không đổi ID hoặc hash mật khẩu. Giữ timestamps ISO string ban đầu để hạn chế thay đổi hợp đồng; chuẩn hóa UTC và kiểm tra trước nhập.

| Collection | Trường chính | Ý nghĩa |
| --- | --- | --- |
| `users` | `_id`, `storeId`, `name`, `email`, `role`, `passwordHash`, `active`, `pushTokens`, `createdAt`, `updatedAt` | Người dùng, quyền, token thông báo; không trả hash/token cho client ngoài hợp đồng hiện tại. |
| `products` | `_id`, `storeId`, `barcode`, `name`, `normalizedName`, `description`, `category`, `unit`, `price`, `costPrice`, `supplier`, `minStock`, `quantity`, `imageUrl?`, `createdAt`, `updatedAt`, `deletedAt?` | Sản phẩm và tồn hiện tại; giữ xóa mềm và hành vi mã barcode hiện tại. |
| `transactions` | `_id`, `storeId`, `productId`, `productName`, `type`, `quantity`, `quantityBefore`, `quantityAfter`, `reason?`, `createdBy`, `createdByName`, `createdAt` | Lịch sử nhập/xuất/kiểm kê; tên là snapshot tại thời điểm ghi. |
| `notifications` | `_id`, `storeId`, `type`, `productId`, `title`, `message`, `readBy`, `createdAt` | Thông báo theo cửa hàng, trạng thái đọc theo người dùng. |

Chỉ mục đề xuất: `users.email` unique toàn hệ thống sau chuẩn hóa chữ thường; `products` unique `(storeId, barcode)` (kiểm tra dữ liệu xóa mềm và cách đổi barcode hiện tại trước khi tạo); `transactions` `(storeId, createdAt desc)` và `(storeId, productId, createdAt desc)`; `notifications` `(storeId, createdAt desc)`. `_id` tự unique. Xác minh truy vấn thực tế trước khi thêm chỉ mục khác. Tìm kiếm bỏ dấu và barcode biến thể phải giữ tương đương logic `searchKey`/`numericVariants`, không thay bằng tìm kiếm mặc định MongoDB nếu kết quả khác.

## Điều kiện toàn cục và rủi ro

- Lọc `storeId` ở mọi truy vấn cần phân vùng; giữ nguyên kiểm tra role và không lộ `costPrice` cho STAFF tại các API hiện hành.
- Không seed tài khoản demo vào Atlas tự động; chỉ seed trong môi trường phát triển khi chủ động yêu cầu. Thiếu URI hoặc lỗi kết nối phải báo lỗi, không âm thầm quay về JSON/demo.
- Tồn kho, lịch sử giao dịch và thông báo phát sinh phải ghi trong cùng transaction MongoDB; batch tối đa 200 dòng vẫn tất cả thành công hoặc không dòng nào thành công. Kiểm tra tồn và cập nhật có điều kiện để hai yêu cầu xuất đồng thời không làm tồn âm; retry transaction theo quy tắc driver, không gửi push trong callback có thể retry. Push chỉ sau commit và lỗi push không hoàn tác dữ liệu đã lưu.
- Không ghi đè Atlas từ backup JSON sau khi Atlas đã nhận ghi mới; rollback sau cutover phải dừng ghi và thực hiện quy trình đồng bộ ngược có kiểm chứng, nếu không sẽ mất dữ liệu mới.
- Không thay đổi mã hay xóa file dữ liệu hiện tại khi chưa sao lưu và đối chiếu. Kiểm thử bằng database riêng, không dùng dữ liệu thật.

## Các bước triển khai và kiểm chứng

### 1. Kết nối và mô hình

**File dự kiến:** `Server/backend/package.json`, `src/database/database.module.ts`, `src/database/` (schemas và ánh xạ), `src/app.module.ts`, cấu hình và tài liệu.

- [ ] Chọn Atlas Free cho phát triển nếu đủ giới hạn; tạo cluster, database user quyền tối thiểu và IP access list cho máy chạy backend. Cung cấp URI qua `MONGODB_URI` ở môi trường backend, không commit hoặc đưa vào Expo.
- [ ] Viết test cấu hình thiếu URI/lỗi kết nối và mapping ID/timestamp; xác nhận test lỗi trước khi triển khai.
- [ ] Cấu hình kết nối một lần, đóng kết nối khi dừng app; khai báo schema bốn collection và index. Giữ phân biệt database test và database thật.
- [ ] Chạy test mapping và kết nối integration trên MongoDB test có replica set hỗ trợ transaction.

### 2. Chuyển truy vấn và xác thực

**File dự kiến:** `src/auth/`, `src/users/`, `src/products/`, `src/notifications/`, `src/common/types.ts`, `src/ai/assistant/`, test tương ứng.

- [ ] Bổ sung test cho đăng nhập, email trùng đồng thời, phân quyền/cửa hàng, xóa mềm và tái sử dụng barcode, tìm kiếm tiếng Việt/biến thể barcode, phân trang, đánh dấu thông báo đã đọc; giữ response API hiện tại.
- [ ] Thay đọc/ghi mảng bằng truy vấn MongoDB, lan truyền `async/await` đến tất cả caller, bao gồm JWT guard và AI tools. Chuyển lỗi duplicate key sang lỗi API phù hợp; không tiết lộ hash/token.
- [ ] Chạy test service, guard và API liên quan; so sánh response và trường dữ liệu với hành vi cũ.

### 3. Giao dịch kho

**File dự kiến:** `src/inventory/inventory.service.ts`, `src/notifications/notifications.service.ts`, controller và caller AI assistant, test inventory/assistant/API.

- [ ] Viết test xuất đồng thời vượt tồn, hai lần kiểm kê cạnh tranh, một dòng batch không hợp lệ, lỗi khi ghi lịch sử/thông báo và lỗi push sau commit. Kiểm tra không tồn âm, rollback đủ, không gửi trùng push khi retry.
- [ ] Chuyển `move` và `moveBatch` sang transaction có session; đọc và ghi cùng session, kiểm tra điều kiện tồn tại thời điểm cập nhật; tạo transaction và alert cùng commit. Giữ quyền, thứ tự kết quả và ngữ nghĩa số lượng kiểm kê.
- [ ] Chuyển thống kê và lịch sử sang truy vấn theo cửa hàng, giữ cách tính hiện tại; xác nhận AI confirm chỉ đối chiếu giao dịch đã lưu, không ghi lại.
- [ ] Chạy integration test đồng thời trên replica set và test API/assistant liên quan.

### 4. Chuyển dữ liệu có thể kiểm tra lại

**File dự kiến:** `Server/backend/scripts/migrate-json-to-mongodb.ts`, test script, tài liệu vận hành.

- [ ] Dừng mọi ghi vào JSON, sao lưu file nguồn và ảnh upload; chọn database Atlas đích riêng, trống. Không in URI, mật khẩu, hash hoặc token vào log.
- [ ] Viết test cho JSON sai cấu trúc, ID/email/barcode trùng, tham chiếu sai cửa hàng hoặc sản phẩm, timestamp không hợp lệ và chạy lại sau thất bại. Không bỏ qua bản ghi lỗi.
- [ ] Viết script có chế độ kiểm tra không ghi; xác thực bốn mảng, quan hệ, dữ liệu và index; nhập giữ ID/hash/giá/tồn/lịch sử/xóa mềm. Chỉ nhập vào đích trống; nếu lỗi giữ backup và xóa dữ liệu thử nghiệm theo quy trình có chủ đích trước khi chạy lại.
- [ ] Đối chiếu tổng số từng collection, danh sách ID, quan hệ, tổng tồn theo cửa hàng và mẫu từng trường; xác minh login, lookup barcode, lịch sử, ảnh và quyền trên bản sao trước cutover. Ghi báo cáo số lượng và lỗi, không ghi dữ liệu nhạy cảm.

### 5. Cutover, khôi phục và nghiệm thu

**File dự kiến:** `README.md`, tài liệu migration, test API.

- [ ] Cấu hình backup/restore phù hợp tier và diễn tập khôi phục vào database riêng; xác minh cả file ảnh vì MongoDB không chứa ảnh.
- [ ] Trong thời gian dừng ghi, backup cuối, migrate và đối chiếu, khởi động backend trỏ Atlas, kiểm thử đọc/ghi mẫu được cho phép rồi mở lại sử dụng. Lưu backup JSON nguyên bản.
- [ ] Chạy `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` trong `Server/backend`; kiểm tra luồng app: đăng nhập, tìm/đổi sản phẩm, nhập/xuất/batch, cảnh báo và trợ lý.
- [ ] Nếu cần quay lại sau khi có ghi mới, dừng ghi và đối chiếu/sao lưu Atlas; chỉ khôi phục JSON khi đã có phương án đồng bộ ngược và kiểm chứng, nếu không tiếp tục khắc phục Atlas để tránh mất dữ liệu.

## Quyết định cần chốt trước cutover

1. Có cần giữ dữ liệu JSON hiện tại hay chỉ khởi tạo database mới? Kế hoạch mặc định giữ toàn bộ.
2. Atlas project/cluster, database đích và tài khoản ai quản lý; môi trường test tách khỏi dữ liệu thật thế nào?
3. Ảnh hiện tại cần chuyển sang lưu trữ cloud riêng khi triển khai backend hay tiếp tục filesystem hiện tại? Việc đó không tự xảy ra khi chuyển MongoDB.

## Tài liệu tham khảo

- https://docs.nestjs.com/techniques/mongodb
- https://www.mongodb.com/docs/atlas/connect-to-database-deployment/
- https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- https://www.mongodb.com/docs/manual/core/transactions/
