# Báo cáo và hướng dẫn chuyển AI sang Gemini miễn phí

Ngày lập: 14/11/2026.

**Trạng thái: đã chuyển các luồng AI chính sang Gemini và kiểm thử bằng phản hồi giả lập.**
Chưa xác nhận chất lượng hoặc khả năng kết nối với một tài khoản Gemini thực tế.

## 1. Mục tiêu của đồ án

Ứng dụng Inventory Support giúp cửa hàng quản lý sản phẩm và nhập–xuất–kiểm kê.
AI hỗ trợ hiểu văn bản/ảnh và đề xuất thông tin để giảm nhập liệu. Backend vẫn chịu
trách nhiệm về dữ liệu thực tế, quyền và giao dịch.

Đích chuyển đổi là dùng Gemini ở gói miễn phí cho cả bốn chức năng AI. Khi AI lỗi hoặc
hết quota, thông báo rõ, giữ dữ liệu đang nhập và cho thao tác thủ công. Người dùng đã
chọn phương án này thay cho tự chuyển sang bộ luật offline hay model chạy trên máy.

Model dự kiến là `gemini-3.5-flash-lite`. Tài liệu Google hiện liệt kê model này có
free tier, nhận ảnh, gọi hàm và structured output. Khả năng sử dụng thực tế còn tùy
tài khoản/project, hạn mức và tình trạng model tại thời điểm triển khai.
[Bảng giá](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite),
[khả năng model](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite).

## 2. Các khái niệm cần hiểu

| Khái niệm | Vai trò trong đồ án |
|---|---|
| Model | Mô hình nhận chữ/ảnh và sinh câu trả lời hoặc dữ liệu |
| API key | Thông tin backend dùng để gọi Gemini, khác JWT đăng nhập app |
| Prompt | Hướng dẫn tiếng Việt về nhiệm vụ, điều được làm và không được đoán |
| JSON schema | Khuôn kết quả: tên, danh mục, đơn vị, mô tả, dòng hàng… |
| Function calling | Model đề nghị backend gọi một hàm có tên/tham số xác định |
| Tool | Hàm backend cho phép model sử dụng để tra kho hoặc tạo đề xuất |
| Session | Lịch sử trao đổi, công cụ và đề xuất của một user trong một phiên |
| Quota | Giới hạn sử dụng của project; có thể theo phút, token hoặc ngày |

JSON đúng cấu trúc chưa bảo đảm đúng nội dung. `confidence` do model tự đánh giá,
không phải xác suất đã được đo. Nhân viên vẫn cần kiểm tra quy cách, đơn vị và số lượng.

## 3. Thành phần hiện tại và trách nhiệm

| Thành phần | Trách nhiệm |
|---|---|
| React Native / Expo | Nhập chữ, chọn ảnh, hiển thị kết quả, nhận xác nhận |
| API NestJS | Kiểm tra JWT, quyền, dữ liệu, điều phối AI và nghiệp vụ |
| Adapter AI | Gửi prompt/schema/chữ/ảnh; đọc và kiểm tra response |
| ProductsService | Tìm sản phẩm thật trong đúng cửa hàng |
| InventoryService | Kiểm tra và lưu giao dịch kho |
| DatabaseService | Lưu sản phẩm, giao dịch, người dùng, thông báo vào JSON |
| AssistantSessionStore | Giữ lịch sử chat và đề xuất trong RAM |

Hiện adapter là `Server/backend/src/ai/claude-product-vision.ts`, trợ lý gọi Claude
trong `assistant/assistant.service.ts`. Chuyển sang Gemini chủ yếu thay lớp giao tiếp
model và định dạng lịch sử/tool. Luật nghiệp vụ vẫn được xử lý ở backend.

Không cần huấn luyện model riêng hoặc đưa toàn bộ database cho AI. Khi hỏi tồn kho,
backend chỉ trả kết quả tra cứu liên quan trong phạm vi quyền của người dùng.

