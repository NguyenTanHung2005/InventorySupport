# Trợ lý AI - Mô hình và cách triển khai

Tài liệu mô tả kiến trúc, mô hình AI, cơ chế an toàn và cách triển khai trợ lý AI của
**Inventory Support** (đề tài 7: *Hỗ trợ kiểm kê cửa hàng nhỏ*). Code hiện thực bám theo
tài liệu này; khi thay đổi thiết kế, cập nhật tài liệu trước.

---

## 1. Mục tiêu và phạm vi

Trợ lý AI giúp nhân viên cửa hàng nhỏ làm nhanh ba việc mà không cần thao tác nhiều màn hình:

| Năng lực | Người dùng làm gì | AI trả về |
|---|---|---|
| **Chuẩn hóa mô tả** | Gõ "nuoc ngot coca chai 390ml, banh oreo" | Tên chuẩn, danh mục, đơn vị, mô tả cho từng sản phẩm |
| **Nhận diện ảnh** | Chụp bao bì sản phẩm | Gợi ý sản phẩm + mã vạch đọc được + đối chiếu hàng có sẵn |
| **Hỏi đáp kho** (mới) | Hỏi "Hàng nào sắp hết?", "Coca còn bao nhiêu?", "Xuất 3 chai coca" | Câu trả lời dựa trên dữ liệu thật của cửa hàng + **thẻ đề xuất** thao tác để người dùng bấm xác nhận |

**Ngoài phạm vi** (đúng ràng buộc của đề tài, *không mở rộng thành ERP*): kế toán, công nợ,
đơn đặt hàng nhà cung cấp, dự báo nhu cầu. Trợ lý **không tự ghi dữ liệu**.

---

## 2. Kiến trúc tổng thể

```text
┌──────────── Mobile (Expo) ────────────┐         ┌──────────────── Backend (NestJS) ────────────────┐
│ AiScreen                              │  JWT    │ AssistantController  POST /ai/assistant/chat     │
│  ├─ Hỏi đáp  (AssistantChat)  ────────┼────────►│   │ kiểm tra quyền AI_USE + giới hạn tần suất     │
│  │    • tin nhắn, thẻ sản phẩm        │         │   ▼                                              │
│  │    • thẻ đề xuất ─► Xác nhận ──────┼──┐      │ AssistantService                                 │
│  └─ Chuẩn hóa (NormalizePanel)        │  │      │   ├─ có API key ─► Claude (tool use loop) ───┐   │
│ ScannerScreen (quét ảnh AI)           │  │      │   └─ không có  ─► OfflineAssistant (luật)    │   │
└───────────────────────────────────────┘  │      │ AssistantSessionStore (lịch sử append-only)  │   │
                                           │      │ AssistantTools ── ProductsService ◄──────────┘   │
                                           │      │                └─ InventoryService (chỉ đọc)     │
                                           │      └──────────────────────────────────────────────────┘
                                           └──► API nghiệp vụ thường (/inventory/movement, /products)
                                                 → kiểm tra quyền lần nữa rồi mới ghi dữ liệu
```

Nguyên tắc: **AI chỉ đọc và đề xuất; con người xác nhận; API nghiệp vụ là nơi ghi.**

---

## 3. Mô hình AI

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Nhà cung cấp | Anthropic Claude qua `@anthropic-ai/sdk` | Hỗ trợ vision, tool use, structured output trong một API |
| Model | `claude-opus-5-5` (đổi bằng `AI_MODEL`) | Model Opus hiện hành, hiểu tiếng Việt tốt, giá $4/$20 mỗi 1M token |
| Mức suy luận | `output_config.effort: "low"` (đổi bằng `AI_EFFORT`) | Trả lời hội thoại cần nhanh; câu hỏi kho không cần suy luận sâu |
| Thinking | Adaptive (mặc định, luôn bật trên Opus 5.5) | Không gửi `budget_tokens` hay `disabled` (Opus 5.5 trả 400) |
| Dự phòng | `fallbacks: "default"` + beta `server-side-fallback-2026-07-01` | Nếu bộ lọc an toàn từ chối nhầm, server tự chạy lại trên model dự phòng |
| Prompt caching | `cache_control: {type: "ephemeral"}` ở cấp request | `system` + `tools` cố định nên được cache, giảm chi phí các lượt sau |
| Chạy offline | `OfflineAssistant` (bộ luật từ khóa tiếng Việt) | Demo được khi không có API key / mất mạng |

