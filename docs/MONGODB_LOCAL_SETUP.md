# Chạy Inventory Support cùng Wi-Fi với MongoDB Atlas Free

Phạm vi: backend NestJS trên Windows, điện thoại gọi backend qua mạng riêng, dữ liệu Atlas và ảnh local. Chưa thực hiện build APK. Dữ liệu JSON cũ không được chuyển hoặc tự xóa.

## 1. Bạn tự setup MongoDB Atlas

1. Tạo/đăng nhập tài khoản tại https://www.mongodb.com/cloud/atlas/register và tạo project `InventorySupport`. Bạn giữ quyền sở hữu; không gửi mật khẩu/URI thật qua chat.
2. Tạo cluster mang nhãn **Free** (trước đây M0), chọn region khả dụng gần nơi dùng. Kiểm tra không chọn tier/add-on trả phí và không nạp sample dataset Atlas.
3. Trong Database Access (hoặc Database & Network Access), tạo database user riêng. Cấp `readWrite` cho database `inventory_support`. Database user khác tài khoản đăng nhập website Atlas.
4. Trong Network Access/IP access list, chọn **Add Current IP** cho mạng máy tính backend. Đây là IP public, không phải `192.168.x.x`. Khi IP public thay đổi, cập nhật danh sách; không mở mọi IP làm mặc định.
5. Chọn **Connect → Drivers → Node.js**, lấy URI. Đặt tên database `inventory_support` sau hostname; password có ký tự đặc biệt cần URL-encode. Không đưa URI vào Expo hoặc Git.
6. Có thể xem dữ liệu bằng Atlas Data Explorer sau seed; Compass là tùy chọn.

