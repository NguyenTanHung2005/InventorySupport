# UC07 — Quét barcode, nhập số thực đếm và hoàn tất phiên kiểm kê

Ngày16/11/2026. Trạng thái: người dùng đã chọn phương án nghiệp vụ; bản thiết kế chi tiết này chờ duyệt. Chưa triển khai mã chức năng phiên kiểm kê.

## 1. Yêu cầu đã chốt với người dùng

- Luồng: Scan → Identify → Count → Save → Continue.
- Quét barcode/QR chỉ nhận diện sản phẩm, không tự cộng1 vào số đếm hoặc tồn.
- Người dùng nhập và xác nhận số lượng thực tế.
- Lưu dòng chỉ lưu số đếm trong phiên; xem lại toàn bộ trước khi hoàn tất và cập nhật tồn.
- STAFF giữ nguyên quyền, không được kiểm kê. ADMIN/MANAGER được thực hiện và hoàn tất; không thêm bước người khác phê duyệt.
- Tìm thay thế theo tên hoặc barcode; không thêm trường SKU độc lập vì sản phẩm hiện chưa có SKU.
- Chưa làm APK; nghiệm thu chính trên điện thoại thật với Expo, backend LAN và MongoDB Atlas hiện có.

Nguồn: NghiepVu.md, docs/AI_ASSISTANT.md và mã scanner/inventory hiện tại. Đây là mở rộng nghiệp vụ, khác luồng ADJUSTMENT trực tiếp hiện có.

## 2. Phương án đã cân nhắc

| Phương án | Ưu/nhược | Quyết định |
| --- | --- | --- |
| Lưu số đếm theo phiên, cập nhật tồn khi hoàn tất | Có thể sửa/tiếp tục, xem chênh lệch trước khi ghi; cần thêm persistence/session | Người dùng chọn |
| Cập nhật tồn sau mỗi sản phẩm | Ít thay đổi backend, nhưng dễ áp dụng nhầm và khó xem lại trước ghi | Không chọn |

Giữ luồng tra cứu, nhập/xuất liên tục và ảnh AI. Thay nhánh Kiểm kê trong BatchScanner bằng lối vào phiên UC07; không xóa chức năng nhập/xuất hay âm thầm đổi semantics API kho cũ. Các màn ADJUSTMENT thủ công/AI hiện tại vẫn giữ, nhưng mọi thay đổi tồn phải tăng stockVersion để phiên phát hiện xung đột.

## 3. Các đề xuất của người thiết kế cần duyệt cùng tài liệu

- Phiên thuộc người tạo: ADMIN/MANAGER chỉ sửa/hoàn tất/hủy phiên của mình trong cùng cửa hàng; không có phân công/cộng tác đồng thời nhiều người.
- Mỗi người có tối đa1 phiên IN_PROGRESS/cửa hàng, có thể mở lại sau tắt app/restart backend.
- Một phiên tối đa200 sản phẩm khác nhau, tương ứng giới hạn batch hiện có. Tiến độ hiển thị số sản phẩm đã đếm và số dòng lệch, không hiển thị phần trăm giả khi chưa chọn danh sách mục tiêu.
- Không bắt buộc đếm toàn cửa hàng. Hoàn tất chỉ áp dụng các dòng đã lưu; sản phẩm chưa đếm giữ nguyên. Chỉ dòng có countedQuantity rõ ràng mới được ghi nhận, chưa nhập khác với nhập0.
- Không khóa bán hàng trong thời gian đếm. Nếu tồn của dòng đã đếm thay đổi, chặn hoàn tất và yêu cầu đối chiếu/đếm lại dòng đó; không tự lấy số cũ ghi đè.

## 4. Luồng màn hình

### 4.1. Mở phiên