Ba năng lực dùng ba kiểu gọi khác nhau:

1. **Chuẩn hóa mô tả** - một lần gọi, *structured output* (`output_config.format` JSON schema).
2. **Nhận diện ảnh** - một lần gọi, ảnh base64 + structured output.
3. **Hỏi đáp kho** - *vòng lặp tool use*: model gọi công cụ đọc dữ liệu, backend thực thi,
   trả kết quả, lặp tối đa `MAX_TOOL_ROUNDS = 6` vòng mỗi câu hỏi.

API key chỉ nằm trên backend (`ANTHROPIC_API_KEY`), không bao giờ xuống mobile.

---

## 4. Thiết kế hội thoại (session)

### 4.1 Lưu phiên trên server, lịch sử chỉ nối thêm

Với Opus 5.5, mỗi *thinking block* gắn chữ ký với **toàn bộ phần hội thoại phía trước**
(`system`, `tools`, các message trước nó). Nếu lượt sau gửi lại lịch sử đã bị sửa, xóa hoặc
sắp xếp lại, API sẽ từ chối block đó. Vì vậy:

- Backend giữ **toàn bộ** lịch sử (gồm thinking, `tool_use`, `tool_result`) trong
  `AssistantSessionStore`, mobile chỉ gửi `sessionId` + câu hỏi mới.
- Lịch sử **chỉ nối thêm** (append-only): không bao giờ sửa/xóa message cũ.
- `system` prompt và danh sách `tools` **được đóng băng khi tạo phiên** (theo vai trò lúc đó).
- Gửi `thinking.block_binding.prefix_mismatch_behavior: "drop_block"` (beta
  `thinking-binding-controls-2026-08-01`): nếu có lỗi lệch lịch sử, API bỏ block lỗi thay vì
  trả 400, hội thoại vẫn tiếp tục.
- Lợi ích phụ: prefix ổn định nên prompt cache trúng nhiều hơn.

### 4.2 Giới hạn phiên

| Tham số | Giá trị | Ghi chú |
|---|---|---|
| Thời gian sống | 2 giờ không hoạt động | Hết hạn → mobile tự tạo phiên mới |
| Số lượt / phiên | 30 câu hỏi | Quá giới hạn → yêu cầu bắt đầu cuộc trò chuyện mới |
| Phiên / người dùng | 5 | Phiên cũ nhất bị loại |
| Đồng thời | 1 yêu cầu / phiên | Yêu cầu thứ hai trả 409 |
| Tần suất | 20 câu hỏi / 5 phút / người | Kiểm soát chi phí, trả 429 |

Phiên lưu trong RAM: khởi động lại server sẽ mất phiên (mobile nhận 404 và tự bắt đầu lại).
Đây là đánh đổi có chủ ý: lịch sử chứa thinking block, không cần lưu lâu dài.

### 4.3 Khi chạm giới hạn vòng lặp

Ở vòng thứ `MAX_TOOL_ROUNDS`, backend **nối thêm** một đoạn text sau các `tool_result`:
"Đã đạt giới hạn tra cứu, hãy trả lời bằng thông tin hiện có". Cách này không sửa lịch sử,
và model sẽ kết thúc bằng câu trả lời.

---

## 5. Bộ công cụ (tools)

Mọi công cụ chạy với `storeId` lấy từ JWT. **Model không thể chỉ định cửa hàng.** Danh sách
công cụ được lọc theo quyền của người dùng khi tạo phiên, và quyền được kiểm tra lại khi chạy.

