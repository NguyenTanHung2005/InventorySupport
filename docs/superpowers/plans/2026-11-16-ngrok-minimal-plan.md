# Ngrok Minimal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Thực hiện tuần tự, không cần đội agent cho thay đổi cấu hình này.

**Goal:** Dùng URL HTTPS ngrok ổn định cho Expo/APK để đổi Wi-Fi không cần sửa IP.

**Architecture:** Ngrok CLI chạy ngoài repo, forward tới backend localhost:3000. App dùng EXPO_PUBLIC_API_URL hiện có cho cả API và ảnh; không thêm discovery hoặc proxy. EAS preview đóng cùng URL vào APK.

**Tech Stack:** Expo SDK 57/React Native hiện có, NestJS 12, ngrok CLI Windows, EAS CLI khi build APK.

**Spec:** [Thiết kế ngrok tối giản](../specs/2026-11-16-ngrok-minimal-design.md).

## Trạng thái triển khai 16/11/2026

- [x] Domain thật: https://defeat-city-childless.ngrok-free.dev; health JSON, products không token 401, một ảnh HTTP 200 image/jpeg và hash nguồn đạt. Không cần skip-warning header.
- [x] .env.local và eas.json preview cùng URL; app.json chỉ thêm android.package. Không thêm TS/JS/dependency. Config check, Expo public config, app TypeScript/lint và diff --check đạt.
- [x] docs/NGROK_SETUP.md và README hướng dẫn chạy, cấu hình, giới hạn và quay lại LAN.
- [ ] User xác nhận JWT secret/đổi mật khẩu demo trong môi trường đang chạy; .env hiện chưa có JWT_SECRET nhưng terminal có thể đã đặt. Không tự thay credential.
- [ ] Đăng nhập/ảnh trên điện thoại và thử restart/ngắt tunnel/đổi Wi-Fi.
- [ ] EAS login/build APK và nghiệm thu APK thực tế; chưa gửi build hoặc tạo keystore.

Các checklist chi tiết bên dưới giữ nguyên để theo dõi các bước kiểm chưa thực hiện;
không coi chỉ cấu hình đúng URL là đã nghiệm thu APK hoặc chuyển mạng.

## Global Constraints

- Mặc định không sửa file TypeScript/JavaScript và không thêm npm dependency.
- Giữ backend, MongoDB, UPLOAD_DIR, tài khoản và dữ liệu nghiệp vụ hiện tại.
- Ngrok authtoken/JWT_SECRET/password/Mongo URI chỉ nằm local; chỉ URL public được đặt trong eas.json.
- Dùng domain HTTPS thật do tài khoản được cấp, không build placeholder hoặc URL IP LAN.
- Không thêm usesCleartextTraffic, mDNS, màn nhập IP, ngrok SDK hoặc script launcher.
- Không mở tunnel trước khi user kiểm JWT secret/mật khẩu demo; không thay credential thay user khi chưa được yêu cầu.
- Build/cloud login là thao tác ngoài repo, chỉ thực hiện khi được yêu cầu; kế hoạch hiện tại chưa thực thi.

## Review Focus

1. Domain sau restart hoặc đổi Wi-Fi không đổi — kiểm thực tế ở Task 1/3.
2. HTTP 200 nhưng body là HTML cảnh báo — kiểm JSON health và Content-Type ảnh ở Task 1.
3. API đúng domain nhưng ảnh còn trỏ IP cũ — kiểm URL ảnh thực và hiển thị ở Task 2.
4. Cloud build không đọc .env.local hoặc lấy URL môi trường khác — kiểm eas.json và URL trên màn login APK ở Task 3.
5. Ngắt mạng giữa thao tác kho làm người dùng retry và ghi lặp — Task 2 chỉ thử đọc/health khi mô phỏng ngắt; tài liệu nhắc kiểm lịch sử, không thêm idempotency mới.

## Task 1: Ngrok CLI, domain và đường truy cập backend

