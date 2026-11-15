# Thiết kế MongoDB Atlas Free, APK cùng Wi-Fi và bộ mẫu siêu thị mini

Ngày: 15/11/2026. Trạng thái: bản thiết kế chờ người dùng duyệt, chưa triển khai.

## 1. Mục tiêu và các quyết định

Người dùng chọn APK Android truy cập backend NestJS trên máy tính Windows cùng Wi-Fi, dữ liệu trên MongoDB Atlas Free, ảnh lưu trên máy tính. Bộ dữ liệu mô phỏng một siêu thị mini nhỏ, một tháng hoạt động, có đầy đủ ảnh. Người dùng không cần giữ hoặc chuyển dữ liệu JSON cũ.

Nguồn nghiệp vụ: `NghiepVu.md`, `docs/AI_ASSISTANT.md`. Giữ bốn vai trò ADMIN/MANAGER/STAFF/VIEWER; kiểm kê ADJUSTMENT trực tiếp, không có phiên phân công/phê duyệt. App giữ hợp đồng API hiện tại. Đây là thay đổi lưu trữ và đóng gói chạy thật, không tái cấu trúc toàn repo.

Các đề xuất của người thiết kế, chưa phải lựa chọn riêng đã được người dùng xác nhận: 60 sản phẩm, 6 tài khoản, 30 ngày gần nhất kết thúc vào hôm qua tại thời điểm tạo mẫu; 60 ảnh PNG minh họa nguyên gốc; build APK tại Windows bằng Android SDK/Gradle để không phụ thuộc quota cloud build. Các mục này được xem xét cùng bản thiết kế.

## 2. Các phương án đã cân nhắc

| Phương án | Ưu điểm | Đánh đổi | Kết luận |
| --- | --- | --- | --- |
| Backend máy tính + Atlas Free + ảnh local | Ít dịch vụ, tái sử dụng uploads hiện có, không thuê backend/ảnh | Máy tính phải bật, điện thoại cùng LAN, backend vẫn cần Internet tới Atlas | Người dùng đã chọn |
| Backend cloud miễn phí + Atlas + dịch vụ ảnh | Điện thoại truy cập từ xa | Thêm tài khoản, giới hạn dịch vụ, cold start và cấu hình lưu ảnh | Để sau |
| MongoDB và backend đều trên máy tính | Không cần Atlas để chạy, có thể độc lập Internet cho dữ liệu | Không đáp ứng mục tiêu quản lý dữ liệu Atlas, thêm việc vận hành MongoDB | Không chọn |

Ảnh local được đóng gói cùng seed, không hotlink website. Chưa cần Cloudinary/S3/GridFS. Dữ liệu cũ không migrate; không cần viết script chuyển JSON. Không tự xóa file cũ trong bước thiết kế hoặc seed.

## 3. Công nghệ

| Thành phần | Sử dụng | Lý do/phạm vi |
| --- | --- | --- |
| App | React Native, Expo, TypeScript hiện có | Tiếp tục UI và service hiện tại |
| Điều hướng/xác thực | React Navigation, store hiện tại, expo-secure-store | Không đổi hợp đồng đăng nhập |
| Backend | NestJS 12, TypeScript ESM, Express hiện có | Giữ module nghiệp vụ, guard, validation |
| Database | MongoDB Atlas Free | Dịch vụ quản lý database cloud cho demo |
| ODM | `@nestjs/mongoose` + `mongoose` | Schema/index, truy vấn bất đồng bộ, session transaction |
| ID / thời gian | `_id` chuỗi, ISO UTC string | API tiếp tục trả `id`, timestamps string như hiện tại |
| Ảnh | File PNG/JPG/WebP local, cơ chế uploads hiện tại | Backend phục vụ URL tương đối, không lưu base64 vào MongoDB |
| Dữ liệu mẫu | Script TypeScript + bộ manifest/ảnh được đóng gói | Sinh nhất quán và có thể kiểm chứng, không gọi AI để tạo lịch sử |
| Tạo ảnh minh họa | PowerShell/.NET System.Drawing trên Windows | Tạo 60 PNG nguyên gốc từ hình khối, màu và nhãn, không cần dịch vụ ảnh trả phí |
| Build Android | JDK/Android SDK, Expo prebuild, Gradle | APK cài trực tiếp, build tại máy Windows |
| Kiểm thử | Vitest/Supertest hiện có + MongoDB test replica set | Kiểm chứng nghiệp vụ thực với transaction |

