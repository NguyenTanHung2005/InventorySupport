# Kế hoạch triển khai Gemini

**Mục tiêu:** Thay các luồng Claude bằng Gemini cho chuẩn hóa văn bản, nhận diện sản phẩm, đọc phiếu nhập và trợ lý kho.

**Thiết kế:** `docs/superpowers/specs/2026-11-14-gemini-free-migration-design.md`. Giữ API nghiệp vụ và kiểm tra quyền; AI chỉ đề xuất, người dùng xác nhận trước khi lưu kho.

1. Xây dựng bộ phân loại lỗi Gemini và kiểm thử mock: giới hạn 429 không rõ loại, lỗi key, lỗi mạng và timeout. Không để lỗi key AI đăng xuất người dùng.
2. Chuyển adapter chuẩn hóa văn bản, ảnh sản phẩm và phiếu nhập sang `@google/genai`; giữ schema, kiểm tra dữ liệu và chặn response không hoàn chỉnh. Kiểm thử bằng client giả lập.
3. Chuyển session và danh sách công cụ của trợ lý sang định dạng Gemini. Giữ tool allowlist, kiểm tra quyền/cửa hàng, giới hạn phiên, vòng gọi và rollback khi thất bại.
4. Chuyển controller và `AiService` sang Gemini, bỏ fallback tự động; trả lỗi rõ ràng và duy trì kết quả nghiệp vụ mà app sử dụng.
5. Cập nhật loại provider, trạng thái, nhãn và thông báo ở app; giữ nội dung nhập và ảnh khi gặp lỗi AI, cho thử lại có chủ ý.
6. Chạy kiểm thử mock liên quan, build backend, lint/typecheck app; kiểm tra các luồng nhập/xuất, phân quyền và lỗi quota. Không tự gọi API AI thật.
7. Cập nhật README, tài liệu quét/trợ lý và báo cáo; ghi kết quả thực tế và các giới hạn chưa xác minh.

Tiến độ: phần phân loại lỗi ban đầu và hai kiểm thử mock đã được thêm; chưa nối vào các luồng AI. Các bước còn lại chưa thực hiện.