## 4. Luồng A: chuẩn hóa tên và mô tả sản phẩm

Ví dụ nhập: `nuoc ngot coca chai 390ml; banh oreo goi 133g`.

1. Người dùng gõ ở NormalizePanel hoặc form sản phẩm và bấm phân tích.
2. App gửi `POST /ai/normalize-product` cùng JWT và `{ text }`.
3. Backend xác thực, kiểm tra quyền AI, giới hạn chữ và lấy danh mục cửa hàng.
4. Adapter gửi chữ, danh mục, prompt tiếng Việt và schema kết quả cho Gemini.
5. Model được yêu cầu sửa chính tả, tách sản phẩm, tạo tên/mô tả, gợi ý đơn vị và danh mục.
   Không được tự tạo giá, số lượng nhập, thương hiệu hoặc quy cách thiếu dữ kiện.
6. Backend kiểm tra JSON, trường bắt buộc, tối đa 5 sản phẩm, giới hạn chuỗi và confidence.
   Nếu đầu vào có hơn 5 món, yêu cầu chia nhỏ thay vì âm thầm bỏ bớt.
7. ProductsService đối chiếu tên/barcode để tìm ứng viên trong cửa hàng.
8. App hiển thị từng thẻ; người dùng sửa và chọn mở sản phẩm có sẵn hoặc form tạo mới.
9. Chỉ khi bấm lưu form mới gọi API sản phẩm. Tạo sản phẩm không đồng nghĩa nhập kho;
   tồn ban đầu nếu có được lưu qua giao dịch nhập riêng.

Kết quả minh họa, không phải kết quả đã đo từ Gemini:

```json
{
  "normalizedName": "Nước ngọt Coca-Cola chai 390ml",
  "category": "Đồ uống",
  "unit": "chai",
  "description": "Nước ngọt Coca-Cola đóng chai dung tích 390ml."
}
```

## 5. Luồng B: nhận diện ảnh sản phẩm

1. Người dùng chụp/chọn ảnh trong ImageScanner.
2. App gửi ảnh đến `POST /uploads/image`; backend kiểm tra định dạng, dung lượng và lưu
   theo cửa hàng. Giới hạn hiện tại: 5MB, JPEG/PNG/WEBP.
3. App giữ preview và đường dẫn upload, gửi `POST /ai/scan-image` với `{ imageUrl, note? }`.
4. Backend xác minh đường dẫn thuộc cửa hàng, đọc ảnh, tạo dữ liệu ảnh cho Gemini.
5. Gemini đọc tên/quy cách và barcode nếu nhìn rõ, trả schema sản phẩm như luồng A.
6. Backend kiểm tra rồi đối chiếu kho; app cho chọn/sửa trước khi lưu.

Quét barcode bằng camera/nhập mã và tìm database là luồng độc lập, không cần model.
Ảnh mờ không được biến thành barcode tưởng tượng hoặc sản phẩm được lưu tự động.

Nếu bước 5 bị quota: giữ preview và URL upload; nút Thử lại chỉ gọi AI trên ảnh đó.
Nếu upload chưa thành công, lần thử lại cần upload từ ảnh đã chọn trước khi gọi AI.

## 6. Luồng C: đọc phiếu nhập hàng

1. Người có quyền nhập kho chọn chế độ đọc phiếu và upload ảnh.
2. App gọi `POST /ai/scan-invoice` với URL upload.
3. Backend kiểm tra quyền AI + nhập kho và quyền sở hữu ảnh.
4. Gemini trích nhà cung cấp, ngày và từng dòng: tên, số lượng, đơn vị, đơn giá, barcode,
   confidence; đánh dấu phiếu không đọc được nếu ảnh không phù hợp.
