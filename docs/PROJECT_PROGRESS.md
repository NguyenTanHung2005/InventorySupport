# Mốc tiến độ Inventory Support

## Ngrok đã cấu hình URL local và APK preview — 16/11/2026

- User cung cấp Forwarding URL `https://defeat-city-childless.ngrok-free.dev`. Đã kiểm trực tiếp: /health 200 JSON status=ok; /products không JWT trả 401; một ảnh runtime 200 image/jpeg, SHA-256 khớp nguồn. Không ghi dữ liệu/đổi tài khoản khi kiểm.
- Đã đặt EXPO_PUBLIC_API_URL trong App/InventorySupport/.env.local (Git bỏ qua); tạo eas.json preview (internal, environment preview, android apk) cùng URL; app.json thêm package com.inventorysupport.app. Giữ plugin cũ, không thêm npm dependency hoặc sửa TS/JS.
- Thêm docs/NGROK_SETUP.md và cập nhật README. Kiểm cấu hình URL local/EAS khớp, Expo public config resolve đúng package/4 plugin, app TypeScript/lint --no-cache và diff --check đạt. Chưa đăng nhập EAS/gửi build APK; chưa nghiệm thu điện thoại, restart tunnel/chuyển mạng hoặc đăng nhập qua tunnel bằng app.
- .env backend chưa khai báo JWT_SECRET tại lúc kiểm; không suy ra terminal backend cũng thiếu biến. Đã nhắc kiểm secret riêng/mật khẩu demo trước dùng endpoint public, không tự thay credential hoặc in giá trị.
- Bước tiếp: user restart Expo bằng `npx expo start --lan --clear`, kiểm URL HTTPS trên login và đăng nhập/ảnh. Giữ backend + ngrok chạy. Sau đó mới yêu cầu EAS login/build và nghiệm thu APK. Không chạy lại thay bộ dữ liệu vì cấu hình mạng.

## Kế hoạch ngrok tối giản — 16/11/2026, chưa triển khai

- User chọn ngrok để demo APK qua nhiều Wi-Fi, yêu cầu thiết kế đơn giản/ít đổi code. Đã lập `docs/superpowers/specs/2026-11-16-ngrok-minimal-design.md` và `docs/superpowers/plans/2026-11-16-ngrok-minimal-plan.md`.
- Hướng mặc định: ngrok CLI ngoài repo, domain HTTPS gắn tài khoản, forward localhost:3000. Tận dụng EXPO_PUBLIC_API_URL/API_URL/resolveImageUrl hiện có; không sửa TS/JS hoặc thêm npm dependency. Đặt URL trong .env.local để thử Expo và eas.json preview cho APK; app.json chỉ thêm android.package khi chuẩn bị APK.
- Chưa có ngrok trong PATH, chưa có eas.json; chưa cài CLI/cấu hình token/mở tunnel/build APK. Khi triển khai cần domain public thật, token do user lưu local. Kiểm JWT secret riêng và đổi password demo công khai trước mở endpoint Internet bằng chức năng sẵn có, không ghi password vào app.
- Kiểm health phải JSON, API phải đúng quyền, ảnh đúng content-type/cùng domain, restart tunnel giữ URL và thử APK trên mạng khác. Không thêm skip-warning header dự phòng; nếu tái hiện HTML interstitial thì chẩn đoán luồng cụ thể trước sửa. Kế hoạch cần user duyệt trước thực hiện.

## Chuẩn bị đưa lên Git — 16/11/2026

- Thêm .gitignore gốc để loại workspace .superpowers, .env, backup local, npm cache, bộ MINISTOP đã bỏ, raw HTML Minimart247 và preview sinh tự động/preview 42 dòng cũ khỏi Git. Giữ source/test, catalog/sources/65 ảnh/preview-65.csv và các fixture đã được track.
- Đã xác nhận git check-ignore cho credential/backup/raw/preview/node_modules/build và diff --check đạt; không có .env/backup đang được track. Chưa commit/push.
- Xóa vật lý các thư mục tạm đã được thử nhưng bị kiểm duyệt tự động chặn (blocked by policy). Chưa xóa thư mục nào; chỉ loại khỏi Git. Nếu cần giải phóng dung lượng, user tự xóa đúng .superpowers, Server/backend/.superpowers, Server/backend/.npm-cache, Server/backend/fixtures/ministop và fixtures/minimart247/raw. Không xóa .local-backups/uploads hoặc bộ images đang dùng.

