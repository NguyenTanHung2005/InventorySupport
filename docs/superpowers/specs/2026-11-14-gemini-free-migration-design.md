# Thiết kế chuyển AI sang Gemini miễn phí

Ngày: 14/11/2026. Trạng thái: bản thiết kế chờ duyệt; chưa triển khai.

## 1. Mục đích và quyết định đã thống nhất

Inventory Support là đồ án React Native + NestJS. Người dùng muốn dùng AI miễn phí,
hiểu rõ cách AI hoạt động và có báo cáo, hướng dẫn thực hiện để phát triển và bảo vệ.

Người dùng đã chọn phương án 1: khi dịch vụ AI bị giới hạn, thông báo rõ, giữ dữ liệu
đang làm việc và cho tiếp tục thao tác thủ công. Không tự chuyển sang luật offline
hay model khác khi lỗi. Người quản lý backend tự thay key nếu cần.

## 2. Các phương án đã xem xét

| Phương án | Đánh đổi | Kết luận |
|---|---|---|
| Gemini miễn phí, báo lỗi và tiếp tục nhập tay | Cần Internet, phụ thuộc quota; ít nhánh xử lý | Người dùng chọn |
| Gemini kèm xử lý offline theo luật | Có kết quả cơ bản nhưng không thay được đọc ảnh, dễ nhầm khả năng AI | Không chọn |
| Gemini kèm model cục bộ | Cần cài model, tài nguyên máy và kiểm thử thêm | Không chọn |

## 3. Phạm vi và lựa chọn kỹ thuật đề xuất

- Chuyển cả bốn chức năng: chuẩn hóa chữ, nhận diện ảnh, đọc phiếu nhập, trợ lý kho.
- Dùng Gemini Developer API, SDK chính thức `@google/genai` ở backend; model dự kiến
  `gemini-3.5-flash-lite`, cấu hình được qua `AI_MODEL`. Trước triển khai phải xác nhận
  model còn hỗ trợ free tier và tài khoản/project thực tế có quota.
- Giữ các endpoint hiện có, JWT, quyền, phạm vi cửa hàng, matching và API ghi kho.
- Giữ React Navigation đang dùng; không đổi hệ điều hướng hay cơ sở dữ liệu.
- Đích cuối chỉ dùng Gemini cho các endpoint AI. Không xây bộ định tuyến nhiều provider.
  Mã heuristic cũ có thể còn trong repo nếu cần giữ test/hàm độc lập, nhưng các endpoint
  AI không tự gọi nó, kể cả khi thiếu key.
- Chọn cách gọi SDK và phiên bản được khóa trong lockfile sau khi đối chiếu tài liệu
  chính thức. Đề xuất dùng GenerateContent với lịch sử do backend quản lý nếu model/SDK
  vẫn hỗ trợ đầy đủ; không chuyển sang phiên do nhà cung cấp lưu chỉ để đổi model.
  Nếu không còn hỗ trợ, phải cập nhật thiết kế thay vì âm thầm đổi cơ chế phiên.
- API key chỉ ở biến môi trường `GEMINI_API_KEY` của backend. Không có màn hình nhập key.
- Không cài đặt, sửa mã sản phẩm hay gọi API thật trong giai đoạn lập thiết kế này.

## 4. Hiện trạng cần thay đổi

`claude-product-vision.ts` chứa prompt, JSON schema, gửi ảnh và chuẩn hóa chữ;
`assistant.service.ts` có vòng lặp Claude tool use. Session store và định nghĩa tool
đang dùng kiểu Anthropic. `AiService.normalize()` hiện fallback sang heuristic;
`scanImage()`/`scanInvoice()` gom lỗi provider thành lỗi nhận diện.

App có kiểu provider và nhãn Claude tại types, assistant store, chat và scanner.
`ApiError` mới giữ HTTP status/message, chưa có mã lỗi AI hay thời gian chờ.
Scanner chỉ giữ preview, chưa giữ URL upload để gọi lại mà không chọn/tải ảnh lại.

## 5. Hợp đồng và luồng thành công

Giữ cấu trúc nghiệp vụ của kết quả chuẩn hóa, ứng viên sản phẩm, dòng phiếu,
`AssistantReply`, actions và toolCalls. `source` vẫn là `provider` khi thành công.
Đổi provider của kết quả chat thành `gemini`; trạng thái AI trả provider `gemini`,
`configured: boolean`, model và giới hạn phiên. Cấu hình đúng không đồng nghĩa còn quota
hay đã kết nối thành công; `/ai/status` không gọi model để thăm dò.

### Chuẩn hóa và ảnh sản phẩm

1. App gửi chữ; hoặc chọn ảnh, upload rồi gửi đường dẫn upload của chính cửa hàng.
2. Backend kiểm tra JWT/quyền, đầu vào, chủ sở hữu ảnh và giới hạn dữ liệu hiện có.
3. Backend gửi prompt tiếng Việt, danh mục phù hợp, chữ/ảnh và schema cho Gemini.
4. Backend kiểm tra kết thúc response, JSON và các trường bắt buộc. Không nhận kết quả
   bị cắt, rỗng, bị chặn, sai schema; không tự suy đoán giá hay mã vạch.