5. Backend kiểm tra kết quả, giới hạn 100 dòng và tìm ứng viên cho từng dòng.
6. App chỉ chọn sẵn khi có duy nhất một ứng viên và đơn vị khớp; nếu chưa rõ thì để
   người dùng chọn. Ví dụ 2 thùng không được tự coi thành 2 chai.
7. Người dùng duyệt/sửa sản phẩm và số lượng rồi bấm xác nhận nhập.
8. App gọi `POST /inventory/batch`; backend kiểm tra toàn bộ batch trước khi lưu.
9. App nhận kết quả giao dịch, cập nhật màn hình và thông báo tồn kho nếu có.
10. Nếu người dùng chọn cập nhật giá nhập, thực hiện riêng sau giao dịch kho; báo rõ
    trường hợp kho đã lưu nhưng cập nhật giá thất bại, tránh nhập lặp.

Gemini chỉ trích phiếu; ProductsService quyết định ứng viên và InventoryService quyết
định giao dịch hợp lệ. Nếu AI lỗi trước khi trích được dòng hàng, người dùng nhập kho
thủ công bằng màn hình hiện có; không giả lập một phiếu đã đọc thành công.

## 7. Luồng D: trợ lý hỏi đáp và đề xuất thao tác kho

### Ví dụ 1: hỏi số tồn

Người dùng: `Coca 390ml còn bao nhiêu?`

1. App gọi `POST /ai/assistant/chat` với message và sessionId nếu có.
2. Backend kiểm tra JWT, quyền, tần suất và lấy phiên của đúng user/cửa hàng/vai trò/model.
3. Backend gửi prompt, lịch sử và danh sách công cụ cho Gemini.
4. Gemini đề nghị `search_products` với từ khóa Coca 390ml.
5. Backend kiểm tra tên hàm/đầu vào/quyền và tìm sản phẩm thật trong database.
6. Backend gửi function response về Gemini; model viết câu trả lời từ số tồn vừa tra.
7. Backend trả reply, products, toolCalls, sessionId và số lượt; app hiển thị.

Nếu có nhiều sản phẩm phù hợp, hỏi người dùng chọn, không tự chọn nhầm.
Một câu hỏi trên app có thể cần nhiều lần gọi model; đó là lý do quota có thể hết
nhanh hơn số tin nhắn nhìn thấy.

### Ví dụ 2: đề xuất xuất kho

Người dùng: `Xuất 3 chai Coca 390ml`.

1. Trợ lý tra sản phẩm và tồn hiện tại qua công cụ.
2. Gemini đề nghị `propose_stock_movement` với sản phẩm, loại EXPORT, số lượng 3.
3. Backend kiểm tra quyền/đơn vị/số lượng và tạo action, chưa thay đổi tồn.
4. App hiển thị thẻ đề xuất. Ví dụ dữ liệu giả lập: tồn 24 → dự kiến 21 chai.
5. Người dùng bấm Xác nhận; app gọi `POST /inventory/movement`.
6. Backend kiểm tra lại tồn/quyền tại thời điểm lưu, không dùng số tồn cũ từ model
   làm nguồn sự thật; lưu giao dịch hoặc từ chối nếu tồn không còn đủ.
7. App dùng `transactionId` gọi endpoint confirm để backend đối chiếu với action.
8. Confirm chỉ cập nhật ngữ cảnh phiên về giao dịch đã có; không gọi Gemini và không
   xuất thêm 3 chai. Khi hỏi tồn tiếp, trợ lý phải tra lại database.

Nếu quota hết sau khi action đã hiển thị, API kho vẫn có thể xử lý xác nhận. Nếu kho
đã lưu nhưng đồng bộ phiên lỗi, app phải nói đã lưu và không hướng dẫn bấm lưu lại.

### Các công cụ hiện có