## ĐÃ THAY DATABASE: 65 sản phẩm + hoạt động 60 ngày — 16/11/2026

- Sau khi người dùng lưu .env và dừng backend, đã chạy `npm run data:replace -- --apply` thành công trên MongoDB thực. Từ 120 products/633 transactions/15 notifications/1 stocktake session sang 65/1.587/109/0. Giữ nguyên 6 users; hash toàn bộ document user khớp trước/sau.
- Backup trước thay tại `Server/backend/.local-backups/store-1-before-retail-1794811192366.json`; report tại `.local-backups/replacement-report.json`, Git bỏ qua. 65 ảnh runtime đã copy, đối chiếu SHA-256 đạt; đọc lại Mongo và replay toàn bộ giao dịch về tồn cuối đạt. Backend đang dừng, chưa nghiệm thu HTTP ảnh/UI sau restart.
- Các dòng “chờ URI/chưa apply” dưới đây lưu diễn biến trước đó, không phải trạng thái hiện tại. Không chạy lại apply chỉ để kiểm tra. Mở lại terminal backend cũ và chạy start:dev, sau đó tải lại app để bỏ dữ liệu/phiên cũ trong bộ nhớ.

- Người dùng đã chốt giữ tài khoản, xóa bộ nghiệp vụ cũ và tạo hoạt động hai tháng. Không cần hỏi lại quyết định này. Chưa thực hiện xóa/ghi database vì thiếu MONGODB_URI trong môi trường công cụ và chưa có Server/backend/.env.
- Bộ tại fixtures/minimart247 đã mở rộng thành 65 sản phẩm/65 ảnh: 42 Minimart247 + 23 Co.op Online. Giá/đơn vị/ảnh có nguồn riêng; một ứng viên Co.op bị loại do giá không nhất quán. `catalog.json`, `sources.json`, `summary.json`, `validation.json` đã cập nhật; `preview-65.csv` là bảng mới, preview.csv 42 dòng cũ đang bị Excel khóa nên không ép ghi đè.
- Bổ sung đơn vị còn thiếu (đánh dấu suy luận); costPrice mô phỏng 72% giá bán làm tròn 500đ, minStock 3/8 theo giá, supplier ghi rõ mô phỏng. Không gọi nguồn bổ sung là dữ liệu Minimart247.
- activity-preview.json: 65 sản phẩm, 1.587 giao dịch, 109 cảnh báo mô phỏng trong 17/09–15/11/2026; giữ tham chiếu 6 tài khoản hiện tại đã đọc qua API. 1.761 document validate đúng schema, replay tồn cuối đạt, có hàng hết/sắp hết/bình thường. Không tạo giả phiên UC07.
- Scripts mới store-dataset.ts, replace-store-core.ts, replace-store-data.ts + tests. `npm run data:replace` preview mặc định; `npm run data:replace -- --apply` sau khi dừng backend. Tự đọc .env local nếu có, giữ mọi trường users, backup 5 collection nghiệp vụ vào .local-backups Git-ignored, copy ảnh theo SHA-256 vào UPLOAD_DIR không ghi đè, transaction thay sản phẩm/history/alerts và dọn phiên kiểm kê cũ. Không drop DB/xóa user/ảnh cũ hoặc phát push thật. Nếu ảnh copy xong nhưng transaction lỗi có thể còn file mới chưa tham chiếu.
- Review độc lập hoàn tất, không Critical; đã sửa Important: phân biệt lỗi sau commit với chưa commit để tránh chạy lặp vì hiểu nhầm. Test mô tả lỗi RED→GREEN; core không ghi users. Thêm test Mongo cho thành công/phiên cũ được dọn, stale snapshot, đổi account, lỗi insert giữa chừng rollback.
- Kiểm chứng cuối: 132 tests đạt, 15 Mongo tests skip vì không có MONGODB_TEST_URI; build:scripts đạt, lint scripts mới đạt; backend lint còn 1 warning unbound-method có sẵn. Chưa thể xác nhận transaction trên Mongo thật hoặc ảnh qua HTTP sau apply.
- Tiếp tục: user lưu MONGODB_URI thật (và UPLOAD_DIR nếu đã dùng đường dẫn riêng) vào Server/backend/.env hoặc cấu hình terminal để chạy công cụ. Không in credential. Dry-run trước, dừng backend rồi apply; kiểm counts/account digest/ảnh sau commit, restart backend/app. User đã nói có thể cung cấp mật khẩu nhưng được hướng dẫn lưu local thay vì chat.
- Plan/checklist: docs/superpowers/plans/2026-11-16-replace-store-dataset.md. Không tự coi mục “chưa nhập” 42 sản phẩm bên dưới là trạng thái mới nhất.