Chọn phiên bản Mongoose tương thích NestJS 12 qua peerDependencies, không cài phiên bản suy đoán. Trước build chạy kiểm tra tương thích Expo/dependencies hiện có; giải quyết lỗi bắt buộc cho APK, không nâng cấp hàng loạt ngoài phạm vi. Không thêm Passport, Swagger hoặc hệ validation khác.

Atlas Free có giới hạn dung lượng/tài nguyên; kiểm tra giới hạn tại thời điểm tạo. Mục tiêu bộ mẫu nhỏ hơn 20 MB dữ liệu và index, ảnh tổng dưới 30 MB, không phải cam kết dung lượng đo được trước khi sinh.

## 4. Luồng kết nối và hoạt động

### 4.1. Đăng nhập/đọc dữ liệu

Điện thoại mở APK → gọi `http://<IP-LAN-máy-tính>:3000` → NestJS kiểm tra JWT/tài khoản → service truy vấn Atlas qua TLS → trả JSON → app hiển thị. Tài khoản Atlas và URI chỉ ở máy backend, không đưa vào APK. Không dùng `localhost` của điện thoại làm địa chỉ backend.

Backend phải đang chạy và có Internet. Điện thoại phải liên lạc được tới máy tính qua LAN; cùng tên Wi-Fi chưa đủ nếu router bật client isolation/guest isolation. Nếu mất Internet tới Atlas, app báo lỗi backend/database; không tự quay lại file JSON hay giả vờ đã lưu offline.

### 4.2. Ảnh

Ảnh seed được copy vào `<UPLOAD_DIR>/store-1/`, sản phẩm lưu `/uploads/store-1/<file>.png`. App ghép URL bằng `resolveImageUrl`. Ảnh người dùng upload tiếp tục theo `POST /uploads/image` và validation hiện tại. Đổi IP backend không đổi đường dẫn đã lưu trong database.

Ảnh được phục vụ tĩnh và hiện không yêu cầu JWT, nên dùng ảnh sản phẩm mẫu, không lưu ảnh nhạy cảm. Không mở port router ra Internet trong phương án LAN. Sao lưu cả database và thư mục ảnh.

### 4.3. Nhập/xuất/kiểm kê

Người dùng chọn loại/sản phẩm/số lượng → xác nhận → guard và service kiểm quyền → mở session transaction → đọc sản phẩm theo cửa hàng → cập nhật tồn có điều kiện và ghi lịch sử/cảnh báo cùng session → commit → gửi push sau commit → trả kết quả.

IMPORT/EXPORT nhận số nguyên dương; EXPORT không vượt tồn. ADJUSTMENT nhận số thực đếm nguyên không âm và lý do, lịch sử lưu chênh lệch. Batch cùng loại, tối đa 200 dòng, không trùng sản phẩm, thành công toàn bộ hoặc rollback toàn bộ.

Dùng cập nhật có điều kiện/transaction để hai lần xuất cạnh tranh không làm âm tồn; kiểm kê cạnh tranh phải phát hiện write conflict và retry transaction với dữ liệu mới. Không chạy các thao tác song song trong một session transaction. Không gửi push trong callback có thể retry. Lỗi push sau commit không biến giao dịch đã lưu thành thất bại hoặc gây gửi lại kho.

Không tự thêm tính năng idempotency toàn API trong thiết kế này: khi response bị mất sau commit, người dùng cần đối chiếu lịch sử trước khi gửi lại. Khóa nút chỉ bảo vệ việc bấm lặp trong app.

