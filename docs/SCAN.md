# Tính năng quét: mã vạch / QR và hình ảnh

Tài liệu làm rõ tính năng quét giải quyết nhu cầu gì, hoạt động ra sao và giới hạn ở đâu.
Code ở `App/InventorySupport/src/screens/scanner/` và các endpoint liệt kê ở mục 6.

---

## 1. Nhu cầu thực tế của cửa hàng nhỏ

| # | Tình huống | Khó khăn khi làm tay | Chức năng quét giải quyết |
|---|---|---|---|
| N1 | Khách hỏi giá / còn hàng không | Phải lục danh sách, nhớ tên | **Tra cứu**: quét mã → thấy ngay giá, tồn, nút xuất |
| N2 | Kiểm kê cuối ngày/tuần | Đếm tay, ghi giấy, nhập lại từng món, dễ sai | **Kiểm kê theo phiên**: quét nhận diện, nhập số thực đếm, lưu dòng, xem lại và hoàn tất |
| N3 | Nhận hàng từ nhà cung cấp | Nhập từng dòng phiếu giao hàng | **Quét liên tục - Nhập hàng** hoặc **Đọc phiếu nhập bằng ảnh** |
| N4 | Bán nhiều món cho một khách | Xuất từng món một | **Quét liên tục - Xuất hàng**: quét giỏ hàng rồi xuất một lần |
| N5 | Hàng không có mã vạch (hàng rời, tự đóng gói) | Không quét được, phải gõ tên | **Tem QR do app tạo** dán lên kệ/sản phẩm; **nhận diện bằng ảnh** |
| N6 | Mã vạch chưa có trong hệ thống | Phải tạo sản phẩm thủ công | Quét → "Chưa có" → tạo sản phẩm với mã đã điền sẵn (ảnh AI điền tên, danh mục) |

---

## 2. Quét mã vạch / QR

### 2.1 Định dạng mã được hiểu

Camera (`expo-camera`) đọc EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR. Chuỗi đọc được
gửi nguyên văn lên `GET /products/resolve?raw=...`; **backend** quyết định nó là gì
(`Server/backend/src/products/scan-code.ts`) để mobile và mọi client dùng chung một luật:

| Định dạng | Ví dụ chuỗi quét | Cách xử lý |
|---|---|---|
| `APP_QR` - tem QR của app | `IS:P:SP2602234639` | Lấy barcode sau `IS:P:` |
| `GS1_DIGITAL_LINK` - QR chuẩn GS1 trên bao bì mới | `https://id.gs1.org/01/08934588012345` | Lấy GTIN sau `/01/` |
| `BARCODE` - mã số | `8934588012345` | Dùng trực tiếp |
| `TEXT` - chuỗi khác (QR web, Wi-Fi...) | `https://shop.vn/khuyen-mai` | Tìm như barcode; không thấy thì báo "mã không phải mã sản phẩm" |

Mã số được thử thêm các dạng tương đương (GTIN-14 bỏ số 0 đầu = EAN-13; UPC-A 12 số
= EAN-13 có số 0 đầu), vì cùng một sản phẩm có thể được máy quét trả về các độ dài khác nhau.

### 2.2 Chế độ "Tra cứu" (một mã) - nhu cầu N1, N6

```text
Quét / gõ mã ─► GET /products/resolve ─┬─ tìm thấy ─► thẻ sản phẩm: giá, tồn, [Xuất] [Nhập] [Kiểm kê] [Chi tiết]
                                       └─ chưa có  ─► "Chưa có trong kho" ─► [Tạo sản phẩm với mã này]
```

Camera khóa sau mỗi lần quét (tránh gọi API liên tục), mở lại bằng "Quét mã khác".

### 2.3 Chế độ "Quét liên tục" - nhu cầu N3, N4

Chọn mục đích (chỉ hiện mục đích người dùng có quyền):

| Mục đích | Quyền | Mỗi lần quét | Khi hoàn tất |
|---|---|---|---|
| **Nhập hàng** | Nhập kho | Số lượng nhập +1 | Lưu phiếu nhập cho tất cả món |
| **Xuất hàng** | Xuất kho | Số lượng xuất +1 (không vượt tồn) | Lưu phiếu xuất cho tất cả món |

