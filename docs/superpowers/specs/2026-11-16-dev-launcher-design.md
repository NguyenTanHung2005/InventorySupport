# Chạy môi trường phát triển bằng một lệnh

Trạng thái: đề xuất, chờ người dùng duyệt.

## Mục tiêu

Tại thư mục gốc chạy `npm run dev` để khởi động backend Nest watch và Expo. Giữ Expo tương tác ở terminal hiện tại để quét QR; backend chạy nền, ghi log local và được dừng cùng launcher. Không tự cài package, seed, build APK hoặc chạy test mỗi lần mở dự án.

## Phạm vi

- Thêm package.json gốc chỉ có script dev và launcher dùng Node có sẵn, không thêm dependency.
- Backend đọc file local `Server/backend/.env` bằng cơ chế env-file của Node, không in secret hoặc đưa vào Git. Không sao chép key/URI từ chat. Kiểm tra ignore trước khi hướng dẫn tạo file; cung cấp mẫu chỉ chứa placeholder.
- Expo tiếp tục dùng `App/InventorySupport/.env.local` hiện có. IP Wi-Fi đổi vẫn cần cập nhật URL; không tự đoán adapter hoặc ghi đè cấu hình.
- Launcher kiểm tra dependency/config cần thiết, chạy đúng thư mục, báo lỗi rõ, dọn đúng cây tiến trình do mình tạo khi Ctrl+C hoặc một dịch vụ lỗi; không dừng tiến trình khác đang dùng cổng.
- Cập nhật README với thao tác cài lần đầu và lệnh chạy hằng ngày. Thêm self-check cho lifecycle launcher, không kết nối DB/AI thật khi kiểm thử.

## Giới hạn

Máy cần Node tương thích dự án và đã cài dependency trong app/backend. Atlas, Wi-Fi và cấu hình môi trường vẫn phải hợp lệ. Giữ nguyên luồng khởi động riêng hiện có để debug. Hai cửa sổ terminal riêng là phương án thay thế nếu người dùng muốn xem cả hai log trực tiếp.
