# Kế hoạch UC07 — Camera nhận diện và kiểm kê theo phiên

## Checklist thực thi cập nhật sau duyệt

- [x] Người dùng duyệt đầy đủ thiết kế; kiểm baseline mới: 96 test đạt, 7 Mongo skip.
- [x] Schema/tables/index và version; seed từ chối database có phiên; fixture rollback hỗ trợ bảng mới.
- [x] CRUD phiên/identify/save/remove/cancel, kiểm role/owner/store, số đếm và giới hạn 200.
- [x] Complete nguyên tử, kiểm xung đột toàn phiên, bảo vệ dòng khớp, retry/push sau commit; tests HTTP và fixtures.
- [x] App service, entry Quét → Kiểm kê, session/count/review, recovery và lỗi conflict. Dùng navigation/component sẵn có, không thêm framework.
- [x] Rà soát độc lập; sửa ABA revision sau xóa/tạo lại với test RED→GREEN và giữ structured conflicts ở app.
- [x] Cập nhật SCAN/NghiepVu/PROJECT_PROGRESS; backend build/scripts/lint, app typecheck, unit/HTTP.
- [ ] Mongo replica set test: 11 ca đang skip do thiếu MONGODB_TEST_URI, không dùng database thật để thử phá dữ liệu.
- [ ] Điện thoại: scan/barcode/QR, permission/background, mạng LAN và response cũ. App lint bị lỗi dependency expo-secure-store có sẵn.

Các mục bên dưới lưu kế hoạch gốc; trạng thái mới nhất ở checklist này và PROJECT_PROGRESS.md.

Ngày16/11/2026. Đây là kế hoạch định hướng kèm thiết kế chờ duyệt, chưa phải checklist triển khai đã được duyệt. Không bắt đầu viết mã trước bước0.

Thiết kế nguồn: [UC07 design](../specs/2026-11-16-uc07-stocktake-camera-design.md).

## Các bước theo thứ tự

0. Duyệt thiết kế đầy đủ: owner-only,1 phiên mở/người, tối đa200 dòng, chỉ áp dụng dòng đã đếm, chặn khi tồn thay đổi. Người dùng mới chấp nhận nguyên tắc lưu theo phiên và giữ quyền STAFF; các chi tiết này là đề xuất.
1. Sau duyệt, dùng superpowers:writing-plans để lập checklist thực thi/TDD, đọc lại code và docs SDK Expo đúng phiên bản trước sửa camera. Giữ Ponytail full, tận dụng module/helper hiện có. Baseline unit/build/lint trước sửa; không dựa vào kết quả kiểm tra cũ.
2. Nền tảng backend: types/schema/index cho2 collection; stockVersion và session revision; cập nhật tables/mappers/index startup, seed checks để không reset phiên. Test schema/legacy IDs/version/quyền.
3. StocktakesService/API: tạo/tiếp tục, identify, lưu/sửa/bỏ dòng, hủy. Test không đổi tồn khi save, số0, owner/store/roles và200 dòng. Tất cả sửa dòng tranh chấp cùng session revision.
4. Finalize nguyên tử: tách helper kho dùng cùng Mongo session, kiểm version/đơn vị/sản phẩm xóa, conditional-write tất cả product đã đếm kể cả dòng khớp, tạo ADJUSTMENT chỉ cho dòng lệch, ghi result/status và push sau commit. Integration test xung đột, rollback, retry, save-vs-complete; không coi fixture RAM chứng minh isolation.
5. App: các màn session/count/review, service/types/navigation. Đổi nhánh kiểm kê cũ từ đếm+1 sang nhập số rõ ràng, giữ nhập/xuất và ảnh AI. Khóa callback bằng ref, hủy/bỏ response cũ, vòng đời camera.
6. Luồng khôi phục/lỗi: permissions camera, mã chưa có, nhập tay/tìm tên, mất kết nối, retry save/finalize, đếm lại conflict. Hiển thị số dòng đã đếm và lệch, không dùng phần trăm giả hay coi chưa đếm bằng0.
7. Nghiệm thu: unit/HTTP + real Mongo replica set + app typecheck/lint + điện thoại thật (quét barcode thực của60 sản phẩm cào, tem QR, quyền/background). Sửa SCAN/NghiepVu và ghi rõ kết quả thật/mocked/chưa chạy.
8. Rà soát toàn thay đổi độc lập khi triển khai xong; xử lý lỗi quan trọng, cập nhật memory. Chưa merge/push/publish hoặc build APK trong phạm vi này.

## Điểm tiếp tục phiên sau

Đọc theo thứ tự: docs/PROJECT_PROGRESS.md → design → plan này → NghiepVu.md → scanner source/inventory/database. Nếu chưa có duyệt tài liệu đầy đủ, gửi link để duyệt; không hỏi lại lựa chọn theo phiên hoặc quyền STAFF đã chốt. Sau duyệt mới chuyển writing-plans rồi execution. Không triển khai theo tài liệu SCAN cũ ở các đoạn Claude/kiểm kê tự+1.