### 4.4. AI

Giữ luồng trong `docs/AI_ASSISTANT.md`: Gemini hỗ trợ trích thông tin/tra công cụ/đề xuất, con người xác nhận và API nghiệp vụ mới ghi. Tất cả tools, controller, confirm action và caller phải nhận/await kết quả truy vấn MongoDB. Confirm chỉ đối chiếu giao dịch thật, không ghi lần hai.

Phiên AI vẫn trong RAM. Backend restart mất phiên nhưng dữ liệu kho trong Atlas còn nguyên. AI không thuộc bảo đảm miễn phí của database: cần key/quota Gemini riêng; seed không gọi Gemini.

## 5. Mô hình bốn collection

| Collection | Trường |
| --- | --- |
| `users` | `_id`, `storeId`, `name`, `email`, `passwordHash`, `role`, `active`, `pushTokens`, `createdAt`, `updatedAt` |
| `products` | `_id`, `storeId`, `barcode`, `name`, `normalizedName`, `description`, `category`, `unit`, `price`, `costPrice`, `supplier`, `minStock`, `quantity`, `imageUrl?`, `createdAt`, `updatedAt`, `deletedAt?` |
| `transactions` | `_id`, `storeId`, `productId`, `productName`, `type`, `quantity`, `quantityBefore`, `quantityAfter`, `reason?`, `createdBy`, `createdByName`, `createdAt` |
| `notifications` | `_id`, `storeId`, `type`, `productId`, `title`, `message`, `readBy`, `createdAt` |

`_id` giữ dạng `product-…`/`user-…` để tránh thay đổi caller. Serializer trả `id`, loại `_id`/`__v`; public user loại passwordHash/pushTokens. Không phụ thuộc Mongoose virtual mặc định cho kết quả lean. Giữ timestamp ISO UTC string có validation, không bật timestamps BSON Date rồi vô tình đổi kiểu API.

Index: email unique toàn hệ thống (trim/lowercase); products `(storeId, barcode)` unique; products `(storeId, deletedAt)`; transactions `(storeId, createdAt desc)` và `(storeId, productId, createdAt desc)`; notifications `(storeId, createdAt desc)`. Giữ cách xóa mềm đổi barcode hiện tại để giải phóng mã. Mongoose validate phải tương thích các giới hạn đang có, không tự đổi quy tắc số tiền thành quy tắc mới.

Giữ `category`/`supplier` chuỗi và tồn ở `products.quantity`; chưa tạo stores/categories/suppliers/inventory_balances/stocktake_sessions. MongoDB không tự bảo đảm foreign key; service và seed phải kiểm tham chiếu và storeId.

Tìm kiếm phải giữ bỏ dấu và barcode variants; có thể dùng truy vấn có giới hạn theo store và xử lý match hiện có cho tập mẫu nhỏ. Không thay bằng regex thường hoặc text index nếu làm mất hành vi; quyết định tối ưu tìm kiếm lớn được để cho builder sau khi đo.

## 6. Bộ dữ liệu một tháng kèm ảnh

Đề xuất cụ thể: cửa hàng `store-1`, tên mô phỏng “Mini Mart An Nhiên”; 60 sản phẩm chia 6 nhóm, mỗi nhóm 10: đồ uống, sữa, mì/thực phẩm khô, bánh kẹo, gia vị, vệ sinh/gia dụng. Tên hàng mô phỏng và thương hiệu hư cấu, không dùng barcode ngẫu nhiên rồi tuyên bố là mã thương mại thật.

6 tài khoản: 1 ADMIN, 1 MANAGER, 3 STAFF hoạt động và 1 VIEWER. Email miền `.example`, mật khẩu demo cung cấp trong hướng dẫn local và băm bằng helper scrypt hiện có; pushTokens ban đầu rỗng. Không tạo token Expo giả hoặc gửi push khi seed.