| Công cụ | Mục đích |
|---|---|
| `search_products` | Tìm sản phẩm |
| `get_product` | Đọc chi tiết sản phẩm |
| `list_low_stock` | Liệt kê hàng sắp hết |
| `list_transactions` | Tra lịch sử kho |
| `get_inventory_summary` | Tổng hợp số liệu kho theo quyền |
| `propose_stock_movement` | Tạo đề xuất nhập/xuất/kiểm kê |
| `propose_new_product` | Tạo đề xuất mở form sản phẩm |

Backend lọc công cụ theo quyền trước khi gửi và kiểm tra lại lúc chạy. Model không
được chọn storeId khác, tự đọc file database hoặc chạy code tùy ý.

## 8. Luồng khi AI bị giới hạn hoặc lỗi

1. Adapter nhận lỗi Gemini, đọc mã lỗi và metadata có cấu trúc.
2. Backend chuyển thành mã lỗi của ứng dụng; không trả chi tiết key/prompt/provider thô.
3. AiService/controller giữ nguyên lỗi đã phân loại, không chuyển thành heuristic hay
   gom lỗi quota thành lỗi chụp ảnh.
4. App hiển thị message, giữ dữ liệu đang làm việc, kết thúc trạng thái loading.
5. Người dùng chọn thử lại hoặc thao tác thủ công. Không tự gửi lại nhiều lần.

| Tình huống | Cách thông báo |
|---|---|
| Xác định hết quota ngày | Chức năng AI đã hết hạn mức sử dụng hôm nay. Bạn vẫn có thể nhập liệu và quản lý kho thủ công. |
| Xác định gọi quá nhanh | AI đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau. |
| 429 chưa đủ thông tin phân loại | AI đang bị giới hạn sử dụng. Vui lòng thử lại sau. |
| Chưa cấu hình | Chức năng AI chưa được cấu hình. Bạn vẫn có thể thao tác thủ công. |
| Key/model/cấu hình không hợp lệ | Chức năng AI đang gặp lỗi cấu hình. Vui lòng liên hệ người quản lý. |
| Provider hoặc kết nối lỗi | Tạm thời không kết nối được AI. Vui lòng thử lại. |

Lỗi key Gemini không phải JWT người dùng hết hạn, nên backend không trả 401 làm app
đăng xuất. Model Google không tồn tại cũng không trả thành lỗi phiên chat 404 để app
tự gửi lại. Lỗi 429 nội bộ do gửi chat quá nhanh cần phân biệt với quota của Google.