ADMIN/MANAGER vào Quét → Kiểm kê → Tiếp tục phiên đang mở hoặc Bắt đầu phiên mới. Server tạo IN_PROGRESS, ghi người tạo/cửa hàng/thời gian. STAFF/VIEWER không thấy lối vào; backend vẫn chặn API bằng STOCK_ADJUST.

### 4.2. Nhận diện và nhập số đếm

1. Chỉ mount camera khi màn đang focus, chế độ kiểm kê active và app foreground. Đang hiện form số đếm/tra API/lưu thì tạm dừng nhận mã.
2. Camera đọc barcode/QR → backend dùng parser resolve hiện có, nhận diện trong cửa hàng và trả thẻ tên/ảnh/barcode/đơn vị/tồn cùng stockVersion.
3. Có thể nhập barcode hoặc tìm tên để chọn sản phẩm, dùng cùng bước Identify. Không dùng AI để tự đếm hàng.
4. Form số đếm ban đầu trống, không điền bằng tồn hệ thống. Nhập nguyên không âm, chấp nhận0; hiển thị đơn vị rõ ràng. Không quy đổi thùng/lốc sang đơn vị tồn tự động.
5. Nếu đã có dòng sản phẩm trong phiên, mở số đếm đã lưu để sửa. Quét lại không cộng dồn, không tạo dòng trùng.
6. Bấm Lưu kết quả → server xác thực phiên/quyền/số đếm/version → lưu dòng và trả progress → form đóng, sẵn sàng quét tiếp. Có nút Bỏ qua chỉ đóng form, không tạo dòng.
7. Không tìm thấy mã: thông báo và cho tìm lại/nhập tay. Không tự tạo sản phẩm trong phiên; việc thêm sản phẩm vẫn qua form nghiệp vụ riêng nếu cần.

Không cho callbacks camera dồn nhiều request; dùng ref khóa ngay lập tức trước await. Response cũ sau đổi phiên/chế độ/reset không được làm hiện lại form. Nút nhập mã tay cũng phải tuân theo trạng thái bận.

### 4.3. Xem lại và hoàn tất

- Danh sách: tên/đơn vị, số tồn đối chiếu, số thực đếm, chênh lệch; cho sửa dòng hoặc bỏ dòng khỏi phiên trước hoàn tất.
- Hoàn tất phiên hiển thị rõ n sản phẩm đã đếm, m dòng lệch, và cảnh báo chỉ áp dụng phần đã đếm.
- Có ít nhất1 dòng; mọi dòng hợp lệ; lý do kiểm kê bắt buộc cho phiên (có thể nhập “Kiểm kê ngày ...” và người dùng xác nhận).
- Server đọc lại tồn/version/đơn vị/trạng thái sản phẩm. Có xung đột thì trả409 kèm danh sách dòng; không áp dụng bất kỳ thay đổi nào.
- Khi thành công: ghi các ADJUSTMENT có chênh lệch, lưu dòng khớp như bằng chứng đã đếm trong phiên, chuyển COMPLETED trong cùng transaction. Không ghi transaction quantity0 chỉ để tạo lịch sử giả.
- COMPLETED/CANCELLED chỉ xem. Hủy IN_PROGRESS không đổi tồn. Retry hoàn tất phiên COMPLETED trả kết quả hoàn tất đã lưu, không ghi kho lần nữa.

## 5. Tồn thay đổi và số đếm cũ

Thêm `stockVersion` nội bộ vào products, mặc định0 cho dữ liệu cũ. Mọi thao tác IMPORT/EXPORT/ADJUSTMENT thành công tăng version bằng $inc trong cùng transaction, kể cả điều chỉnh không đổi số lượng. Chốt số đếm khớp tồn cũng tăng version để bảo vệ kết quả đối chiếu, nhưng không tạo transaction quantity0. Không dùng timestamp làm bằng chứng duy nhất vì nhiều thay đổi có thể cùng millisecond hoặc tồn tăng rồi giảm về giá trị cũ.