5. Backend tìm ứng viên trong cửa hàng; app hiển thị thẻ cho sửa/chọn trước khi lưu.
6. Tạo sản phẩm vẫn qua API sản phẩm; tồn ban đầu vẫn qua giao dịch kho riêng.

### Phiếu nhập

1. Upload ảnh → Gemini trích dòng hàng → backend kiểm tra và tìm ứng viên.
2. Giữ giới hạn 100 dòng, cơ chế duyệt tên, số lượng, đơn vị, đơn giá và tính đọc được.
3. Chỉ chọn sẵn nếu có đúng một ứng viên và đơn vị khớp rõ ràng như logic hiện tại.
4. Người dùng duyệt rồi gọi `/inventory/batch`; backend kiểm tra cả batch trước khi lưu.
5. Cập nhật giá nhập nếu được chọn là bước riêng; phải báo trạng thái riêng nếu thất bại.

### Chat và công cụ

1. Backend xác thực, kiểm tra tần suất nội bộ, tạo/lấy phiên thuộc user/store/role/model.
2. Gửi system prompt, lịch sử và công cụ đã lọc quyền cho Gemini.
3. Gemini trả lời hoặc đề nghị gọi hàm. Backend chỉ chạy hàm thuộc allowlist và kiểm tra
   quyền, tham số, phạm vi cửa hàng; không thực thi mã hay tên hàm tùy ý.
4. Backend gửi kết quả hàm về Gemini và tiếp tục đến câu trả lời cuối.
5. Lưu đầy đủ phần phản hồi model cần cho lượt tiếp, gồm metadata/chữ ký nếu SDK yêu cầu;
   ghép chính xác từng function response với function call. Không chỉ lưu phần text.
6. Tools chỉ đọc hoặc tạo đề xuất. `propose_stock_movement` không ghi kho.
7. App hiển thị action; người dùng xác nhận → `/inventory/movement` lưu giao dịch.
8. App gửi transactionId đến endpoint confirm để đối chiếu và cập nhật ngữ cảnh phiên;
   confirm không gọi model, không ghi kho lần nữa.

Giữ giới hạn hiện có: tối đa 6 vòng model/lượt, 30 lượt/phiên, TTL 2 giờ, tối đa
5 phiên/user, khóa phiên khi đang trả lời, timeout 30 giây/lần gọi và 60 giây/lượt chat.
Lỗi một lượt phải hoàn tác phần lịch sử chưa hoàn tất, không tăng lượt thành công,
không trả actions dở dang, luôn giải phóng khóa. Lịch sử UI không bị xóa khi AI lỗi.

## 6. Lỗi và ứng xử đã chọn

Hợp đồng lỗi backend đề xuất: `{ statusCode, code, message, retryAfterSeconds? }`.
`retryAfterSeconds` chỉ có khi có thời gian chờ đáng tin cậy; phải là số hữu hạn dương.
Không suy ra lỗi ngày chỉ từ HTTP 429 hoặc một chuỗi lỗi bất kỳ. Ưu tiên mã lỗi và
quota metadata có cấu trúc được tài liệu SDK/API xác nhận; không đủ dữ kiện thì dùng
thông báo giới hạn chung. Rate limit nội bộ backend là mã riêng.

| HTTP/code | Thông báo chính xác |
|---|---|
| 429 `AI_QUOTA_EXCEEDED` | Chức năng AI đã hết hạn mức sử dụng hôm nay. Bạn vẫn có thể nhập liệu và quản lý kho thủ công. |
| 429 `AI_RATE_LIMITED` | AI đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau. |
| 429 `AI_USAGE_LIMITED` | AI đang bị giới hạn sử dụng. Vui lòng thử lại sau. |
| 429 `AI_APP_RATE_LIMITED` | Bạn đang gửi yêu cầu AI quá nhanh. Vui lòng thử lại sau. |
| 503 `AI_NOT_CONFIGURED` | Chức năng AI chưa được cấu hình. Bạn vẫn có thể thao tác thủ công. |
| 503 `AI_CONFIGURATION_ERROR` | Chức năng AI đang gặp lỗi cấu hình. Vui lòng liên hệ người quản lý. |
| 503 `AI_UNAVAILABLE` | Tạm thời không kết nối được AI. Vui lòng thử lại. |
| 504 `AI_TIMEOUT` | AI phản hồi quá lâu. Vui lòng thử lại. |
| 502 `AI_INVALID_RESPONSE` | AI chưa trả về kết quả hợp lệ. Vui lòng thử lại hoặc nhập thủ công. |
| 422 `AI_CONTENT_BLOCKED` | AI không xử lý được nội dung này. Vui lòng thay đổi nội dung hoặc nhập thủ công. |

Các giá trị/câu chữ trên là quyết định thiết kế đề xuất của người thực hiện, cần duyệt.
Lỗi quyền/key của Google không trả 401 về app, vì 401 hiện kích hoạt đăng xuất JWT.
JWT hết hạn của người dùng vẫn trả 401 như cũ. Provider 404/model không tồn tại phải
đổi thành `AI_CONFIGURATION_ERROR`, không làm app nhầm với phiên chat hết hạn.

