# Inventory Support

Ứng dụng mobile (Expo / React Native, chạy được cả trên web) hỗ trợ cửa hàng nhỏ
kiểm kê sản phẩm: quét mã vạch / quét ảnh bằng AI, theo dõi nhập - xuất - tồn,
cảnh báo tồn kho thấp và chuẩn hóa mô tả sản phẩm bằng AI.

```text
App/InventorySupport   # Mobile (Expo SDK 57, React Navigation)
Server/backend         # API (NestJS 12, ESM)
```

## Chạy backend

```powershell
cd Server\backend
npm install
$env:JWT_SECRET = "change-this-secret"
# Tùy chọn: bật AI nhận diện ảnh + chuẩn hóa mô tả bằng Claude
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm run start:dev
```

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `JWT_SECRET` | `development-only-secret` | Khóa ký JWT (bắt buộc đổi khi triển khai) |
| `PORT` | `3000` | Cổng HTTP |
| `DATA_FILE` | `data/db.json` | File lưu dữ liệu. Đặt `memory` để chỉ giữ trong RAM |
| `UPLOAD_DIR` | `uploads` | Thư mục lưu ảnh sản phẩm |
| `ANTHROPIC_API_KEY` | (trống) | Có key thì AI dùng Claude; không có thì dùng bộ luật offline, riêng quét ảnh sẽ báo chưa cấu hình |
| `AI_MODEL` | `claude-opus-5-5` | Model Claude dùng cho AI |

Dữ liệu được ghi ra `data/db.json` sau mỗi thao tác, nên khởi động lại không mất.
Lớp `DatabaseService` đã tách riêng để sau này thay bằng PostgreSQL mà không đổi API.

Kiểm thử:

```powershell
npm test            # unit test
npm run test:e2e    # e2e: phân quyền, nhập/xuất, cảnh báo, upload
npm run lint
```

### Tài khoản demo (mật khẩu chung `demo123`)

| Email | Vai trò |
|---|---|
| `admin@example.com` | Quản trị viên |
| `manager@example.com` | Quản lý |
| `staff@example.com` | Nhân viên |

## Chạy mobile

```powershell
cd App\InventorySupport
npm install
$env:EXPO_PUBLIC_API_URL = "http://localhost:3000"
npm run start      # hoặc: npm run web
```

Trên thiết bị thật, thay `localhost` bằng địa chỉ IP LAN của máy chạy backend.

## Phân quyền

Ma trận quyền nằm ở `Server/backend/src/common/permissions.ts`. Mobile giữ một bản sao
(`src/constants/permissions.ts`) chỉ để ẩn/hiện nút bấm; backend luôn kiểm tra lại.

| Quyền | Quản trị viên | Quản lý | Nhân viên | Chỉ xem |
|---|:-:|:-:|:-:|:-:|
| Xem sản phẩm | ✓ | ✓ | ✓ | ✓ |
| Tạo / sửa / xóa sản phẩm | ✓ | ✓ | | |
| Nhập kho | ✓ | ✓ | | |
| Xuất kho | ✓ | ✓ | ✓ | |
| Kiểm kê (đặt lại số tồn thực tế) | ✓ | ✓ | | |
| Xem báo cáo | ✓ | ✓ | | ✓ |
| Dùng AI / quét ảnh | ✓ | ✓ | ✓ | |
| Quản lý tài khoản nhân viên | ✓ | | | |

- Đăng ký công khai luôn tạo tài khoản **Nhân viên ở trạng thái chưa kích hoạt**. Quản trị
  viên phải kích hoạt trước khi người đó đăng nhập được, để người lạ không xem được dữ
  liệu kinh doanh.
- Mỗi request đều đọc lại tài khoản từ cơ sở dữ liệu, nên khi admin đổi vai trò hoặc khóa
  tài khoản, thay đổi có hiệu lực ngay, không phải chờ token hết hạn.
- Không thể tự hạ quyền hoặc tự khóa chính mình, và cửa hàng luôn phải còn ít nhất một
  quản trị viên.

## Chức năng chính