Identify trả baselineQuantity/baselineVersion/unit. PUT dòng gửi cả baselineVersion, expectedUnit từ lần Identify, expected item revision (nếu sửa) và số đếm. Backend cũng so expectedUnit với đơn vị hiện tại; đổi đơn vị giữa Identify và Save phải trả409. Backend đối chiếu version hiện tại; nếu đã thay đổi từ khi người dùng nhìn thấy form thì trả409, không tự chấp nhận số đếm cũ. Dòng lưu baselineVersion của lần kiểm tra thành công đó.

Ở review/finalize, so version baseline và version hiện tại cho TẤT CẢ dòng đã đếm, kể cả dòng khớp. Nếu product bị xóa mềm, đổi đơn vị hoặc tồn thay đổi thì chặn và yêu cầu xử lý. Giá/tên đổi nhưng đơn vị và stockVersion giữ nguyên không tự làm đổi số đếm; hiển thị thông tin hiện tại khi đối chiếu.

“Đếm lại” mở product hiện tại và yêu cầu người dùng nhập lại/xác nhận số thực tế; chỉ thao tác xác nhận rõ ràng mới thay baseline. Không có nút refresh âm thầm cập nhật baseline rồi giữ số cũ như đã kiểm chứng.

## 6. Mô hình MongoDB

Thêm2 collection, không đổi ID/timestamps công khai hiện tại.

`stocktake_sessions`:
- `_id`, `storeId`, `createdBy`, `createdByName`, `status` (IN_PROGRESS/COMPLETED/CANCELLED).
- `revision` nguyên tăng sau mỗi sửa dòng/hủy/chốt để tạo shared write contention.
- `reason`, `createdAt`, `updatedAt`, `completedAt?`, `cancelledAt?`.
- `result?`: countedCount, adjustedCount, transactionIds, completedAt dùng trả lại kết quả khi retry finalize.
- Index(storeId,createdBy,updatedAt desc); unique partial(storeId,createdBy) khi status=IN_PROGRESS.

`stocktake_items`:
- `_id`, `storeId`, `sessionId`, `productId`, `productName`, `barcode`, `unit` snapshot.
- `baselineQuantity`, `baselineStockVersion`, `countedQuantity`, `revision`, `countedBy`, `countedAt`, `updatedAt`, `createdAt`.
- Unique(sessionId,productId); index(storeId,sessionId). Chỉ tạo document khi đã nhập số đếm hợp lệ; không dùng0 đại diện chưa đếm.

Products: `stockVersion` nội bộ, default0; mappers không lộ vào API thường nếu không cần, endpoint Identify UC07 trả rõ version riêng. Phải xử lý legacy document thiếu field như0 khi so sánh/ghi lần đầu; không reset version của dữ liệu mới khi seed/import lại.

StockTransaction: thêm `stocktakeSessionId?` để truy vết; không đổi type và cách tính quantity của ADJUSTMENT hiện tại.

## 7. API dự kiến

Tất cả route: JWT + STOCK_ADJUST, storeId từ user, session của người khác xem như404. Không nhận storeId/createdBy từ body.

| API | Hành vi |
| --- | --- |
| POST /stocktakes | Tạo phiên mới; nếu đã có IN_PROGRESS trả409 kèm sessionId thuộc chính user để tiếp tục |
| GET /stocktakes | Danh sách phiên của mình, phân trang/lọc trạng thái |
| GET /stocktakes/:id | Chi tiết/progress/trạng thái/result; đọc dòng phân trang nếu cần |
| POST /stocktakes/:id/identify | Body raw hoặc productId; đọc qua ProductsService/scan parser và trả product + baseline; không ghi dòng hoặc kho |
| PUT /stocktakes/:id/items/:productId | Gửi countedQuantity, baselineStockVersion và expectedRevision (0 nếu dòng mới); tạo/sửa dòng, không ghi tồn |
| DELETE /stocktakes/:id/items/:productId | Bỏ dòng, gửi expectedRevision; phiên phải đang mở |
| POST /stocktakes/:id/complete | reason + expected session revision, đối chiếu toàn bộ và commit; retry completed trả result cũ |
| POST /stocktakes/:id/cancel | Hủy phiên mở theo expected revision; không đổi tồn |