Không tự retry ở app hay SDK/model adapter (cấu hình rõ, không phụ thuộc mặc định SDK);
người dùng chủ động thử lại. Không tự đổi key/model, không chuyển trả phí. Không khóa
toàn bộ AI đến hôm sau chỉ vì một lỗi; báo trạng thái của yêu cầu đang thất bại.
Phiên mới tiếp tục dùng cùng cấu hình backend; restart để đổi key/model làm mất phiên RAM.

## 7. Giữ dữ liệu và thao tác thủ công

- NormalizePanel và ProductForm: giữ chữ, form và chỉnh sửa của người dùng; lỗi không
  đè form hay điền gợi ý một phần. Lỗi trong product form không cản lưu hợp lệ thủ công.
- ImageScanner: giữ ảnh preview và URL upload thành công trong state; thêm Thử lại để
  gọi AI với cùng URL, không chọn/tải ảnh lại. Upload chưa xong thì giữ nguồn ảnh để thử
  upload lại. Đổi ảnh hoặc đổi loại tác vụ mới xóa kết quả cũ tương ứng.
- Chat: giữ lịch sử và nội dung thất bại, cho gửi lại chủ động; không tự gửi vòng lặp.
- Lưu trong bộ nhớ của màn hình/phiên app; chưa bao gồm phục hồi sau đóng app/reload.
- Chuyển sang màn hình sản phẩm/kho có sẵn để thao tác thủ công. Không làm trình sửa
  phiếu hoàn chỉnh từ ảnh khi Gemini chưa đọc ra dòng hàng.
- Action đã được trả thành công vẫn có thể xác nhận qua API kho nếu phiên/quyền hợp lệ;
  AI hết quota không cản ghi kho. Lỗi đồng bộ confirm sau khi đã lưu phải nói giao dịch
  đã lưu, không yêu cầu xác nhận nhập/xuất lại.

## 8. Trình tự chuyển đổi và tiêu chí nghiệm thu

1. Ghi nhận hiện trạng, chạy baseline, giữ nguyên thay đổi chưa commit của người dùng.
2. Xác nhận project Gemini/model/free quota; chuẩn bị fixture chữ, ảnh, phiếu giả lập.
3. Định nghĩa lỗi chung, schema kết quả không phụ thuộc Claude; viết ca kiểm thử hành vi.
4. Tạo adapter Gemini cho chữ/ảnh/phiếu; kiểm tra response và timeout.
5. Đổi AiService/controller, bỏ fallback tự động và không nuốt lỗi quota.
6. Chuyển tool declarations, vòng lặp và session sang Gemini; giữ quyền và xác nhận.
7. Cập nhật types, status, ApiError, nhãn UI và hành vi giữ dữ liệu/thử lại.
8. Chuyển/cập nhật test, chạy build/lint/typecheck/unit/E2E và demo bằng key thật nếu có.
9. Hoàn thiện báo cáo/hướng dẫn bằng kết quả thực tế; chỉ gỡ Anthropic khi không còn
   import/đường chạy sản phẩm hoặc test cần dùng.

Thành công khi cả bốn luồng hoạt động với Gemini trên dữ liệu mẫu; lỗi quota và lỗi
cấu hình hiển thị đúng; không đăng xuất do key AI lỗi; không gọi model khi lưu thủ công;
không tự ghi kho, không vượt quyền/cửa hàng, không mất dữ liệu đang nhập do lỗi AI.
Các test quota phải mock, không tiêu quota thật để tạo lỗi. Test model thật là bước
tách biệt, không suy diễn mock pass thành xác nhận chất lượng/quota tài khoản.

## 9. Tài liệu bàn giao và phần người triển khai tự quyết

Báo cáo/hướng dẫn: [AI_GEMINI_MIGRATION_REPORT.md](../../AI_GEMINI_MIGRATION_REPORT.md).
Sau khi bản thiết kế được duyệt mới tạo kế hoạch kỹ thuật chi tiết theo writing-plans,
sau đó triển khai theo quy trình repo. Báo cáo hiện là hướng dẫn dự kiến, chưa phải
biên bản hoàn thành.

Người triển khai tự quyết tên helper, tổ chức schema/fixture nhỏ và phiên bản SDK
tương thích, không thêm framework trừu tượng. Mọi đổi phạm vi như chuyển sang paid,
thêm model cục bộ, thay cơ chế lưu phiên hoặc thay UI lớn cần đưa lại vào thiết kế.

Nguồn đối chiếu ngày 14/11/2026:
- [Giá/free tier](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite).
- [Model và khả năng](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite).
- [Hạn mức](https://aistudio.google.com/docs/rate-limits).
- [SDK và bắt đầu](https://aistudio.google.com/docs/get-started).
- [Function calling](https://aistudio.google.com/docs/function-calling).
- [Structured output](https://aistudio.google.com/docs/structured-output).
- [Mã lỗi](https://aistudio.google.com/docs/api-errors).