- **Quét mã vạch / QR** (`expo-camera`): tìm thấy thì mở ngay thao tác nhập/xuất; chưa có
  thì cho tạo sản phẩm mới với mã vừa quét. Có ô nhập mã thủ công cho bản web.
- **Quét ảnh bằng AI**: chụp bao bì → ảnh được tải lên `/uploads/image` →
  `/ai/scan-image` gửi ảnh cho Claude (structured output) → trả về tên chuẩn, danh mục,
  đơn vị, mã vạch đọc được, và đối chiếu với sản phẩm có sẵn trong kho.
- **Sản phẩm**: giá bán, giá nhập (tự tính lãi), ảnh, mô tả, nhà cung cấp, tồn tối thiểu.
  Danh sách có phân trang, tìm kiếm không dấu, lọc theo danh mục và hàng sắp hết. Xóa
  mềm để giữ lại lịch sử. Hỗ trợ nhập từ Excel.
- **Nhập / Xuất / Kiểm kê**: mỗi giao dịch lưu số tồn trước/sau, người thực hiện và lý do;
  không cho xuất quá số tồn.
- **Cảnh báo tồn kho**: khi tồn vừa tụt xuống dưới mức tối thiểu hoặc về 0, hệ thống tạo
  thông báo cho Quản trị viên và Quản lý. Thông báo đến qua push của Expo (cần
  development build + EAS `projectId`) và qua polling 30 giây kèm local notification
  khi app đang mở.
- **Báo cáo**: tổng nhập/xuất theo kỳ, doanh thu ước tính, giá trị tồn kho, top sản phẩm
  xuất nhiều, sổ giao dịch có phân trang.

Excel hỗ trợ các cột `name`/`Tên sản phẩm`, `barcode`/`Mã barcode`,
`category`/`Danh mục`, `unit`/`Đơn vị`, `description`/`Mô tả`, `price`/`Giá bán`,
`costPrice`/`Giá nhập`, `supplier`/`Nhà cung cấp`, `minStock`/`Tồn tối thiểu`.

### Push notification

Expo Go không nhận được push từ xa. Để bật push:

1. `npx eas-cli@latest init` để có `extra.eas.projectId` trong `app.json`.
2. Build development: `npx eas-cli@latest build --profile development`.

Nếu chưa làm hai bước trên, app vẫn cảnh báo qua polling và local notification khi đang mở.

## API chính

Mọi danh sách đều nhận `?page=&limit=` (tối đa 100) và trả về
`{ items, total, page, limit, totalPages }`.

| Method | Endpoint | Quyền |
|---|---|---|
| POST | `/auth/login` | Công khai |
| POST | `/auth/register` | Công khai (tạo Nhân viên, chờ kích hoạt) |
| GET | `/auth/me` · POST `/auth/change-password` | Đã đăng nhập |
| GET | `/products?search=&category=&lowStock=true&sort=` | Xem sản phẩm |
| GET | `/products/categories` · `/products/:id` · `/products/barcode/:code` | Xem sản phẩm |
| POST · PATCH · DELETE | `/products` · `/products/:id` | Tạo · Sửa · Xóa sản phẩm |
| POST | `/inventory/movement` (`IMPORT`/`EXPORT`/`ADJUSTMENT`) | Theo loại giao dịch |
| GET | `/inventory/low-stock` · `/inventory/transactions` · `/inventory/summary` | Xem sản phẩm |
| POST | `/uploads/image` (JSON base64, tối đa 5MB, JPEG/PNG/WEBP) | Dùng AI |
| GET | `/ai/status` · POST `/ai/normalize-product` · `/ai/scan-image` | Dùng AI |
| GET | `/notifications` · `/notifications/unread-count` | Quản trị viên, Quản lý |
| POST | `/notifications/:id/read` · `/notifications/read-all` · `/notifications/push-token` | Quản trị viên, Quản lý |
| GET · POST · PATCH · DELETE | `/users` · `/users/:id` | Quản lý tài khoản |

Mobile không giữ API key của nhà cung cấp AI; mọi yêu cầu AI đều đi qua backend.