## Bộ Minimart247 — 16/11/2026

- Theo yêu cầu mới đã cào trực tiếp https://www.minimart247.com/san-pham: 4 trang danh sách, 42 sản phẩm và 42 ảnh chính (32 JPEG, 10 WEBP), 14 danh mục. robots.txt không chặn. Không thêm crawler framework/dependency.
- Bộ riêng tại `Server/backend/fixtures/minimart247/`: catalog.json, preview.csv UTF-8 BOM, sources.json, images/, raw snapshots, summary/validation, README. Tên/mô tả/danh mục/giá bán từ trang chi tiết; giá 11.000–305.000 VND, khớp trang danh sách. Đủ 42 mã/ảnh không trùng, kiểm signature/SHA-256/dung lượng upload và giới hạn DTO đạt.
- Mã nội bộ MM247-<SKU nguồn>, không phải EAN/UPC trên bao bì. Unit đọc từ tên; 12 sản phẩm chưa rõ dùng “sản phẩm”, danh sách tại summary.json. costPrice/minStock=0 và supplier rỗng là thiếu dữ liệu, chưa giả lập. Tồn/đã bán nguồn chỉ giữ metadata, không đưa vào tồn project.
- CHƯA nhập database/upload ảnh, chưa thay dữ liệu cũ. Khi người dùng duyệt bộ này mới triển khai bước nhập qua API products/uploads, chỉ thêm mã chưa tồn tại; không tạo giả users/history/alerts/stocktakes.

## Chẩn đoán lỗi Quét Platform.OS — 16/11/2026

- Expo cài 57.0.32 nhưng expo-camera 58.0.14 import Platform từ expo, trong khi Expo 57 không export Platform. CameraView/utils props đọc Platform.OS gây lỗi khi vào Quét. Document picker cũng lệch SDK (58.0.4).
- Đã dùng Expo installer cập nhật package.json về expo-camera ~57.0.6 và expo-document-picker ~57.0.3 theo bundledNativeModules.json của Expo 57. Không sửa node_modules hoặc thêm fallback che lỗi Platform.
- Chưa cài được: online ECONNREFUSED, offline ENOTCACHED. node_modules vẫn camera 58/document-picker 58, lockfile chưa được đồng bộ. Người dùng cần chạy `npx expo install expo-camera expo-document-picker --npm` trong App/InventorySupport rồi `npx expo start --lan --clear`.
- Kiểm tra tương thích bản đang cài đã tái hiện FAIL; chưa thể GREEN hoặc nghiệm thu camera đến khi cài package đúng. Không tuyên bố đã sửa xong runtime.

## Sửa cảnh báo thông báo Expo Go — 16/11/2026

