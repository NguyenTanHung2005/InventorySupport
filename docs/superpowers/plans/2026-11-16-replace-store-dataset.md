# Thay bộ dữ liệu cửa hàng — checklist thực thi

Người dùng yêu cầu 60–70 sản phẩm, giữ tài khoản, xóa bộ cũ và tạo hoạt động hai tháng.
Không yêu cầu đổi mật khẩu hoặc tạo user. Mốc mô phỏng: 60 ngày 17/09–15/11/2026 (giờ VN).

- [x] Giữ 42 sản phẩm Minimart247, thu 23 sản phẩm bổ sung từ Co.op Online. Tổng 65 sản phẩm/ảnh, ghi rõ nguồn, tránh trùng quy cách.
- [x] Chuẩn hóa đơn vị, bổ sung costPrice/minStock/supplier mô phỏng có đánh dấu, giữ nguyên giá bán quan sát. Lưu nguồn thật riêng với các tham số mô phỏng.
- [x] Viết generator nhận catalog và tài khoản hiện có; tạo nhập/xuất/điều chỉnh/cảnh báo hai tháng. Không phát push thật. Kiểm chuỗi số tồn, quyền người thực hiện, thời gian, tham chiếu và stockVersion.
- [x] Viết công cụ thay dữ liệu store-1: dry-run mặc định, backup dữ liệu nghiệp vụ trước; apply phải được gọi rõ. Giữ users nguyên vẹn; thay products/transactions/notifications và xóa stocktake_items/sessions cũ trong cùng Mongo transaction. Không drop database hoặc xóa ảnh cũ. Yêu cầu dừng backend khi apply.
- [x] Test generator/core với fixture riêng, kiểm ảnh và schema; đã quan sát RED→GREEN cho generator, normalizedName/schema và thông báo lỗi sau commit. Mongo runtime còn chờ URI; không ghi URI/password vào report/log.
- [x] Sinh bộ xem trước và report; user đã cung cấp cấu hình local và dừng backend. Apply Mongo thực thành công: users hash giữ nguyên, counts/tham chiếu/tồn và 65 file ảnh runtime kiểm chứng đạt. HTTP/UI sau restart chưa kiểm tra.

Files dự kiến: fixtures/minimart247/*; scripts/store-dataset.ts; scripts/store-dataset.spec.ts;
scripts/replace-store-data.ts; scripts/replace-store-data.spec.ts; package.json (commands); docs/PROJECT_PROGRESS.md.

Ruling: Bổ sung nguồn Co.op cho đủ 65, không gọi chúng là sản phẩm cào từ Minimart247.
Ruling: Giữ nguyên mọi user và file ảnh cũ; chỉ thay nghiệp vụ store-1, từ chối nếu có store khác khi chưa được xác định.
Ruling: Tái dùng mô hình/schema/permission/kiểm ảnh hiện có; không thêm dependency. Không dùng checkDemo/buildDemo cũ vì hardcode 60 sản phẩm, 30 ngày và tạo lại user.
Ruling: Không tạo giả hồ sơ UC07; các ADJUSTMENT mô phỏng là thao tác kho trực tiếp hợp lệ, phiên kiểm kê cũ được sao lưu và dọn vì tham chiếu sản phẩm cũ.

Kết quả bản xem trước: 65 sản phẩm/65 ảnh, 1.587 giao dịch, 109 cảnh báo, 6 tài khoản
được tham chiếu từ API hiện tại; 1.761 document kiểm đúng schema Mongo, replay tồn đạt.
`preview.csv` cũ bị Excel khóa nên xuất bản mới `preview-65.csv`; không ép đóng Excel.
Review độc lập: không Critical; đã sửa thông báo lỗi sau commit để tránh gây hiểu nhầm rồi chạy lặp.
Đã apply sau khi user lưu cấu hình vào .env local (Git bỏ qua) và dừng backend.
Backup: .local-backups/store-1-before-retail-1794811192366.json; report: .local-backups/replacement-report.json.
Đã kiểm chứng thực tế migration transaction, không coi đây là thay thế 15 ca integration/concurrency chưa chạy.