- Cùng một mã quét lại trong vòng 1,5 giây bị bỏ qua (camera đọc một mã nhiều lần/giây).
  Mỗi lần ghi nhận có rung nhẹ để người dùng biết đã quét được.
- Danh sách cho phép sửa số lượng bằng tay (+ / − / gõ số), xóa dòng.
- Mã chưa có trong kho được liệt kê riêng để xử lý sau, không làm gián đoạn việc quét.
- Hoàn tất gọi `POST /inventory/batch`: backend **kiểm tra toàn bộ trước rồi mới ghi**
  (quyền, sản phẩm tồn tại, xuất không vượt tồn). Một dòng lỗi thì không dòng nào được ghi.
  Mỗi dòng vẫn là một giao dịch riêng trong lịch sử và vẫn kích hoạt cảnh báo tồn thấp.

### 2.4 Kiểm kê theo phiên — UC07

ADMIN/MANAGER vào Quét → Kiểm kê → Bắt đầu hoặc mở lại phiên. Mỗi người có tối đa một phiên đang mở/cửa hàng, tối đa 200 sản phẩm. Quét chỉ nhận diện; nhập số nguyên không âm theo đơn vị tồn, bao gồm 0. Chưa nhập không được lưu. Có thể tìm theo tên hoặc barcode, sửa và bỏ dòng.

Lưu kết quả chỉ lưu vào phiên trên server, không đổi tồn. Quét lại mở số đã lưu để sửa, không cộng dồn. Số chưa bấm lưu có thể mất khi rời màn hình. Xem lại số đếm/chênh lệch và nhập lý do trước khi hoàn tất. Chỉ sản phẩm đã đếm được áp dụng; sản phẩm còn lại giữ nguyên.

Nếu tồn/đơn vị thay đổi hoặc sản phẩm bị xóa, server chặn toàn bộ lần hoàn tất và trả các dòng cần đếm lại/bỏ. Không khóa nhập/xuất. Phiên hoàn tất/hủy chỉ xem; hủy không đổi tồn. Retry hoàn tất trả kết quả cũ, không ghi kho lần hai.

API `/stocktakes`: POST tạo, GET danh sách/chi tiết, POST `/:id/identify`, PUT/DELETE `/:id/items/:productId`, POST `/:id/complete` và `/:id/cancel`. Quyền STOCK_ADJUST và owner/store được kiểm tra ở backend.

### 2.5 Tem QR cho sản phẩm - nhu cầu N5

Màn chi tiết sản phẩm có nút **Tem QR**: backend tạo ảnh QR (`GET /products/:id/label`)
chứa `IS:P:<barcode>` kèm tên và giá. In hoặc chụp màn hình để dán lên kệ. Sản phẩm không có
mã vạch thật vẫn có mã nội bộ `SP...` do hệ thống sinh, nên luôn tạo được tem.

---

## 3. Quét bằng hình ảnh (AI)

Cần cấu hình Gemini trên backend, xem `docs/AI_GEMINI_MIGRATION_REPORT.md`.
Ảnh được nén ở máy (chất lượng 0.6), tải lên `/uploads/image` rồi mới gửi cho AI.

### 3.1 Nhận diện sản phẩm - nhu cầu N5, N6

```text
Chụp bao bì ─► upload ─► POST /ai/scan-image ─► Gemini đọc ảnh (structured output)
   ─► mỗi gợi ý: tên chuẩn, danh mục, đơn vị, mô tả, mã vạch đọc được, độ tin cậy
   ─► backend đối chiếu: ưu tiên barcode; nếu so tên thì loại ứng viên khác quy cách rõ ràng, vẫn cần người dùng kiểm tra
   ─► mobile: [Mở sản phẩm khớp] hoặc [Tạo sản phẩm từ gợi ý] (ảnh chụp thành ảnh sản phẩm)
```

