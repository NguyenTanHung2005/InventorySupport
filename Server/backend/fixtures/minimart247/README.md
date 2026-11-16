# Bộ dữ liệu cửa hàng: 65 sản phẩm

Phiên bản mở rộng: **42 Minimart247 + 23 Co.op Online**, giữ nguồn từng mặt hàng riêng.
Lịch sử hoạt động **mô phỏng 60 ngày 17/09–15/11/2026**, gồm 1.587 giao dịch
và 109 cảnh báo với 6 tài khoản hiện có. Không dùng tồn/đã bán của các website làm tồn project.
Giá bán là giá quan sát hiện tại; không phải lịch sử giá thật trong hai tháng đó.

Thu thập ngày 16/11/2026 từ https://www.minimart247.com/san-pham.
Đã đọc toàn bộ 4 trang danh sách (12 + 12 + 12 + 6 sản phẩm), 42 trang chi tiết,
và tải 42 ảnh chính của sản phẩm. robots.txt công khai không chặn các đường dẫn này.

## Kết quả và file

- 65 sản phẩm và 65 ảnh local được chọn; giá bán công bố từ 11.000 đến 396.000 VND.
- 14 danh mục: Văn phòng phẩm; Mẹ và bé; Đồ gia dụng; Hoá phẩm – Vệ sinh nhà cửa;
  Chăm sóc cá nhân; Cà phê – trà; Sữa các loại; Nước giải khát; Bánh kẹo – ăn vặt;
  Đồ khô – đóng hộp; Dầu ăn – gia vị; Ngũ cốc – bột; Mì – bún – phở; Gạo.
- `catalog.json`: payload đúng các trường CreateProductDto hiện tại.
- `preview-65.csv`: bảng Excel UTF-8 BOM mới. `preview.csv` cũ chỉ có 42 dòng,
  đang bị Excel khóa lúc cập nhật nên được giữ nguyên; không dùng làm bản mới.
- `activity-preview.json`: toàn bộ sản phẩm/tồn cuối/giao dịch/cảnh báo mô phỏng,
  tham chiếu ID tài khoản đang có. Công cụ apply sẽ sinh lại theo tài khoản thực trong database.
- `sources.json`: SKU nguồn, URL trang/ảnh, SHA-256 ảnh, thời điểm quan sát,
  trường thật/trường mặc định và thông tin tồn/đã bán của website chỉ để đối chiếu.
- `images/`: ảnh gốc JPEG/WEBP; không dùng ảnh banner hoặc ảnh sản phẩm liên quan.
- `summary.json`, `validation.json`: thống kê và kết quả kiểm tra.
- `raw/`, `listing.json`, `download-errors.json`: snapshot và kết quả thu thập;
  danh sách lỗi tải ảnh gốc hiện rỗng. `coop-source-records.json` giữ bản ghi nguồn bổ sung;
  `supplemental-errors.json` ghi một ứng viên bị loại vì giá giữa hai phần trang không khớp,
  đã chọn sản phẩm khác thay thế và không đưa ứng viên lỗi vào catalog.

Khi đưa lên Git: giữ catalog, sources, images, preview-65.csv và các script/test.
`raw/`, activity-preview.json (sinh lại được), preview.csv 42 dòng cũ, bộ MINISTOP
đã bỏ và workspace `.superpowers/` chỉ lưu local hoặc có thể dọn; đã có .gitignore.
Không đưa .env, uploads, node_modules, dist/dist-demo hoặc .local-backups lên Git.

## Ánh xạ sang project