Giữ dữ liệu trong phạm vi phiên/màn hình app, chưa có tính năng lưu nháp qua đóng app.
Không mặc định tất cả 429 là hết quota ngày; có thể chỉ hết hạn mức theo phút.
[Hạn mức](https://aistudio.google.com/docs/rate-limits),
[mã lỗi](https://aistudio.google.com/docs/api-errors).

## 9. Trình tự thực hiện chuyển đổi

Các bước dưới là lộ trình thiết kế. Kế hoạch kỹ thuật chi tiết từng task được lập sau
khi người dùng duyệt bản thiết kế liên kết ở cuối tài liệu.

### Bước 1 — Ghi nhận hiện trạng

- Xem git diff để không ghi đè các thay đổi có sẵn của người dùng.
- Chạy baseline backend/app và ghi lỗi có sẵn riêng với lỗi do chuyển đổi.
- Chuẩn bị dữ liệu giả lập: tên hàng không dấu, nhiều sản phẩm, ảnh bao bì, phiếu,
  sản phẩm trùng tên, khác đơn vị và tài khoản có quyền khác nhau.

### Bước 2 — Chuẩn bị Gemini

- Vào [Google AI Studio](https://aistudio.google.com/api-keys), kiểm tra project và API key.
- Xác nhận model hỗ trợ free tier và xem quota thực tế của project.
- Không bật cấu hình trả phí tự động trong ứng dụng; không tạo cơ chế xoay nhiều key.
- Một số project có thể cần xác minh trước khi dùng free tier.
  [Hướng dẫn bắt đầu](https://aistudio.google.com/docs/get-started).

### Bước 3 — Chốt hợp đồng kết quả và lỗi

- Tách schema/kiểu tên `Claude…` thành kiểu nghiệp vụ không gắn provider.
- Giữ các trường dữ liệu mà app sử dụng; thay provider và thông tin cấu hình.
- Bổ sung mã lỗi AI và `retryAfterSeconds` nếu provider có thời gian chờ tin cậy.
- Viết kiểm thử phân loại quota/nghẽn/key sai/model sai/timeout trước khi nối UI.

### Bước 4 — Thay adapter chữ, ảnh và phiếu

- Thêm SDK `@google/genai` trong backend; khóa phiên bản bằng package-lock.
- Chuyển prompt/schema và định dạng ảnh sang Gemini, giữ validation nghiệp vụ.
- Giới hạn token đầu ra theo từng tác vụ, timeout và số lần gọi; cấu hình không tự retry.
- Bỏ fallback tự động trong đường chạy AI và bảo toàn mã lỗi qua AiService.
- Kiểm tra JSON bị cắt, rỗng, sai schema hoặc bị chặn; không dùng kết quả dở dang.

### Bước 5 — Chuyển chat và phiên

- Chuyển tool schema, lịch sử và function response sang định dạng SDK đã chọn.
- Giữ toàn bộ model response cần cho lượt tiếp, không mất function ID/metadata/chữ ký.
- Giữ giới hạn 6 vòng/lượt, 30 lượt/phiên, TTL 2 giờ, 5 phiên/user và khóa phiên bận.
- Giữ timeout 30 giây/lần gọi, tổng tối đa 60 giây/lượt chat; app chờ chat 70 giây,
  chuẩn hóa/ảnh/phiếu 40 giây như hiện tại.
- Lỗi phải giải phóng khóa, bỏ phần lịch sử chưa hoàn tất và không trả action dở dang.
- Giữ nguyên cơ chế gọi API kho khi người dùng xác nhận.

### Bước 6 — Cập nhật app

- Đổi kiểu/provider và nhãn Claude sang Gemini trong types, chat, scanner, store.
- Mở rộng ApiError để đọc code và thời gian chờ mà không ảnh hưởng lỗi API khác.
- Normalize/form giữ văn bản khi AI lỗi; không xóa hoặc tự sửa form đang nhập.
- Scanner giữ preview + đường dẫn upload, bổ sung thử lại trên cùng ảnh.
- Chat giữ lịch sử/nội dung lỗi, cho thử lại chủ động.
- Các màn hình nhập tay vẫn hoạt động; không khóa cả app vì lỗi AI.

### Bước 7 — Kiểm thử và chạy thử

- Chạy kiểm thử tự động với mock Gemini, gồm quota và các trường hợp lỗi.
- Chạy build, lint, typecheck và E2E API.
- Chạy thử cả bốn luồng bằng key thật nếu có quota, ghi lại kết quả thực tế.
- Kiểm tra thủ công khi provider lỗi và khi người dùng đổi quyền/cửa hàng/phiên.
- Kiểm tra không có giao dịch kho được tạo chỉ từ thao tác phân tích AI.

### Bước 8 — Hoàn thiện tài liệu và dọn tích hợp cũ

- Cập nhật README, AI_ASSISTANT, SCAN và tài liệu nghiệm thu để khớp hành vi mới.
- Tìm import Anthropic, nhãn Claude và fallback còn sót; chuyển test trước khi gỡ SDK.
- Ghi kết quả thực tế vào mục nghiệm thu của báo cáo; không ghi pass nếu chưa chạy.

## 10. Nhóm file dự kiến thay đổi

| Nhóm | File/khu vực |
|---|---|
| SDK | `Server/backend/package.json`, `package-lock.json` |
| Adapter/schema/lỗi | `Server/backend/src/ai/claude-product-vision.ts` → adapter Gemini và helper/schema tương ứng |
| Điều phối AI | `src/ai/ai.service.ts`, `ai.controller.ts`, `ai.module.ts` nếu cần DI |
| Trợ lý | `src/ai/assistant/assistant.service.ts`, `assistant-session.store.ts`, `assistant-tools.ts`, `assistant.types.ts` |
| Hợp đồng app | `App/InventorySupport/src/types/index.ts`, `services/api.ts`, `services/ai.service.ts` nếu cần |
| Trạng thái/UI | `store/assistant.store.tsx`, `screens/ai/AssistantChat.tsx`, `NormalizePanel.tsx`, `screens/scanner/ImageScanner.tsx`, `screens/products/ProductFormScreen.tsx` |
| Nhãn/thông báo gợi ý | `src/components/AiSuggestionCard.tsx` và các nơi hiển thị fallback/provider |
| Kiểm thử | Các spec AI/assistant/client request và `Server/backend/test/app.e2e-spec.ts` |
| Tài liệu | `README.md`, `docs/AI_ASSISTANT.md`, `SCAN.md`, `AI_NORMALIZATION_EVAL.md` và báo cáo này |

Không đổi hệ điều hướng hoặc cấu trúc toàn repo. Tên file mới/helper và API SDK cụ thể
được chốt trong kế hoạch kỹ thuật sau khi duyệt thiết kế.

## 11. Hướng dẫn chạy sau khi chuyển đổi được triển khai

### Khởi động backend bằng PowerShell

Tại thư mục gốc project, sau khi đã có mã chuyển đổi:

```powershell
cd Server/backend
npm install
$env:JWT_SECRET = "your-local-development-secret"
$env:GEMINI_API_KEY = "your-gemini-api-key"
$env:AI_MODEL = "gemini-3.5-flash-lite"
npm run start:dev
```

Key thật chỉ nhập trên máy chạy backend; không gửi key qua chat, commit hay đưa vào
`EXPO_PUBLIC_*`. Project hiện đọc `process.env`, chưa tự nạp file `.env`; lộ trình này
giữ cách cấu hình bằng môi trường, không yêu cầu thêm thư viện dotenv.

### Khởi động app trong cửa sổ PowerShell khác

```powershell
cd App/InventorySupport
npm install
npm run start
```

App tự xác định địa chỉ backend theo cấu hình hiện có. Nếu cần chỉ định:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.10:3000"
npm run start
```

Thay IP bằng IP máy chạy backend; điện thoại cần truy cập được địa chỉ đó.

### Đổi key chủ động

1. Dừng backend bằng Ctrl+C trong cửa sổ đang chạy.
2. Đặt lại `$env:GEMINI_API_KEY` bằng key hợp lệ mà bạn có quyền sử dụng.
3. Chạy lại `npm run start:dev` trong cùng cửa sổ.
4. Giữ lịch sử hiển thị của app; nếu phiên RAM đã mất, bắt đầu chat mới khi cần.
5. Kiểm tra một yêu cầu AI nhỏ; `/ai/status` chỉ phản ánh cấu hình, không chứng minh
   key hợp lệ hoặc còn quota.

Quota tính theo project, không theo key. Key khác cùng project không tăng hạn mức.
Đổi key không phải cam kết hết lỗi quota và ứng dụng không tự luân phiên tài khoản.
[Hạn mức Gemini](https://aistudio.google.com/docs/rate-limits).

## 12. Lệnh kiểm tra sau triển khai

Backend, chạy trong `Server/backend`:

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

App, chạy trong `App/InventorySupport`:

```powershell
npm run lint
npx tsc --noEmit
```

Lệnh trên là các script/công cụ của repo hiện tại. Cần đọc kết quả thật và ghi lỗi
có sẵn; tài liệu này không khẳng định chúng đã pass sau chuyển đổi.

## 13. Checklist nghiệm thu dự kiến

| Ca kiểm tra | Kết quả cần đạt | Kết quả thực tế |
|---|---|---|
| Chuẩn hóa chữ không dấu/nhiều món | Tách đúng, không bịa thuộc tính | Chưa chạy |
| Ảnh sản phẩm | Có gợi ý và ứng viên đúng cửa hàng | Chưa chạy |
| Phiếu nhập, đơn vị khác kho | Yêu cầu người dùng duyệt, chưa tự nhập | Chưa chạy |
| Chat hỏi tồn | Gọi công cụ, trả số tồn từ backend | Chưa chạy |
| Chat đề xuất xuất | Chưa ghi trước xác nhận; ghi một giao dịch sau xác nhận | Chưa chạy |
| Mock hết quota ngày | Thông báo đúng, giữ dữ liệu, không fallback | Chưa xác minh phân loại quota ngày |
| Mock giới hạn phút/429 không rõ | Không nói sai là hết quota ngày | Đạt với lỗi 429 không rõ |
| Mock key sai/model sai | Báo cấu hình, không đăng xuất/gửi lại chat tự động | Đạt phân loại lỗi 401 bằng mock; chưa kiểm tra UI end-to-end |
| Mock timeout/5xx/JSON sai/nội dung bị chặn | Lỗi rõ, dừng loading, không nhận kết quả dở | Chưa chạy |
| AI lỗi giữa vòng gọi công cụ | Không kẹt phiên/không action dở/không ghi kho | Chưa chạy |
| Thử lại ảnh | Dùng URL đã upload nếu có, giữ preview | Chưa chạy |
| Lưu thủ công khi AI lỗi | API sản phẩm/kho vẫn hoạt động theo quyền | Chưa chạy |
| Confirm lỗi sau lưu kho | Nói giao dịch đã lưu, không ghi lại | Chưa chạy |
| Sai quyền/cửa hàng | Không lộ dữ liệu hoặc thực hiện thao tác bị cấm | Chưa chạy |

Test quota dùng mock, không cố tiêu hết quota thật. Kết quả kiểm thử có mock và demo
model thật phải ghi riêng. Dữ liệu free tier có thể được Google dùng cải thiện sản
phẩm theo điều khoản, nên đồ án dùng ảnh/phiếu và dữ liệu giả lập.
[Thông tin theo gói](https://aistudio.google.com/docs/pricing).

## 14. Cách trình bày khi bảo vệ

Có thể giải thích: “Ứng dụng dùng Gemini để hiểu chữ và ảnh, trả dữ liệu theo schema
hoặc đề nghị gọi công cụ. Backend kiểm tra quyền và tra kho thật; AI chỉ tạo gợi ý.
Người dùng duyệt rồi API nghiệp vụ mới lưu. Khi hết hạn mức miễn phí, hệ thống báo rõ
và vẫn cho quản lý kho thủ công.”

Thứ tự demo: chuẩn hóa chữ → ảnh sản phẩm → phiếu nhập đã duyệt → hỏi tồn → đề xuất
xuất và xác nhận → hỏi lại tồn → minh họa lỗi quota bằng mock ở môi trường kiểm thử.

## 15. Tài liệu thiết kế liên quan

- [Bản thiết kế chờ duyệt](superpowers/specs/2026-11-14-gemini-free-migration-design.md).
- [Thiết kế AI hiện tại](AI_ASSISTANT.md).
- [Luồng quét hiện tại](SCAN.md).
- [Ca nghiệm thu chuẩn hóa hiện tại](AI_NORMALIZATION_EVAL.md).

Kiểm tra backend gần nhất: build và lint đạt; 80 kiểm thử đơn vị và 22 kiểm thử API
đạt với dữ liệu giả lập, sau đó đã bổ sung và chạy đạt một kiểm thử quota. App đã đạt
`npx tsc --noEmit` và `npx eslint src --no-cache`. Chưa gọi Gemini thật.