Gợi ý ảnh dùng cùng thẻ duyệt với chuẩn hóa văn bản: title, mô tả, danh mục, đơn vị
có thể sửa trước khi mở form. Candidate AI không chứa giá nhập với vai trò thiếu quyền.
AI trả quá 5 sản phẩm thì yêu cầu chia nhỏ/chụp ít món hơn, không cắt mất phần dư.

Khi duyệt phiếu nhập, chỉ chọn sẵn một ứng viên duy nhất có đơn vị khớp rõ ràng. Có nhiều
ứng viên, đơn vị khác hoặc thiếu đơn vị thì người dùng phải chọn sản phẩm; hoàn tác bỏ qua
cũng áp dụng cùng quy tắc. Không tự coi ứng viên đứng đầu là đúng SKU.

Dùng khi: hàng không có mã vạch, mã mờ/rách, hoặc tạo nhanh sản phẩm mới.

### 3.2 Đọc phiếu nhập / hóa đơn - nhu cầu N3

```text
Chụp phiếu giao hàng ─► upload ─► POST /ai/scan-invoice ─► Gemini trích từng dòng:
   tên hàng, số lượng, đơn vị, đơn giá, mã vạch (nếu in trên phiếu), nhà cung cấp, ngày
   ─► backend đối chiếu từng dòng với sản phẩm trong kho
   ─► mobile hiện bảng duyệt: dòng khớp (sửa SL được) / dòng chưa khớp (chọn sản phẩm hoặc bỏ)
   ─► [Nhập kho N dòng] ─► POST /inventory/batch (type IMPORT)
```

Quyền: Nhập kho. AI **không tự nhập kho**; người dùng luôn duyệt bảng trước khi lưu.

### 3.3 Giới hạn của AI

- Có thể đọc sai chữ viết tay, ảnh mờ; luôn hiển thị độ tin cậy và yêu cầu người dùng xác nhận.
- Chỉ điền mã vạch khi đọc được đủ dãy số; không đoán.
- Không đếm số lượng hàng trên kệ bằng ảnh (độ chính xác không đủ cho kiểm kê).
- Không có API key: hai chức năng ảnh báo "chưa cấu hình", quét mã vẫn hoạt động đầy đủ.

---

## 4. Phân quyền

| Chức năng | Admin | Quản lý | Nhân viên | Chỉ xem |
|---|:-:|:-:|:-:|:-:|
| Tra cứu mã | ✓ | ✓ | ✓ | ✓ |
| Quét liên tục - Kiểm kê / Nhập hàng | ✓ | ✓ | | |
| Quét liên tục - Xuất hàng | ✓ | ✓ | ✓ | |
| Nhận diện sản phẩm bằng ảnh | ✓ | ✓ | ✓ | |
| Đọc phiếu nhập bằng ảnh | ✓ | ✓ | | |
| Xem / in tem QR | ✓ | ✓ | ✓ | ✓ |

---

## 5. Nền tảng

| | Android / iOS | Web |
|---|---|---|
| Quét bằng camera | ✓ | Tùy trình duyệt; luôn có ô nhập mã tay |
| Rung khi quét | ✓ | Không |
| Chụp ảnh AI | Camera hoặc thư viện | Chọn file |

---

## 6. Endpoint

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/products/resolve?raw=` | Xem sản phẩm | Phân tích chuỗi quét → `{ raw, code, format, product \| null }` |
| GET | `/products/:id/label` | Xem sản phẩm | `{ payload, qrDataUrl, name, barcode, price, unit }` |
| POST | `/inventory/batch` | Theo `type` | `{ type, reason?, items: [{ productId, quantity }] }`, tối đa 200 dòng, tất cả hoặc không |
| POST | `/ai/scan-image` | Dùng AI | Nhận diện sản phẩm |
| POST | `/ai/scan-invoice` | Dùng AI + Nhập kho | Đọc phiếu nhập |
# Lưu ý về tài liệu

Các đoạn nhắc đến Claude bên dưới mô tả phiên bản trước. Xem [báo cáo chuyển đổi Gemini](AI_GEMINI_MIGRATION_REPORT.md) để cấu hình và kiểm thử.