| Công cụ | Đầu vào | Quyền | Kết quả |
|---|---|---|---|
| `search_products` | `query`, `category?`, `low_stock_only?`, `limit?` (≤ 20) | Xem sản phẩm | Danh sách rút gọn (id, tên, barcode, tồn, giá...) |
| `get_product` | `product_id?` hoặc `barcode?` | Xem sản phẩm | Chi tiết + 5 giao dịch gần nhất |
| `list_low_stock` | (không) | Xem sản phẩm | Hàng sắp hết / hết hàng |
| `list_transactions` | `product_id?`, `type?`, `days?`, `limit?` | Xem sản phẩm | Lịch sử nhập/xuất/kiểm kê |
| `get_inventory_summary` | `days?` | Xem báo cáo | Tổng nhập/xuất, giá trị tồn, top xuất |
| `propose_stock_movement` | `product_id`, `type`, `quantity`, `reason?` | Nhập / Xuất / Kiểm kê (theo `type`) | **Thẻ đề xuất**, chưa ghi dữ liệu |
| `propose_new_product` | `name`, `category?`, `unit?`, `price?`, `cost_price?`, `barcode?`, `description?` | Tạo sản phẩm | **Thẻ đề xuất** mở form tạo sản phẩm |

Giá nhập (`cost_price`) chỉ trả về cho người có quyền xem báo cáo hoặc tạo sản phẩm
(giảm thiểu lộ dữ liệu kinh doanh cho nhân viên).

### Thẻ đề xuất (action card)

```json
{ "id": "act-...", "kind": "STOCK_MOVEMENT", "productId": "product-1", "productName": "Coca-Cola 390ml",
  "unit": "chai", "type": "EXPORT", "quantity": 3, "reason": "Bán lẻ", "currentQuantity": 24 }
```

Mobile hiển thị thẻ với nút **Xác nhận** → gọi `POST /inventory/movement` như thao tác tay
→ backend kiểm tra quyền + tồn kho lần nữa. Thẻ `CREATE_PRODUCT` mở form tạo sản phẩm đã
điền sẵn để người dùng xem lại rồi lưu.

---

## 6. An toàn và quyền riêng tư

| Rủi ro | Biện pháp |
|---|---|
| AI tự ý thay đổi tồn kho | Không có công cụ ghi; chỉ có `propose_*`; người dùng phải bấm xác nhận |
| Vượt quyền (nhân viên nhập kho qua AI) | Lọc tools theo quyền, kiểm tra lại khi chạy tool, kiểm tra lần ba ở API nghiệp vụ |
| Lộ dữ liệu cửa hàng khác | Tool luôn dùng `storeId` từ JWT; không có tham số cửa hàng |
| Prompt injection (mô tả sản phẩm chứa lệnh) | System prompt nêu rõ dữ liệu từ công cụ là *dữ liệu*, không phải chỉ thị; AI không có quyền ghi |
| Lộ API key | Key chỉ ở backend; mobile gọi qua JWT |
| Chi phí tăng đột biến | Rate limit theo người dùng, giới hạn lượt/phiên, `effort: low`, prompt caching |
| Bộ lọc an toàn từ chối nhầm | `fallbacks: "default"`; nếu vẫn từ chối thì trả lời lịch sự, không lỗi |
| AI bịa số liệu | Prompt yêu cầu chỉ dùng số liệu từ công cụ, nói rõ khi không tìm thấy |

---

## 7. Chế độ offline (không có API key)

`OfflineAssistant` nhận diện ý định bằng từ khóa tiếng Việt (bỏ dấu) và gọi cùng bộ công cụ:

| Câu hỏi ví dụ | Ý định | Kết quả |
|---|---|---|
| "hàng nào sắp hết", "cần nhập gì" | `low_stock` | Danh sách sắp hết |
| "tổng quan", "báo cáo tuần", "doanh thu" | `summary` | Số liệu tổng hợp (cần quyền báo cáo) |
| "giao dịch gần đây", "lịch sử xuất" | `transactions` | 5 giao dịch gần nhất |
| "xuất 3 coca", "nhập 10 mì hảo hảo" | `movement` | Thẻ đề xuất nhập/xuất |
| "coca còn bao nhiêu", "giá sữa" | `product` | Tìm sản phẩm theo tên |
| khác | `help` | Hướng dẫn những gì trợ lý làm được |

Phản hồi có cùng định dạng với chế độ Claude, nên mobile không cần phân biệt.

---

## 8. Hợp đồng API

### `POST /ai/assistant/chat` - quyền `AI_USE`