Nguồn: [Atlas setup](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/), [kết nối](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/), [giới hạn Free](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

## 2. Cài và cấu hình backend

Mở PowerShell tại `Server/backend`:

```powershell
npm install
$env:MONGODB_URI = 'mongodb+srv://<user>:<encoded-password>@<cluster>/inventory_support?retryWrites=true&w=majority'
$env:JWT_SECRET = '<chuoi-ngau-nhien-dai-rieng-cua-ban>'
$env:UPLOAD_DIR = 'D:\InventorySupportData\uploads'
```

`UPLOAD_DIR` là ví dụ, chọn thư mục có quyền ghi hoặc bỏ biến để dùng `Server/backend/uploads`. URI phải chỉ rõ database. Repo dùng biến môi trường của tiến trình; không tự nạp `.env`. Terminal mới phải cấu hình lại biến. Không ghi secret thật vào tài liệu.

Package mới: `@nestjs/mongoose ^12.0.1`, `mongoose ^9.12.1` (peer Nest 12 tương thích theo metadata chính thức). Môi trường thực hiện thay đổi này chặn registry npm nên chưa cập nhật được lockfile/cài package; **lần đầu cần `npm install` và lưu lại package-lock sinh ra**, chưa dùng `npm ci` với lock cũ. Chưa xác nhận build backend với package mới trong môi trường đó.

## 3. Seed một lần

Dừng backend trước khi seed. Bốn collection đích phải trống:

```powershell
npm run seed:demo
npm run check:demo
npm run build
npm run start:dev
```

`seed:demo` tự biên dịch scripts vào `dist-demo`. Bộ có sẵn mô phỏng 16/10–14/11/2026; muốn tạo lại một tháng kết thúc vào ngày khác:

```powershell
$env:DEMO_END_DATE = '2026-11-14'
npm run seed:demo
```

Chọn ngày kết thúc gần ngày demo để dashboard 7/30 ngày có hoạt động. Seed không nhập JSON cũ, không drop collection, không upsert dữ liệu đích có sẵn, không gửi push hoặc gọi Gemini. Script chỉ chấp nhận database `inventory_support` hoặc `inventory_support_<suffix-chu-thuong-va-so>`.

Seed kiểm tra dataset/ảnh trước, copy ảnh không ghi đè nội dung khác, rồi nhập bốn collection bằng transaction. Nếu nhập database thất bại, ảnh đã copy có thể còn; chạy lại cho phép file giống hệt. Kiểm tra collection đích trước khi chạy lại, không xóa dữ liệu khi chưa biết nguyên nhân. Report `demo-seed-report.json` chỉ chứa thời điểm và số lượng, không chứa secret.

Đăng nhập với mật khẩu demo chung `MiniMart123!`:

| Email | Role |
| --- | --- |
| `admin@minimart.example` | ADMIN |
| `manager@minimart.example` | MANAGER |
| `staff1@minimart.example`, `staff2@minimart.example`, `staff3@minimart.example` | STAFF |
| `viewer@minimart.example` | VIEWER |

Các tài khoản này chỉ dành cho demo mạng riêng. Sau seed, kiểm tra Data Explorer có `users`, `products`, `transactions`, `notifications` và ảnh `/uploads/store-1/product-demo-001.png` mở được.

## 4. Kết nối điện thoại cùng Wi-Fi

1. Máy tính/điện thoại cùng mạng private; không dùng guest Wi-Fi cô lập thiết bị. Máy tính phải bật và backend đang chạy.
2. Chạy `ipconfig`, lấy IPv4 adapter Wi-Fi, ví dụ `192.168.1.20`. Backend hiện listen `0.0.0.0`, mặc định port 3000.
3. Trong Windows Defender Firewall with Advanced Security, tạo Inbound Rule port TCP 3000, chỉ Private profile và phạm vi Local subnet. Không tắt toàn bộ firewall hoặc forward port router ra Internet.
4. Mở trình duyệt điện thoại: `http://192.168.1.20:3000/health`. Endpoint này kiểm tra server sống, không chứng minh mọi truy vấn database đang thành công; thử đăng nhập/danh sách sản phẩm để kiểm database.
5. Khi chạy app qua Expo trên cùng mạng LAN, app tự lấy IP máy chạy Expo qua `Constants.expoConfig.hostUri` và dùng port 3000. Để `EXPO_PUBLIC_API_URL` trống/không khai báo trong `.env.local`, các file `.env` khác và terminal; giá trị cố định sẽ ghi đè cơ chế tự nhận diện. Sau khi đổi mạng, khởi động lại Expo và quét QR mới:

```powershell
# Terminal khác, tại App/InventorySupport
Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue
npm run start -- --lan --clear
```

Không dùng `localhost` trên điện thoại. Nếu IP máy tính đổi, cập nhật URL và khởi động lại/bundle app; có thể đặt DHCP reservation trên router bạn quản lý. Cấu hình HTTP của APK release sẽ làm ở giai đoạn APK, hiện chưa nghiệm thu.

## 5. AI và ảnh

Chỉ bật AI nếu cần, đặt `GEMINI_API_KEY` và tùy chọn `AI_MODEL` trên backend. Kho thủ công dùng được khi không có key; chức năng AI báo chưa cấu hình. Không cần gọi Gemini để seed. Quota/chi phí Gemini và push độc lập với Atlas Free.

Database chỉ chứa đường dẫn ảnh tương đối. Ảnh local được phục vụ tĩnh, không yêu cầu JWT; dùng ảnh sản phẩm demo, không đặt dữ liệu nhạy cảm vào uploads. Mất Internet tới Atlas thì API báo lỗi; không có fallback JSON/offline.

## 6. Kiểm tra và khắc phục

- `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`.
- Nếu Vitest lỗi `spawn EPERM` khi đọc config trong sandbox: `node node_modules/vitest/vitest.mjs run --configLoader native --pool=threads`; E2E thêm `--config vitest.config.e2e.ts`.
- Real Mongo test: đặt `MONGODB_TEST_URI` cho một test deployment có replica set và user có quyền tạo/xóa database test, rồi `npm run test:mongo`. Test tạo database `inventory_support_test_<random>` riêng và chỉ xóa database tự tạo đó khi kết thúc. Không cấp quyền rộng cho user app chỉ để test; dùng user test riêng hoặc replica set local.
- Thiếu URI: backend dừng cấu hình thay vì tạo tài khoản/dữ liệu demo tự động.
- Connection timeout: kiểm IP access list, Internet, database user, password URL-encode và quyền đúng database.
- Transaction lỗi: kiểm deployment hỗ trợ transaction (replica set), quyền user và kết nối. Không chạy integration transaction trên standalone mongod.
- Điện thoại không vào backend: kiểm IP, port, firewall Private, router isolation/VPN; không dùng IP public của Atlas làm API URL.
- Ảnh lỗi: kiểm cùng `UPLOAD_DIR` giữa seed và server, file tồn tại, URL LAN và quyền đọc thư mục.

## 7. Sao lưu và reset

Dừng ghi dữ liệu; dùng MongoDB Database Tools `mongodump` tạo backup database, đồng thời copy toàn bộ UPLOAD_DIR. Dùng URI qua biến môi trường, không lưu secret vào script hoặc chia sẻ log chứa URI. Thử `mongorestore` vào database demo khác, đối chiếu và mở ảnh trước khi tin cậy backup. Không giả định tier Free có đủ mọi tính năng backup tự động.

Muốn bộ demo sạch: chọn database demo tên mới và quyền phù hợp, hoặc chủ động xóa đúng database demo qua Atlas sau khi kiểm tên và chắc chắn không cần dữ liệu. Script không tự reset hoặc xóa database cũ. JSON cũ còn trên máy nhưng ứng dụng không đọc nữa.