- Khoảng thời gian: 30 ngày trọn vẹn kết thúc hôm qua, ngày theo Asia/Ho_Chi_Minh, lưu UTC. Cho phép chọn ngày kết thúc khi seed để tái lập cùng bộ mẫu.
- Sự kiện ngày đầu gồm nhập tồn ban đầu cho cả 60 sản phẩm, sau đó hoạt động mỗi ngày, tổng mục tiêu khoảng 600 giao dịch. Kết quả chính xác và seed ngẫu nhiên cố định được ghi vào báo cáo sinh dữ liệu.
- Sinh theo thứ tự thời gian, không xuất vượt tồn; điều chỉnh có lý do và người có quyền. Tồn cuối phải đúng chuỗi trước/sau và tổng biến động từ 0.
- Có sản phẩm bán nhanh, chậm, nhiều lần nhập bổ sung; cuối kỳ có ít nhất 5 sản phẩm sắp hết và 3 hết hàng, các sản phẩm còn lại có tồn bình thường. Cảnh báo sinh đúng khi vượt ngưỡng, readBy có cả trạng thái đã/chưa đọc.
- Không giả lập phiên kiểm kê, đơn bán hàng hoặc công nợ chưa có mô hình. Doanh thu demo vẫn tính theo công thức hiện hành.
- Mỗi sản phẩm có một PNG 512×512 nguyên gốc: hình dáng bao bì theo nhóm, màu phân biệt và nhãn tên/quy cách. Bàn giao đầy đủ 60 file, manifest ánh xạ ID/tên/path và README nguồn ảnh “tự tạo minh họa”. Chỉ có placeholder chung không đạt yêu cầu.
- Tạo thêm 3 ảnh phiếu nhập minh họa PNG với dòng hàng và số lượng khớp catalog, cùng file đáp án JSON; đây là fixture demo OCR, không bảo đảm model đọc đúng mọi chữ.
- Barcode demo duy nhất và có nhãn QR từ helper hiện có; có thể bổ sung sheet nhãn để thử quét. Không dùng mã demo làm barcode GTIN được chứng nhận.

Ảnh minh họa phù hợp danh sách/chi tiết và kiểm tra đường dẫn upload. Đánh giá vision trên bao bì thực cần ảnh chụp thật riêng; thiết kế không cam kết ảnh vẽ chứng minh nhận diện sản phẩm thực tế.

Seed chỉ chạy chủ động vào database `inventory_support` khi cả bốn collection trống; có dữ liệu thì dừng, không drop/upsert/xóa âm thầm. Muốn reset phải tự chọn xóa database demo trong Atlas sau khi kiểm tên hoặc dùng database demo mới; không xóa database khác. Trước ghi, kiểm đầy đủ manifest và tất cả ảnh; copy ảnh xong mới nhập dữ liệu, transaction nhập nhỏ bảo đảm bốn collection nhất quán, lỗi thì báo và giữ khả năng kiểm tra lại. Không đọc/migrate JSON cũ. Dừng backend khi seed.

## 7. Cấu trúc thư mục và file dự kiến

Các đường dẫn mới là thiết kế, chưa tạo mã. Giữ module hiện tại, không xây generic repository/framework mới.

