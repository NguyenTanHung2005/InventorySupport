# Quy tắc làm việc cho Đồ án Môn học

## 1. Bối cảnh dự án (Project Clone)
- Đây là mã nguồn có sẵn được clone từ Git để phát triển và bổ sung tính năng mới.
- **Tuyệt đối không** tự ý tái cấu trúc (refactor) toàn bộ cấu trúc thư mục cũ nếu không được yêu cầu.
- Mọi tính năng mới phải bám sát phong cách code, đặt tên biến và kiến trúc hiện có của repo.

## 2. Quy trình phối hợp Skills (Superpowers + Ponytail)
- **Giai đoạn lên kế hoạch (Superpowers):** Trước khi sửa hoặc thêm chức năng mới, luôn dùng kỹ năng `$brainstorming` hoặc `$writing-plans` để phân tích yêu cầu, liệt kê các file cần sửa và chờ xác nhận.
- **Giai đoạn viết code (Ponytail):** Luôn duy trì chế độ `$ponytail:ponytail full`. Viết code ngắn gọn, dễ hiểu, ưu tiên thư viện/hàm có sẵn, không tạo thêm các lớp trừu tượng (abstraction) hoặc design pattern phức tạp không cần thiết cho quy mô đồ án.

## 3. Quy định chấm điểm của môn học (Tùy chỉnh theo đề bài)
- **Ngôn ngữ / Framework bắt buộc:** React native cho phần front-end và nestjs cho phần backend
- **Kiểm thử trước khi hoàn thành:** Sau khi viết xong một tính năng, luôn chạy `$ponytail:ponytail-review` để loại bỏ code thừa và kiểm tra lại xem tính năng cũ có bị ảnh hưởng không.

## 4. Tiết kiệm token và kiểm thử AI
- Hạn chế gọi các dịch vụ AI thật khi phát triển và kiểm thử để tiết kiệm token và hạn mức miễn phí. Ưu tiên mock hoặc dữ liệu mẫu cho các trường hợp thành công và lỗi.
- Chỉ chạy những kiểm thử cần thiết, phù hợp với phần thay đổi; tránh chạy lặp lại hoặc chạy toàn bộ bộ kiểm thử khi không có lý do cụ thể.
- Khi cần xác nhận tích hợp AI thật, dùng số lượng yêu cầu tối thiểu và dữ liệu ngắn; thông báo rõ nếu chưa thể xác nhận bằng API thật.