- Bỏ import expo-notifications ngay khi mở app. Loader kiểm tra web/Expo Go bằng isRunningInExpoGo trước dynamic import, tránh cảnh báo import và không gọi notification channel/push trong Expo Go.
- Expo Go/web tiếp tục polling 30 giây, badge và danh sách trong app; chủ động không phát thông báo hệ thống trong Expo Go vì channel native đang lỗi trên thiết bị người dùng. Development/standalone giữ local/push và kiểm quyền/EAS projectId hiện có. Không che console warnings hoặc sửa node_modules.
- 3 test môi trường (mock native) đạt, app TypeScript và lint hai file sửa đạt. Đã rà soát caller/polling theo Ponytail review; chưa thử lại trên điện thoại hoặc push thật.

## UC07 đã triển khai mã — 16/11/2026 (mới nhất)

- Người dùng đã duyệt đầy đủ thiết kế và yêu cầu executing-plans. Các đoạn “chờ duyệt/chưa viết mã” bên dưới là lịch sử.
- Backend có StocktakesModule/API, 2 collection/index, owner/store/quyền, tối đa 1 phiên mở/người và 200 dòng; số đếm 0 hợp lệ. Lưu dòng không đổi tồn; hoàn tất kiểm tra version/đơn vị/xóa mềm, ghi tồn/lịch sử/cảnh báo/result trong transaction, retry không ghi lặp; push sau commit.
- Mọi movement tăng stockVersion; cả dòng khớp được conditional-write để cạnh tranh với movement. Dữ liệu cũ thiếu stockVersion được coi là 0. Revision dòng lấy từ revision phiên, tránh request cũ ghi đè sau xóa/tạo lại.
- App: Quét → Kiểm kê riêng; danh sách/phân trang/tiếp tục, scan hoặc tìm tên/barcode, nhập số thực đếm, sửa/bỏ dòng, xem lại/lý do/chốt/hủy. Nhập/xuất liên tục giữ nguyên. Camera giới hạn focus/foreground và manual theo active; khóa identify bằng ref, bỏ response cũ; lỗi chốt đánh dấu dòng cần đếm lại.
- Tái sử dụng React Navigation hiện có; gộp session/count/review trong một component thay vì thêm routes/framework. Không thêm dependency hoặc thay dữ liệu thật.
- Kiểm chứng: 121 unit/fixture/API-helper tests đạt; 23 HTTP contract tests đạt; backend build/build:scripts đạt, lint không error (1 warning cũ unbound-method). App typecheck đạt; lint còn lỗi cũ thiếu expo-secure-store trong node_modules, các file mới không lỗi/warning.
- 11 Mongo integration tests (gồm 4 ca UC07 concurrency mới) bị bỏ qua vì không có MONGODB_TEST_URI. Chưa nghiệm thu Mongo replica set, camera/quyền/background trên điện thoại, LAN/Gemini/push thật; chưa build APK.
- Đã review độc lập và sửa lỗi stale revision sau xóa/tạo lại (test RED→GREEN), giữ payload conflicts và đánh dấu dòng. Giới hạn nhỏ còn lại: create đồng thời có thể báo lỗi generic thay vì sessionId; dòng lệch tăng stockVersion hai lần nhưng vẫn đơn điệu và an toàn phát hiện xung đột.
- Tiếp theo: cài dependency Expo còn thiếu đúng SDK; chạy Mongo tests với URI test riêng và nghiệm thu điện thoại. Không reset/seed lại database đang dùng. Chưa commit/merge/push; giữ ledger để tiếp tục nghiệm thu.

Cập nhật 15/11/2026. Nhánh `feature/gemini-migration`, HEAD lúc bắt đầu triển khai MongoDB: `348fef7` (tích hợp gemini AI). Thay đổi hiện chưa commit; không hoàn tác các tài liệu có sẵn.


## Ưu tiên phiên tiếp theo — UC07 (16/11/2026)