**Files:** tạo docs/NGROK_SETUP.md; cập nhật README.md mục kết nối. Cấu hình token ngrok do user thực hiện ngoài repo.

**Interfaces:** consumes backend /health → `{status:'ok',time:string}`, API JWT và ảnh `/uploads/...` hiện có; produces một URL `https://<domain-thật>` không có port/path/trailing slash.

- [ ] Đọc spec; kiểm `ngrok version`. Expected: phiên bản CLI hợp lệ; hiện khảo sát chưa có ngrok trong PATH. Nếu thiếu, hướng dẫn user cài CLI Windows chính thức và tự cấu hình authtoken, không thêm npm package.
- [ ] User kiểm JWT_SECRET riêng, đổi password demo công khai nếu cần; giữ UPLOAD_DIR. Không in giá trị secret hoặc gửi vào report.
- [ ] Từ Server/backend, chạy `node --env-file=.env node_modules/@nestjs/cli/bin/nest.js start --watch`. Ở terminal khác chạy `ngrok http 3000`. Expected: backend startup không lỗi; ngrok Forwarding HTTPS về đúng port 3000.
- [ ] Ghi lại domain public thật; GET `<URL>/health`. Expected: JSON `status='ok'` và `time` ISO, không phải HTML. Kiểm local health tương đương khi cần chẩn đoán.
- [ ] Đăng nhập bằng app/tài khoản đã đổi mật khẩu; yêu cầu sản phẩm có token thành công, không token trả 401. Không in JWT/password.
- [ ] Lấy URL tương đối của một sản phẩm, mở `<URL>/uploads/...`. Expected: HTTP 200 và Content-Type image/*, nội dung file ảnh thật.
- [ ] Dừng/bật lại ngrok một lần. Expected: cùng domain public và health hoạt động trở lại; chưa cần thay app. Nếu domain đổi, xử lý đúng account/dev domain trước Task 2.
- [ ] Viết docs/NGROK_SETUP.md: cài/token một lần, hai terminal lúc demo, URL public, kiểm health/ảnh, quota, giữ máy thức, xử lý Atlas đổi IP. Không đưa token/mật khẩu thật vào ví dụ.

## Task 2: App Expo dùng URL ngrok, không sửa logic request

**Files:** sửa App/InventorySupport/.env.local (Git bỏ qua); docs/NGROK_SETUP.md và README.md.

**Interfaces:** consumes URL thật từ Task 1; existing `API_URL: string`, `request<T>(path, options)`, `resolveImageUrl(path?:string)` tiếp tục giữ nguyên; produces cấu hình local đã được thử nghiệm.

- [ ] Đặt `EXPO_PUBLIC_API_URL=https://<domain-thật>` trong .env.local; loại biến terminal cũ nếu nó ghi đè file. Không ghi port 3000 hoặc /api sau domain.
- [ ] Trong thư mục app chạy `npx expo start --lan --clear`. Expected: màn đăng nhập hiển thị đúng hostname HTTPS; không hiển thị 10.0.2.2/IP Wi-Fi cho API.
- [ ] Trên điện thoại, đăng nhập, mở danh sách và ảnh, lịch sử và một phiên kiểm kê để đọc dữ liệu. Expected: đúng dữ liệu/quyền; ảnh dùng cùng domain, không sửa ProductImage nếu đang hoạt động.
- [ ] Kiểm ngắt/bật ngrok bằng health hoặc màn chỉ đọc. Expected: lỗi kết nối rõ ràng, sau phục hồi tải lại thành công, không sinh giao dịch kho mới. Không tự thử retry thao tác xuất để “kiểm tra mạng”.
- [ ] Chạy `npm run lint -- --no-cache` và `npx tsc --noEmit` trong app. Expected: exit 0; nếu baseline khác, ghi nhận nguyên nhân trước khi sửa.
- [ ] Xác nhận diff không có thay đổi TS/JS/dependency. Nếu gặp interstitial thực, dừng Task 3, ghi request/body/content-type đã khử secret; chỉ lập bản sửa tối thiểu cho luồng lỗi sau chẩn đoán, không thêm header hàng loạt dự phòng.

## Task 3: Cấu hình APK và nghiệm thu chuyển mạng

**Files:** tạo App/InventorySupport/eas.json; sửa App/InventorySupport/app.json chỉ android.package nếu thiếu; cập nhật docs/NGROK_SETUP.md.

**Interfaces:** consumes cùng domain đã kiểm Task 1/2; produces preview APK build config, có thể build độc lập Metro khi được user yêu cầu.

- [ ] Thêm profile preview: distribution=internal, environment=preview, android.buildType=apk, env.EXPO_PUBLIC_API_URL=URL thật. Giữ profile EAS khác nếu có; không thêm developmentClient.
- [ ] app.json: android.package=`com.inventorysupport.app` nếu chưa có; giữ icon, permissions, plugin và version hiện có. Giữ identifier ổn định sau cài bản đầu.
- [ ] Chạy check cấu hình trong thư mục app:

```powershell
node -e "const fs=require('fs'),a=require('node:assert/strict');const p=JSON.parse(fs.readFileSync('eas.json')).build.preview;const u=new URL(p.env.EXPO_PUBLIC_API_URL);a.equal(p.android.buildType,'apk');a.equal(p.distribution,'internal');a.equal(p.environment,'preview');a.equal(u.protocol,'https:');a(!u.href.includes('<'));a.equal(u.pathname,'/');a(!u.port);a.equal(JSON.parse(fs.readFileSync('app.json')).expo.android.package,'com.inventorysupport.app');console.log('APK configuration passed');"
```

Expected: `APK configuration passed`, exit 0; đối chiếu host bằng domain Task 1. Kiểm môi trường EAS không có URL khác ghi đè. Đây là check cấu hình, không thêm unit test mô phỏng schema.

- [ ] Khi user yêu cầu build và đăng nhập EAS: `npx eas-cli@latest login`, `npx eas-cli@latest build:configure`, kiểm các cấu hình EAS vừa tạo vẫn giữ profile trên, rồi `npx eas-cli@latest build --platform android --profile preview`. Expected: build ra APK, không AAB; không gửi credential trong chat.
- [ ] Cài APK, không bật Metro/Expo Go. Đăng nhập, tải ảnh trên điện thoại dùng 4G/5G hoặc mạng khác laptop. Expected: URL HTTPS đúng domain, API và ảnh hoạt động.
- [ ] Đổi Wi-Fi/hotspot laptop; kiểm Atlas vẫn kết nối, đợi tunnel nối lại hoặc chạy lại ngrok. Expected: cùng APK/URL vẫn dùng được sau phục hồi, không build lại vì IP LAN đổi. Không coi gián đoạn trong lúc chuyển mạng là ghi kho thất bại.
- [ ] Cập nhật hướng dẫn: APK không cần Expo; laptop vẫn bật backend+ngrok; domain/quota phụ thuộc tài khoản; nếu đổi domain thì phải cập nhật build.

## Hoàn tất và giới hạn kiểm chứng

- [ ] Rà diff và link tài liệu; `git diff --check`; xác nhận không có credential trong file tracked, không có thay đổi nghiệp vụ/dữ liệu.
- [ ] Ghi rõ các bước thật đã chạy (ngrok/API/ảnh/APK/chuyển mạng); không tuyên bố nghiệm thu APK nếu mới chỉ thử Expo.
- [ ] Không commit/push hoặc bật endpoint public ngoài phạm vi user đã yêu cầu.

Self-review: đã đối chiếu đường dùng URL trong config/request/ảnh/health; mỗi rủi ro có bước kiểm.
Phần còn cần user cung cấp khi triển khai là domain public đã cấp, không phải authtoken.