```text
Server/backend/
  package.json, package-lock.json          # thêm ODM và script seed/check
  .gitignore                              # URI/env, uploads runtime và báo cáo local
  src/
    app.module.ts                         # giữ DatabaseModule
    database/
      database.module.ts                  # Mongoose connection và đăng ký models
      database.service.ts                 # bỏ mảng/save/seed tự động; truy cập model/connection
      document-mappers.ts                 # _id -> id và lọc trường nội bộ
      schemas/
        user.schema.ts
        product.schema.ts
        stock-transaction.schema.ts
        notification.schema.ts
    auth/                                 # truy vấn user async, guard và controller/caller
    users/                                # CRUD async và duplicate email
    products/                             # CRUD/query async, barcode, match và xóa mềm
    inventory/                            # transaction, batch, summary/history async
    notifications/                        # đọc/ghi theo session, push sau commit
    ai/                                   # await products/inventory trong controller/tools/confirm
    uploads/                              # tái sử dụng lưu ảnh local
    main.ts                               # static uploads, bind LAN; cấu hình startup nếu cần
  scripts/
    seed-demo.ts                          # validate, copy ảnh và ghi bộ mẫu
    check-demo.ts                         # đối chiếu tồn, quyền, tham chiếu, ảnh
    generate-demo-images.ps1              # tạo ảnh PNG/phiếu gốc trên Windows
  fixtures/mini-mart/
    catalog.json                          # 60 thông tin sản phẩm, đường dẫn ảnh
    manifest.json                         # phiên bản fixture, mappings, seed/ngày sinh
    images/                               # 60 PNG sản phẩm
    invoices/                             # 3 ảnh phiếu và đáp án
    README.md                             # nguồn, quy mô, tài khoản và giới hạn
  uploads/store-1/                         # bản copy runtime, không commit dữ liệu user upload
  test/                                   # Mongo integration và E2E
App/InventorySupport/
  app.json                                # package ID, build plugins/cấu hình Android
  package.json, package-lock.json          # chỉ đổi khi cần build compatibility
  src/constants/config.ts                 # tái sử dụng EXPO_PUBLIC_API_URL
  src/services/api.ts                     # giữ ghép URL ảnh và hợp đồng API
  android/                                # Expo prebuild tạo, Gradle build APK
  .gitignore                              # keystore, local.properties, artifacts
  plugins/with-lan-http.js                 # chỉ tạo nếu cần config plugin cho HTTP LAN
 docs/
  MONGODB_LOCAL_SETUP.md                   # người dùng setup Atlas/LAN và troubleshooting
  DEMO_DATA.md                            # cấu trúc/kiểm chứng bộ mẫu
  ANDROID_APK.md                          # build/install/signing/IP
```

`docs/` ở gốc repo. File helper ảnh/mapping chỉ thêm khi thực sự dùng. File spec hiện có phụ thuộc `new DatabaseService()` và mảng cần chuyển sang fixture/model mock hoặc Mongo integration phù hợp; không giữ RAM database trong production chỉ để test cũ chạy.

Caller phải rà hết bằng rg: auth service/guard, users/products/inventory/notifications services và controllers, AI controller/tools/offline helper còn compile/assistant confirm, các specs và API tests. Đổi `runTool` sang async và await kết quả function calls có thứ tự, tránh JSON.stringify Promise. API và kiểu dữ liệu app không đổi chỉ vì backend chuyển MongoDB.

## 8. Các bước bạn tự thực hiện

### 8.1. Tạo Atlas

1. Đăng ký/đăng nhập MongoDB Atlas, bật bảo vệ tài khoản phù hợp và tạo project “InventorySupport”. Bạn giữ quyền sở hữu tài khoản; không cần gửi mật khẩu lên chat.
2. Tạo cluster có nhãn **Free** (trước đây M0), chọn region khả dụng gần nơi sử dụng. Kiểm tra giao diện xác nhận miễn phí, không chọn nâng tier/add-on trả phí. Không nạp sample dataset của MongoDB vì sẽ dùng bộ mẫu riêng.
3. Trong Database Access/Database & Network Access, tạo database user riêng cho app. Cấp `readWrite` chỉ database `inventory_support`; đây khác với tài khoản đăng nhập Atlas. Nếu cần thao tác quản trị qua UI dùng tài khoản Atlas của bạn.
4. Trong Network Access/IP access list, thêm **IP public của mạng máy tính backend** bằng Add Current IP. Không nhập IP LAN 192.168.x.x làm IP outbound Atlas. Khi IP public đổi, cập nhật danh sách; không mở 0.0.0.0/0 làm mặc định.
5. Chọn Connect → Drivers → Node.js, copy URI `mongodb+srv://...`. Điền user/password được URL-encode đúng và database demo; giữ các tùy chọn kết nối Atlas khuyến nghị.
6. Sau khi seed hoàn tất, xem bốn collection qua Data Explorer. Có thể dùng MongoDB Compass tùy chọn; không bắt buộc cài Compass để app chạy.