- Người dùng yêu cầu thiết kế lại camera: Scan → Identify → Count → Save → Continue. Barcode chỉ nhận diện, không tự cộng1; nhập số thực đếm rõ ràng, lưu dòng vào phiên và chỉ cập nhật tồn khi hoàn tất sau khi xem lại.
- Đã chốt phương án lưu theo phiên và STAFF giữ nguyên quyền; ADMIN/MANAGER thực hiện/chốt, không thêm phê duyệt người khác. Không hỏi lại hai lựa chọn này.
- Đã khảo sát ScannerScreen/BarcodeCamera/LookupScanner/BatchScanner/ImageScanner và inventory/database/navigation. Hiện chưa có StocktakesModule/schema/API; kiểm kê cũ trong BatchScanner vẫn tự+1 và lưu ADJUSTMENT trực tiếp. Đừng nhầm thiết kế mới với chức năng đã triển khai.
- Bản thiết kế mới: `docs/superpowers/specs/2026-11-16-uc07-stocktake-camera-design.md`; kế hoạch định hướng: `docs/superpowers/plans/2026-11-16-uc07-stocktake-camera-plan.md`.
- Các đề xuất bổ sung còn chờ duyệt toàn tài liệu: phiên chỉ người tạo thao tác, tối đa1 phiên đang mở/người/cửa hàng,200 sản phẩm/phiên, có thể chốt phần đã đếm, stockVersion phát hiện tồn thay đổi và session revision ngăn save/chốt/hủy cạnh tranh.
- Chỉ sửa tài liệu trong bước này, chưa viết mã UC07/chưa thay dữ liệu. Sau duyệt bản thiết kế đầy đủ mới dùng writing-plans lập checklist thực thi và executing-plans/Ponytail. APK vẫn hoãn.
- Bản nhớ này và kế hoạch mới ưu tiên hơn các mô tả cũ “chưa có phiên kiểm kê” khi nói về mục tiêu, nhưng các mô tả đó vẫn đúng cho mã hiện tại. SCAN.md còn đoạn Claude/đếm+1 cũ, cần cập nhật cùng triển khai.

## Lưu ý môi trường/dữ liệu để không làm lại

- MongoDB đã được người dùng setup/kết nối database `inventory_support`; đã sửa kiểu lean Mongoose và build backend/build:scripts thành công ở bước sau. Các dòng “chưa cài package/build blocked” trong báo cáo15/11 bên dưới là lịch sử, không tự coi còn đúng; chạy baseline mới khi tiếp tục.
- 60 sản phẩm cào thực đã được nhập qua API cùng60 ảnh local, giá/đơn vị demo theo yêu cầu; tổng lúc kiểm chứng120 sản phẩm (giữ60 mẫu cũ), sản phẩm mới tồn0. Không xóa dữ liệu thật/mẫu đang dùng để test UC07.
- IP Wi-Fi lần cuối192.168.1.8; app .env.local hiện dùng http://192.168.1.8:3000 cho điện thoại thật; emulator dùng10.0.2.2. IP có thể đổi, kiểm lại thay vì hardcode.
- Key/URI chỉ nằm trên terminal backend, không lưu secret vào memory. User đã từng gửi mật khẩu qua chat, không chép lại.
## Phạm vi đã được người dùng duyệt

Backend máy tính cùng Wi-Fi, Atlas Free, ảnh local, bộ mẫu siêu thị mini 30 ngày; không chuyển JSON cũ. Người dùng hoãn toàn bộ build/cấu hình APK. Spec: `docs/superpowers/specs/2026-11-15-atlas-lan-mini-mart-design.md`; kế hoạch thực hiện: `docs/superpowers/plans/2026-11-15-atlas-lan-implementation.md`.

## Mã và tài nguyên đã chuẩn bị

- Thay DatabaseService mảng/JSON bằng truy vấn MongoDB có ánh xạ ID, schema/index, kiểm URI và chờ index lúc startup. Khai báo @nestjs/mongoose và mongoose trong package.json.
- Chuyển auth guard, auth/users/products/inventory/notifications và caller AI sang async; kho ghi tồn/lịch sử/cảnh báo trong transaction, push sau commit.
- Bảo vệ cập nhật tài khoản theo trường yêu cầu, quản trị viên cuối cùng bằng shared revision lock, token thiết bị một chủ bằng unique multikey index; xóa ảnh dùng $unset.
- Fixture đủ 60 sản phẩm,6 tài khoản,629 giao dịch,15 cảnh báo trong 16/10–14/11/2026; 60 PNG sản phẩm và3 PNG phiếu kèm đáp án. Có script seed/check; không tự xóa/reset/migrate dữ liệu cũ.
- Hướng dẫn người dùng: `docs/MONGODB_LOCAL_SETUP.md`, `docs/DEMO_DATA.md`.