Không thêm endpoint ghi kho chuyên cho camera nếu đã có service kho dùng chung. Không gọi HTTP API kho từ backend. Tách phần áp dụng movement theo database session khỏi wrapper transaction hiện tại để StocktakesService dùng cùng transaction, tránh nested transaction hoặc copy luật quyền/validation.

## 8. Tính nhất quán và đồng thời

- PUT/DELETE dòng, cancel và complete đều phải ghi tăng session.revision trong transaction, kiểm tra owner và status trước ghi. Điều này khiến save-vs-complete/cancel và hai complete cạnh tranh xung đột/retry đúng, thay vì đọc trạng thái cũ rồi sửa document khác.
- Hai device sửa cùng dòng dùng expectedRevision; request cũ trả409 để tải lại, không “last write wins” âm thầm.
- Finalize kiểm session revision, version tất cả dòng, lập movement plan rồi ghi stock/history/alerts và session result cùng session MongoDB. Có lỗi rollback toàn bộ, session vẫn IN_PROGRESS.
- Finalize phải conditional-write theo baseline version trên MỌI product đã đếm. Dòng lệch dùng movement helper tăng stockVersion; dòng khớp dùng $inc stockVersion:1 và cập nhật updatedAt trong cùng transaction, không tạo ADJUSTMENT. Chỉ đọc version của dòng khớp là chưa đủ vì không gây write conflict với IMPORT/EXPORT/đổi đơn vị/xóa mềm cạnh tranh. Với dữ liệu legacy thiếu version, filter coi thiếu tương đương0 và $inc khởi tạo1.
- Hoàn tất lần2 trên COMPLETED trả result cũ trước kiểm stale revision, không tạo movement mới. Cancel trên COMPLETED bị từ chối.
- Push sau commit; lỗi push không làm UI hiểu rằng kho chưa lưu. Trong retry finalized chỉ trả result, không gửi push lại.
- Mất response PUT: app tải lại dòng để đối chiếu số/version trước thử lại. Mất response complete: app GET session, nếu completed dùng result; không gọi ADJUSTMENT riêng.
- Khi khởi động lại backend hoặc app, đọc phiên từ MongoDB. Draft số chưa bấm lưu có thể mất; UI phải nói rõ, không hứa offline persistence.

## 9. File dự kiến

Backend mới:
- `src/stocktakes/stocktakes.module.ts`, `stocktakes.controller.ts`, `stocktakes.service.ts`.
- `src/stocktakes/dto/stocktake.dto.ts` (dùng helper validation hiện tại).
- `src/stocktakes/stocktakes.service.spec.ts`; `test/stocktakes.integration.spec.ts` (replica set).

Backend sửa:
- `src/common/types.ts`: types phiên/dòng và reference giao dịch.
- `src/database/schemas.ts`, `database.service.ts`: schema/index/tables/startup và mapping stockVersion.
- `src/app.module.ts`: import StocktakesModule.
- `src/inventory/inventory.service.ts`: hàm movement trong session dùng chung, tăng version cho mọi writer; giữ HTTP hợp đồng cũ và giới hạn batch.
- `test/helpers/memory-database.ts`, `test/app.e2e-spec.ts`, các specs AI/kho liên quan: cập nhật contract nếu helper đổi.
- `scripts/seed-core.ts`, `connect-demo.ts` và tests: không reset/xóa phiên; script seed database đã có stocktakes cũng phải từ chối seed để tránh tham chiếu orphan.