| Trường | Cách lấy |
| --- | --- |
| name | Tiêu đề trang sản phẩm |
| description | Phần mô tả sản phẩm, bỏ đoạn cam kết giao hàng/đổi trả chung |
| category | Danh mục breadcrumb của sản phẩm |
| price | Giá bán hiện tại, không lấy giá gạch ngang |
| barcode | `MM247-` hoặc `COOP-` + SKU nguồn, không giả là barcode bao bì |
| unit | Đơn vị bán từ tên/UOM nguồn; 12 dòng thiếu trước đây đã bổ sung theo loại bao gói và đánh dấu suy luận |
| costPrice | **Mô phỏng:** 72% giá bán, làm tròn 500 VND |
| supplier | **Mô phỏng:** “Nhà phân phối mô phỏng”, không nhận nhầm website là nhà cung cấp |
| minStock | **Mô phỏng:** 3 nếu giá từ 150.000 VND, còn lại 8 |

SKU website không phải mã EAN/UPC trên bao bì. Namespace `MM247-` tránh va chạm
với mã nguồn khác; có thể in tem QR nội bộ hoặc bổ sung barcode thật sau.
Không tự biến số tồn/đã bán của website thành số tồn/lịch sử của project.
Thông tin giá, mô tả, tồn từ website là dữ liệu được công bố tại lúc thu thập,
chưa kiểm chứng độc lập với nhà sản xuất/cửa hàng.

## Trạng thái

**Đã thay database thành công ngày 16/11/2026**, giữ nguyên 6 tài khoản.
Database có 65 sản phẩm, 1.587 giao dịch, 109 cảnh báo; phiên kiểm kê cũ đã được dọn.
Đã kiểm SHA-256 toàn bộ 65 ảnh runtime, hash users trước/sau và replay tồn cuối từ Mongo đạt.
Backup/report nằm trong Server/backend/.local-backups (Git bỏ qua). Không chạy lại apply để kiểm tra.
Giao dịch/cảnh báo là mô phỏng rõ nhãn,
không phải dữ liệu hoạt động website hoặc nhật ký lịch sử thật của các tài khoản này.

Trong `Server/backend`, cấu hình MONGODB_URI/UPLOAD_DIR trong terminal hoặc `.env` local:

```powershell
# Xem trước; không ghi database hoặc ảnh runtime
npm run data:replace

# Dừng backend trước, rồi thay dữ liệu đã được yêu cầu
npm run data:replace -- --apply
```

Công cụ chỉ hỗ trợ store-1; giữ toàn bộ users nguyên vẹn, bao gồm mật khẩu, role,
token và timestamps. Sao lưu products/transactions/notifications/stocktake_sessions/items
vào `.local-backups/` (Git bỏ qua), kiểm lại bản sao trước khi ghi.
Thay dữ liệu nghiệp vụ trong cùng transaction; lỗi giữa chừng rollback bộ cũ.
Xóa các phiên kiểm kê cũ vì còn tham chiếu sản phẩm cũ; không tạo giả phiên UC07.
Không phát push thật. Backend phải dừng để không có thao tác kho xen giữa;
sau apply khởi động lại backend và tải lại app để bỏ cache phiên cũ.

Ảnh được copy vào UPLOAD_DIR/store-1 bằng tên theo SHA-256, không ghi đè ảnh khác.
Không xóa ảnh cũ. Nếu transaction lỗi sau copy ảnh, các file mới có thể còn nhưng bộ cũ được giữ.
Report thành công tại `.local-backups/replacement-report.json`; không ghi URI/password vào report.
Backup chỉ lưu nghiệp vụ: phục hồi cần dừng backend, dùng đúng database/store và phục hồi 5 collection
trong transaction; không đưa users hay cấu hình mật khẩu vào thao tác phục hồi.

Công cụ thay dữ liệu dùng trực tiếp Mongo transaction để giữ timestamps lịch sử mô phỏng;
không dùng API create (API luôn khởi tạo tồn 0). ID, stockVersion và normalizedName
được sinh nhất quán, tồn cuối được kiểm bằng cách replay toàn bộ giao dịch từ 0.

Ảnh/nội dung giữ nguồn trong `sources.json`; không gán giấy phép mở cho ảnh.
