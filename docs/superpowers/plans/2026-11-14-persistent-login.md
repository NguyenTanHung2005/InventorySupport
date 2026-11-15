# Khôi phục phiên đăng nhập

**Goal:** Đóng/mở app hoặc tải lại web vẫn vào lại tài khoản nếu JWT còn hợp lệ; đăng xuất và 401 xóa phiên đã lưu.

**Nguyên nhân:** `auth.store.tsx` chỉ dùng React state, chưa ghi/đọc token từ bộ nhớ bền vững. Backend cấp JWT 8 giờ, `/auth/me` đã kiểm tra trạng thái và vai trò mới nhất.

**Thiết kế:** Lưu duy nhất token bằng Expo SecureStore trên native, localStorage trên web. Khi mở app, chờ đọc token và gọi `/auth/me` trước khi mở màn bảo vệ; không tin dữ liệu user lưu cục bộ. Lỗi mạng/storage hiển thị lỗi khôi phục với nút thử lại hoặc đăng nhập khác, giữ token khi chưa có bằng chứng hết hạn. Không lưu mật khẩu, không kéo dài JWT hay thêm refresh token trong phạm vi này. Giữ React Navigation và sửa trực tiếp workspace theo lựa chọn trước đó của người dùng.

**Phạm vi:** `services/session-storage.ts` (native/web storage), `store/auth.store.tsx` (save/restore/clear + chống race), `services/api.ts` (401 gắn đúng token), `services/auth.service.ts` (timeout me), `navigation/AuthNavigator.tsx` (chờ lưu trước khi đăng nhập thành công), `App.tsx` (loading/retry), `package.json`/lock và `app.json` (SecureStore), README (luồng/thời hạn), test Vitest hiện có phía backend cho storage/API và logic app. Không đổi API backend và các chức năng AI.

## Thực hiện

- [ ] Viết ca lỗi: lưu token qua lần mở lại; restore user từ server; hết hạn/khóa trả 401; mất mạng giữ token; logout xóa token; response restore/401 cũ không phục hồi hoặc xóa phiên mới; storage lỗi có thông báo.
- [ ] Cài SecureStore theo Expo SDK 57, dùng platform storage nhỏ và xử lý lỗi. Lưu trước khi signIn thành công; xóa được trước khi hoàn tất signOut. Các thao tác storage ghi/xóa được tuần tự hóa để chống đăng xuất khi write đang chờ.
- [ ] Thêm trạng thái khôi phục, thử lại và đổi tài khoản; không chớp màn đăng nhập hoặc mở app bằng user chưa kiểm tra.
- [ ] Cập nhật README, chạy unit/E2E hồi quy, lint, TypeScript và build web; review theo ponytail-review.

**Tiêu chí:** Khởi động mới dùng token đã lưu và user hiện tại từ `/auth/me`; chưa có token mở Login; 401 xóa token; lỗi mạng không xóa; logout không tái đăng nhập ở lần mở sau; giữ JWT 8 giờ. Test bằng adapter/mock không thay thế kiểm thử trên điện thoại.

**Lưu ý môi trường:** Lần cài Expo ban đầu bị chặn kết nối (`ECONNREFUSED 127.0.0.1:9`). Kiểm tra cache trước khi quyết định cách hoàn tất dependency; không bỏ SecureStore để lưu token native vào file không mã hóa.

## Tiến độ

- Đã triển khai storage native/web, lưu trước khi signIn hoàn tất, tuần tự hóa ghi/xóa, kiểm tra `/auth/me`, timeout, loading/error/retry, chống response/401 cũ và giữ hạn JWT 8 giờ.
- 71 unit test hiện qua, gồm 9 ca bổ sung cho phiên/API/storage. Kiểm thử callback qua React SSR không thay thế kiểm thử lifecycle trên điện thoại.
- Expo đã chọn đúng `~57.0.4`; cài online bị chặn proxy và offline báo `ENOTCACHED`. Manifest đã thêm dependency, lockfile chưa thể cập nhật. TypeScript/lint app còn báo đúng một module chưa cài `expo-secure-store`, không bỏ qua lỗi hoặc thêm type shim để che nó.
- Cần chạy `npx expo install expo-secure-store` từ `App/InventorySupport` trên môi trường có mạng rồi kiểm tra lại native/typecheck/lint. Không cần đổi backend hoặc key AI.
- Hồi quy cuối: 71/71 unit, 22/22 E2E, lint và TypeScript backend, export web Expo qua. Đã tự review bảo mật và ponytail-review; chưa kiểm thử trên điện thoại, app lint/typecheck vẫn chờ dependency native.