App mới:
- `src/services/stocktake.service.ts`: API UC07.
- `src/screens/scanner/StocktakeSessionsScreen.tsx`: mở/tiếp tục/xem phiên.
- `src/screens/scanner/StocktakeCountScreen.tsx`: camera/tìm sản phẩm/form số đếm.
- `src/screens/scanner/StocktakeReviewScreen.tsx`: xem/sửa/chốt và conflict.

App sửa:
- `src/screens/scanner/ScannerScreen.tsx`, `BatchScanner.tsx`: lối vào Kiểm kê, giữ nhập/xuất liên tục.
- `src/screens/scanner/BarcodeCamera.tsx`: khóa callback/manual, vòng đời foreground/focus, lỗi camera/quyền theo Expo SDK thực tế.
- `src/navigation/AppNavigator.tsx`, `navigation/types.ts`, `src/types/index.ts`: routes/types.
- Tái sử dụng Card/Field/Button/ProductImage, ProductsService tìm/resolve, confirmAction/notify; không thêm thư viện quét hoặc state framework.
- `docs/SCAN.md`, `NghiepVu.md`, `docs/PROJECT_PROGRESS.md`: mô tả rõ nghiệp vụ phiên mới, sửa các đoạn Claude/đếm+1 cũ.

## 10. Kiểm chứng bắt buộc

1. Scan nhiều callback cùng mã chỉ mở1 form, không cộng đếm; nhận diện barcode variants/QR dùng parser hiện tại.
2. Form trống không lưu;0 lưu được; âm/lẻ/NaN/giới hạn số không hợp lệ bị chặn ở cả app/backend.
3. Save dòng không đổi products.quantity, transactions hoặc notification.
4. Quét lại mở số đã lưu; sửa/bỏ dòng không tạo dòng trùng; vào lại phiên/restart thấy dữ liệu đã lưu.
5. STAFF/VIEWER bị403; session khác owner/store không truy cập được; không giả quyền qua API.
6. Finalize cập nhật đúng dòng lệch, giữ dòng khớp trong hồ sơ, chưa đếm không về0; reason bắt buộc.
7. Tồn tăng rồi giảm về số cũ vẫn phát hiện xung đột nhờ version; legacy thiếu version xử lý được.
8. Save/cancel/complete và hai finalize cạnh tranh được kiểm chứng bằng Mongo replica set; rollback khi lỗi giữa dòng, push sau commit và retry không ghi/gửi lại.
9. Đổi chế độ/background/reset khi request đang chờ không hồi sinh form cũ; mất mạng giữ danh sách đã lưu và cho khôi phục trạng thái thật.
10. Thử camera/quyền/barcode trên điện thoại thật. Emulator và test render không thay thế nghiệm thu quét thật.

## 11. Không thuộc phạm vi

Không thay quyền STAFF, không phân công/phê duyệt nhiều người, không thêm SKU/đa kho/lô/hạn dùng/quy đổi đơn vị, không dùng Gemini đếm hàng, không offline sync hoặc build APK. Không xóa120 sản phẩm và lịch sử đang dùng chỉ để test.

## 12. Kế hoạch tiếp tục

Bản kế hoạch định hướng nằm tại `docs/superpowers/plans/2026-11-16-uc07-stocktake-camera-plan.md`. Cần người dùng duyệt các đề xuất mục3 và toàn thiết kế trước khi lập checklist thực thi bằng writing-plans rồi viết mã. Chưa có schema/API Stocktake trong mã hiện tại.

## 13. Kết quả builder check

Reviewer độc lập đã đọc và yêu cầu bảo vệ ghi cho cả dòng khớp tồn; quy tắc conditional-write/tăng stockVersion đã được bổ sung mục5/8. Ngoài ra không còn câu hỏi nghiệp vụ quan trọng để lập checklist sau khi duyệt. Chỉ review tài liệu, chưa kiểm transaction/camera thật. Các lựa chọn kỹ thuật này là đề xuất của người thiết kế, không suy ra người dùng đã duyệt toàn bộ.