### 8.2. Cấu hình backend sau khi mã chuyển đổi được triển khai

Mở PowerShell tại `Server/backend`, cài dependencies theo lockfile và đặt biến trong chính cửa sổ chạy server. Ví dụ placeholders:

```powershell
$env:MONGODB_URI = 'mongodb+srv://<user>:<encoded-password>@<cluster>/inventory_support?retryWrites=true&w=majority'
$env:JWT_SECRET = '<chuoi-ngau-nhien-dai-cua-ban>'
$env:UPLOAD_DIR = 'D:\InventorySupportData\uploads'
```

`UPLOAD_DIR` chọn thư mục máy bạn có quyền ghi, có thể giữ mặc định repo khi demo. Repo hiện chưa tự nạp `.env`; thiết kế dùng biến môi trường PowerShell để tránh thêm dependency chỉ cho config. Mở terminal mới phải đặt lại biến. Không đưa URI thật vào tài liệu, app config hoặc Git.

Các lệnh `npm run seed:demo` và `npm run check:demo` là script sẽ tạo khi triển khai, hiện chưa có. Chạy seed khi backend dừng và database trống, đọc báo cáo kiểm chứng rồi `npm run start:dev`. Backend lỗi kết nối phải dừng/báo rõ, không seed demo tự động hoặc fallback JSON. Gemini key chỉ cấu hình nếu cần thử AI và không bắt buộc để dùng kho thủ công.

### 8.3. Kết nối Wi-Fi

1. Cho máy tính và điện thoại vào mạng riêng tin cậy, tắt client isolation nếu router có và bạn quản lý router. Không dùng guest Wi-Fi bị cô lập.
2. Dùng `ipconfig` lấy IPv4 adapter Wi-Fi, ví dụ `192.168.1.20`; kiểm backend nghe `0.0.0.0:3000` như mã hiện tại.
3. Trong Windows Defender Firewall, tạo inbound rule TCP 3000 cho profile Private và phạm vi Local subnet; không tắt toàn bộ firewall.
4. Dùng trình duyệt điện thoại mở `http://192.168.1.20:3000/health`. Xem một URL ảnh demo để xác minh truy cập static.
5. Đặt reservation DHCP cho máy tính trên router để giữ IP nếu có quyền quản lý. Nếu không, mỗi lần IP đổi cần cấu hình lại URL app và rebuild APK theo thiết kế URL cố định.

### 8.4. Build và cài APK trên Windows

1. Cài JDK và Android Studio/SDK đúng yêu cầu Expo/React Native phiên bản dự án; đặt Android SDK environment và kiểm adb hoạt động. Phiên bản cụ thể được chốt sau bước kiểm tra compatibility.
2. Đặt `EXPO_PUBLIC_API_URL` bằng URL LAN đã thử, trước bước bundle/build. Đây là địa chỉ công khai không chứa secret.
3. Cấu hình Android application ID đề xuất `com.inventorysupport.demo` và cho phép cleartext HTTP cho bản demo LAN bằng cấu hình/plugin được Expo hỗ trợ; kiểm manifest sinh ra, không giả định Expo Go và APK release có cấu hình HTTP giống nhau.
4. Expo prebuild tạo android; build release bằng Gradle tại máy. Thực thi hướng dẫn signing phù hợp project sinh ra; dùng keystore demo riêng nếu cần. Không coi APK dùng debug signing là bản phát hành production.
5. Cài APK qua USB/adb hoặc copy APK và cho phép cài từ nguồn được chọn. Mở app khi không chạy Metro để chứng minh APK chứa bundle và dùng backend độc lập Expo dev server.
6. Giữ keystore ngoài Git và lưu an toàn nếu muốn cập nhật APK sau này. Không có yêu cầu Google Play, tài khoản trả phí hoặc EAS cloud build trong phương án chính.