```json
// Request
{ "sessionId": "asst-...", "message": "Hàng nào sắp hết?" }   // sessionId bỏ trống = phiên mới

// Response 201
{
  "sessionId": "asst-...",
  "provider": "claude" | "offline",
  "reply": "Có 2 sản phẩm cần nhập thêm: ...",
  "products": [ /* sản phẩm được nhắc tới, để hiển thị thẻ */ ],
  "actions":  [ /* thẻ đề xuất */ ],
  "toolCalls": [ { "name": "list_low_stock", "summary": "Tra hàng sắp hết" } ],
  "turn": 1, "maxTurns": 30
}
```

| Mã lỗi | Ý nghĩa | Mobile xử lý |
|---|---|---|
| 400 | Câu hỏi rỗng / quá 1000 ký tự / hết lượt của phiên | Hiện lỗi; hết lượt → nút "Cuộc trò chuyện mới" |
| 404 | Phiên không tồn tại (hết hạn, server khởi động lại) | Tự gửi lại không kèm `sessionId` |
| 409 | Phiên đang xử lý câu trước | Hiện "Đang trả lời câu trước" |
| 429 | Vượt tần suất | Hiện thời gian chờ |
| 503 | Lỗi nhà cung cấp AI | Hiện lỗi, cho thử lại |

### `DELETE /ai/assistant/sessions/:id` - xóa phiên (nút "Cuộc trò chuyện mới")
### `GET /ai/status` - `{ provider, assistant: { maxTurns, model } }`

---

## 9. Giao diện mobile

- **Màn Trợ lý AI** có hai chế độ: *Hỏi đáp* (chat) và *Chuẩn hóa* (như cũ).
- Lịch sử chat giữ trong `AssistantProvider` (tồn tại suốt phiên đăng nhập, xóa khi đăng xuất).
- Gợi ý nhanh (chip): "Hàng nào sắp hết?", "Tổng quan 7 ngày", "Giao dịch hôm nay"...
  Chip thao tác chỉ hiện khi người dùng có quyền tương ứng.
- Mỗi câu trả lời có thể kèm: thẻ sản phẩm (bấm để xem chi tiết), thẻ đề xuất
  (Xác nhận / Chỉnh sửa / Bỏ qua), dòng nhỏ "Đã tra: ..." để minh bạch AI đã đọc gì.
- Lối vào: thẻ "Hỏi trợ lý AI" ở Tổng quan, nút ở Tài khoản và ở màn Quét.

---

## 10. Cấu hình và triển khai

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `ANTHROPIC_API_KEY` | (trống → offline) | Bật Claude |
| `AI_MODEL` | `claude-opus-5-5` | Model dùng cho mọi năng lực AI |
| `AI_EFFORT` | `low` | `low` / `medium` / `high` cho trợ lý hỏi đáp |
| `AI_RATE_LIMIT` | `20` | Số câu hỏi / 5 phút / người dùng |

Các bước:

1. Tạo API key tại Claude Console, đặt `ANTHROPIC_API_KEY` trên máy chạy backend.
2. `npm run start:dev`, gọi `GET /ai/status` → `provider: "claude"`.
3. Trên mobile mở *Trợ lý AI → Hỏi đáp*, hỏi thử "Hàng nào sắp hết?".

Chi phí ước tính: một câu hỏi thường gồm 1-3 lần gọi model, mỗi lần khoảng 3-6K token
đầu vào (phần lớn được cache) và vài trăm token đầu ra.

---

## 11. Kiểm thử

| Loại | Nội dung |
|---|---|
| Unit | Lọc tools theo vai trò; tool không đọc được dữ liệu cửa hàng khác; `propose_stock_movement` từ chối loại không có quyền và xuất vượt tồn; ý định của `OfflineAssistant` |
| E2E | `POST /ai/assistant/chat` ở chế độ offline: hỏi hàng sắp hết, tạo thẻ xuất kho, nhân viên không nhận được thẻ nhập kho, xóa phiên, 404 với phiên lạ |
| Thủ công (có key) | Hỏi nhiều lượt trong một phiên, xác nhận thẻ đề xuất, thử prompt injection trong mô tả sản phẩm |

---

## 12. Giới hạn và hướng phát triển

- Phiên trong RAM: chạy nhiều instance backend thì cần chuyển sang Redis.
- Chưa stream câu trả lời từng chữ (cần SSE trên React Native).
- Offline chỉ hiểu các mẫu câu phổ biến.
- Có thể thêm: gợi ý số lượng nhập dựa trên tốc độ bán, trả lời bằng giọng nói.