## Bằng chứng kiểm tra lần này

- 96 unit/fixture tests đạt;7 Mongo integration tests bỏ qua vì thiếu MONGODB_TEST_URI/deployment.
- 22 HTTP contract tests đạt với fixture database riêng cho test; không coi đây là bằng chứng Mongo isolation.
- App TypeScript đạt; lint app lỗi dependency `expo-secure-store` chưa có trong node_modules (không sửa app trong tác vụ này).
- Backend lint không có error,1 warning unbound-method trong integration test. Format và git diff --check đạt.
- Build backend thất bại3 lỗi missing modules mongoose/@nestjs/mongoose. Registry npm bị môi trường chặn (ENOTCACHED/ECONNREFUSED); chưa cài dependency hoặc cập nhật package-lock. Cần npm install trên môi trường truy cập npm được rồi build và chạy Mongo integration.
- Đã rà soát độc lập toàn thay đổi và sửa source cho5 vấn đề Important. Các kiểm thử không cần Mongo cho lỗi cập nhật tài khoản/xóa ảnh/startup đã quan sát RED->GREEN; concurrency trên Mongo chưa chạy.
- Đã sửa minor confirmAction: kiểm tra busy sau khi chờ truy vấn giao dịch, trước khi thay đổi ngữ cảnh. Test tái hiện chat bắt đầu trong lúc lookup chờ đã quan sát RED→GREEN; xác nhận lại sau khi chat kết thúc thành công mà không ghi lại kho.

## Bước tiếp theo

1. Người dùng setup Atlas theo hướng dẫn, giữ URI/key trên backend; chạy npm install để cập nhật lockfile.
2. Chạy build, lint, test và test Mongo replica set bằng user test riêng, sửa nếu integration phát hiện vấn đề. Không tuyên bố runtime đã sẵn sàng khi bước này chưa qua.
3. Seed database demo trống, check:demo, chạy backend và thử app cùng Wi-Fi/ảnh.
4. Gemini thật, Expo push thật, LAN trên điện thoại và APK chưa nghiệm thu. Build APK sẽ bàn sau.

Ledger chi tiết (local, không commit): `.superpowers/sdd/2026-11-15-atlas-lan-implementation/progress.md`.

- Điều chỉnh theo yêu cầu mới: script seed/check và hướng dẫn dùng database inventory_support (hoặc inventory_support_<suffix>), thay inventory_support_demo; vẫn từ chối seed khi collection có dữ liệu.

- 15/11/2026: người dùng yêu cầu áp dụng dữ liệu cào và tự bổ sung giá/đơn vị. Đã tạo backend/fixtures/crawled-products (60 sản phẩm+ảnh+nguồn), thêm ScrawlData/prepare-backend.mjs và apply-backend.mjs. Đã gọi API backend local tạo60 sản phẩm và upload ảnh vào UPLOAD_DIR thực. Kiểm chứng60 trường/60 URL ảnh, tồn mới0; tổng120 sản phẩm vì giữ60 cũ. Chạy lại tạo0/bỏ qua60. Giá/đơn vị/nhà cung cấp mô phỏng, không phải giá được xác minh. Không sửa lịch sử, tồn cũ hoặc tài khoản. 9 test scraper/import offline đạt.

- Builder check UC07 đã hoàn tất: bổ sung conditional-write/tăng stockVersion trên cả dòng đếm khớp để ngăn finalize-vs-movement race; PUT phải mang expectedUnit để phát hiện đổi đơn vị sau Identify. Không còn câu hỏi nghiệp vụ quan trọng theo reviewer; toàn thiết kế chi tiết vẫn chờ người dùng duyệt. Chỉ tài liệu thay đổi, không chạy test ứng dụng trong bước lập kế hoạch.