Các lệnh build chính xác và đường dẫn APK sẽ được ghi trong `docs/ANDROID_APK.md` sau khi kiểm template Android thực tế; thường artifact nằm dưới `android/app/build/outputs/apk/`. Không ghi lệnh `eas build --local` như cách được hỗ trợ chính thức trên Windows.

## 9. Thứ tự thực hiện và tiêu chí bàn giao

1. Kiểm tra compatibility/dependencies, xác định baseline tests và chốt schema/mapping. Bàn giao kết nối MongoDB không seed tự động, lỗi cấu hình rõ.
2. Chuyển auth/users/products/notifications và toàn bộ caller sang async. Test role/store, duplicate email/barcode, tìm bỏ dấu, xóa mềm và output API.
3. Chuyển inventory sang transaction; AI chờ truy vấn thật. Test xuất cạnh tranh, batch rollback, kiểm kê 0/lý do, lỗi push sau commit, confirm AI không ghi lần hai.
4. Tạo đủ catalog, ảnh, phiếu và script sinh dữ liệu; kiểm nghiệm 30 ngày, chuỗi tồn, cảnh báo, tham chiếu, quyền người tạo và mọi đường dẫn ảnh. Seed chạy lại trên database có dữ liệu phải từ chối.
5. Setup Atlas/LAN theo checklist, kiểm tra restart giữ dữ liệu/ảnh và lỗi mất kết nối không sinh dữ liệu demo.
6. Build APK, cài điện thoại, thử CRUD theo quyền, quét, nhập/xuất/kiểm kê/batch, ảnh, dashboard, báo cáo và AI với mock hoặc request thật tối thiểu được cho phép.
7. Chạy build/lint/unit/E2E backend và TypeScript/lint app phù hợp; lưu báo cáo rõ phần test tự động, thiết bị thật và Gemini thật. Kiểm tra APK không chứa URI/key.

Kiểm thử transaction dùng database test riêng trên replica set local hoặc Atlas test database riêng được đặt rõ. Không test xóa/reset trên database người dùng đang sử dụng. Dữ liệu seed độc lập không chứa secret thật; ảnh fixtures được commit, uploads runtime không commit.

## 10. Vận hành, sao lưu và giới hạn

Bạn quản lý tài khoản Atlas, database user, IP access list và máy tính backend. Không cần chia sẻ Atlas account để cài APK. Database Free không có nghĩa máy tính có thể tắt hoặc app hoạt động offline.

Sao lưu bằng MongoDB Database Tools phù hợp deployment vào thư mục local, kèm toàn bộ UPLOAD_DIR và cấu hình không chứa secret; thử restore vào database demo khác trước khi dựa vào backup. Không phụ thuộc giả định Free luôn có cùng chính sách backup. Chưa cần mua domain, VPS, cloud ảnh hay Google Play.

HTTP LAN được chấp nhận cho demo trên mạng riêng tin cậy, không phù hợp công khai chứa dữ liệu nhạy cảm. Cấu hình signing, IP và Android cleartext phải được nghiệm thu trên APK thật. Gemini/push là dịch vụ Internet có cấu hình/quota riêng, không thuộc cam kết không tốn phí của stack lưu trữ.

## 11. Nguồn kỹ thuật đã tham khảo

- NestJS MongoDB/Mongoose: https://docs.nestjs.com/techniques/mongodb
- Atlas Free setup: https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/
- Atlas connection: https://www.mongodb.com/docs/atlas/connect-to-database-deployment/
- Atlas limits: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- Expo APK: https://docs.expo.dev/build-reference/apk/
- Expo local build limitations: https://docs.expo.dev/build-reference/local-builds/

Bản kế hoạch JSON migration trước đây giả định giữ dữ liệu cũ; thiết kế này thay thế giả định đó bằng khởi tạo database mẫu mới. Chỉ sau khi bản thiết kế được duyệt mới lập checklist triển khai chi tiết và viết mã/tạo assets.
