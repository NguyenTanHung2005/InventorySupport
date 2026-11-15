# Mốc tiến độ dự án

Cập nhật: 15/11/2026. Mốc này được tổng hợp từ trạng thái Git và tài liệu trong workspace; không thay thế kết quả chạy kiểm thử mới.

## Trạng thái hiện tại

- Dự án Inventory Support gồm app React Native/Expo tại `App/InventorySupport` và backend NestJS tại `Server/backend`.
- Nhánh hiện tại: `feature/gemini-migration`; commit gần nhất: `b2604f8` (`fixServer`). Có nhiều thay đổi và file mới chưa commit, bao gồm cả hai package-lock; cần giữ nguyên và kiểm tra diff trước khi sửa, commit hoặc hoàn tác.
- Theo `docs/AI_GEMINI_MIGRATION_REPORT.md`, các luồng AI chính đã được chuyển sang Gemini: chuẩn hóa sản phẩm, nhận diện ảnh sản phẩm/phiếu nhập và trợ lý. Backend xử lý quyền và dữ liệu kho; người dùng duyệt đề xuất trước khi ghi.
- Workspace cũng có thay đổi liên quan phiên đăng nhập, giao diện gợi ý AI, quét ảnh, sản phẩm và kiểm thử. Không suy diễn mọi thay đổi đã hoàn tất chỉ từ danh sách file.

## Bằng chứng và việc còn lại

- Báo cáo Gemini ghi nhận backend build và lint đạt, 80 unit test và 22 API test đạt với dữ liệu giả, sau đó thêm một test quota đạt; app đạt TypeScript và ESLint. Đây là kết quả được tài liệu ghi lại, chưa chạy lại trong lần cập nhật này.
- Chưa xác nhận kết nối, quota hoặc chất lượng Gemini bằng tài khoản/model thật. Checklist nghiệm thu trong báo cáo vẫn có nhiều ca chưa chạy, bao gồm ảnh/phiếu thực, một số lỗi AI và kiểm tra quyền.
- `docs/AI_NORMALIZATION_EVAL.md` chứa bộ ca đánh giá model thật và bằng chứng của giai đoạn trước; một số mô tả fallback/provider trong tài liệu đó có thể không còn khớp với hướng Gemini hiện tại. Đối chiếu mã và báo cáo Gemini trước khi dùng làm tiêu chí.
- Bước tiếp theo: xem diff và tài liệu liên quan để xác định phạm vi công việc tiếp theo; chạy kiểm thử phù hợp sau khi thay đổi. Khi cần nghiệm thu tích hợp thật, dùng key hợp lệ và số request tối thiểu; không đưa key vào repo hoặc chat.

## Tài liệu liên quan

- `docs/AI_GEMINI_MIGRATION_REPORT.md`: thiết kế, cấu hình, kết quả và checklist chuyển đổi.
- `docs/AI_ASSISTANT.md`, `docs/SCAN.md`: luồng trợ lý và quét.
- `docs/AI_NORMALIZATION_EVAL.md`: bộ ca đánh giá chuẩn hóa.
- `AGENT.md`: quy tắc dự án, ưu tiên mock để tiết kiệm quota.
