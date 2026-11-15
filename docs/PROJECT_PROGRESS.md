# Mốc tiến độ Inventory Support

Cập nhật 15/11/2026. Nhánh `feature/gemini-migration`, HEAD lúc bắt đầu triển khai MongoDB: `348fef7` (tích hợp gemini AI). Thay đổi hiện chưa commit; không hoàn tác các tài liệu có sẵn.

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
