# Kết nối backend qua ngrok

URL hiện dùng: **https://defeat-city-childless.ngrok-free.dev**.
Ngrok forward tới backend laptop cổng 3000; API và ảnh `/uploads/...` dùng cùng hostname.
Không cần cùng Wi-Fi với laptop khi điện thoại có Internet và tunnel đang hoạt động.

## Cấu hình đã có trong project

- `App/InventorySupport/.env.local`: URL cho Expo local; Git bỏ qua file này.
- `App/InventorySupport/eas.json`: profile `preview` dùng cùng URL HTTPS và tạo APK.
- `App/InventorySupport/app.json`: Android package `com.inventorysupport.app`.
- Giữ nguyên `API_URL`, request helper, resolver ảnh, API/backend và npm dependency.
  HTTPS ngrok không cần thêm cấu hình cho cleartext HTTP trên Android.

Khi clone repo, tạo `.env.local` trong thư mục app nếu muốn dùng ngrok khi chạy Expo:

```dotenv
EXPO_PUBLIC_API_URL=https://defeat-city-childless.ngrok-free.dev
```

Domain là địa chỉ public, không phải secret. Authtoken ngrok, URI MongoDB, JWT secret
và mật khẩu không đưa vào eas.json, app.json hoặc frontend.

## Chạy mỗi lần demo

Terminal backend:

```powershell
cd D:\SE_Nam4\ReactNative\Project\InventorySupport\Server\backend
node --env-file=.env node_modules/@nestjs/cli/bin/nest.js start --watch
```

Terminal ngrok (đã cài và lưu authtoken trên máy):

```powershell
ngrok http 3000
```

Kiểm `Forwarding` đúng domain trên và đúng localhost:3000. Giữ cả hai terminal chạy.
Ngrok CLI/token được cấu hình ngoài repo; không cài ngrok npm SDK.

Khi thử bằng Expo, mở thêm terminal app:

```powershell
cd D:\SE_Nam4\ReactNative\Project\InventorySupport\App\InventorySupport
npx expo start --lan --clear
```

Restart Expo sau khi đổi `.env.local`. Nếu terminal đang có EXPO_PUBLIC_API_URL khác,
dùng terminal mới hoặc bỏ biến cũ; biến môi trường có thể ghi đè file local.
Màn đăng nhập phải hiển thị URL HTTPS ngrok, không phải IP Wi-Fi/10.0.2.2.
Với APK preview sau khi build, không cần Metro/Expo Go; vẫn cần backend và ngrok.

## Kiểm tra kết nối

- `/health` trả JSON `status: "ok"` và thời gian, không chỉ HTTP 200/trang HTML.
- `/products` không có JWT phải bị chặn 401; đăng nhập đúng tài khoản để xem hàng.
- Ảnh phải tải từ cùng domain, trả `image/*`, không phải trang cảnh báo HTML.
- Thử trên điện thoại: đăng nhập, danh sách/ảnh, lịch sử và đọc phiên kiểm kê.
- Thử restart tunnel/đổi Wi-Fi laptop: domain không đổi, chờ tunnel/Atlas nối lại rồi tải lại app.
  Điện thoại có thể dùng Wi-Fi khác hoặc 4G/5G. Có gián đoạn trong lúc chuyển mạng.
- Ngắt mạng khi thao tác ghi kho: kiểm lịch sử trước khi retry để tránh ghi trùng;
  ngrok không bổ sung idempotency cho API kho thông thường.

Đã kiểm bằng request từ máy ngày 16/11/2026: health 200 JSON; products không token 401;
một ảnh runtime 200 JPEG và SHA-256 khớp nguồn. Chưa kiểm đăng nhập trên điện thoại,
restart/ngắt tunnel, chuyển Wi-Fi, hoặc APK thực tế. Không thêm skip-warning header
dự phòng vì các request đã kiểm không gặp trang trung gian.

## Tài khoản và cấu hình backend trước khi dùng Internet

Backend đọc JWT_SECRET từ môi trường, mặc định là chuỗi development nếu không đặt.
Kiểm tra trong terminal chạy server hoặc cấu hình `.env` local có JWT_SECRET riêng;
giữ giá trị ổn định giữa các lần chạy. Đổi khóa làm JWT hiện có không còn hợp lệ.
Đổi mật khẩu tài khoản demo đang được công bố bằng chức năng đổi mật khẩu/quản trị sẵn có;
không đặt mật khẩu mới vào hằng DEMO_PASSWORD của frontend. Chưa xác minh các cấu hình
credential của terminal backend từ quá trình kiểm URL, không suy ra chúng đã an toàn chỉ
vì health hoạt động. Ảnh tĩnh hiện công khai theo URL như thiết kế backend cũ.

## Build APK sau khi kiểm Expo

Trong thư mục app, dùng tài khoản Expo của người dùng:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

Giữ profile preview và URL trong eas.json khi EAS thêm projectId/cấu hình khác.
Kiểm môi trường EAS không có URL khác ghi đè. File .env.local không được coi là nguồn
cấu hình bảo đảm cho cloud build. Giữ cùng Android package/keystore khi cập nhật.
Build ra APK để cài trực tiếp; chưa thực hiện login hoặc gửi build từ bước cấu hình ngrok.

## Giới hạn và quay lại LAN

Laptop cần thức, backend/ngrok đang chạy và Internet hoạt động; ngrok không thay hosting.
Nếu Atlas chặn public IP mạng mới, cập nhật đúng Network Access Atlas riêng, không mở
mọi IP như cách xử lý mặc định. Gói ngrok có quota, cả ảnh và polling 30 giây đều tiêu thụ.

Dev domain thuộc tài khoản; nếu đổi/xóa domain hoặc tài khoản, phải cập nhật URL và build lại
APK theo cấu hình hiện tại. Không tự đặt tên domain bất kỳ trên free account.

Quay về Expo LAN: bỏ EXPO_PUBLIC_API_URL trong .env.local và terminal, restart Expo;
resolver hiện có sẽ dùng host Metro. Điều này không thay URL đã đóng trong APK trước đó.

Nguồn: [ngrok quickstart](https://ngrok.com/docs/share-localhost/quickstart),
[domain/quota/interstitial](https://ngrok.com/docs/pricing-limits/free-plan-limits),
[APK Expo](https://docs.expo.dev/build-reference/apk/).
