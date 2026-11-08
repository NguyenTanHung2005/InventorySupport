# Inventory Support

Ứng dụng mobile hỗ trợ cửa hàng nhỏ kiểm kê sản phẩm, quản lý nhập/xuất kho,
cảnh báo tồn kho thấp và chuẩn hóa mô tả sản phẩm bằng AI.

## Chạy backend

```powershell
cd Server\backend
npm install
$env:JWT_SECRET = "change-this-secret"
npm run start:dev
```

Tài khoản demo:

```text
Email: owner@example.com
Mật khẩu: demo
```

Backend MVP hiện dùng repository in-memory để chạy demo nhanh. Các module và
service đã tách độc lập để thay repository bằng Prisma/PostgreSQL ở bước tiếp
theo mà không thay đổi API.

## Chạy mobile

```powershell
cd App\InventorySupport
npm install
$env:EXPO_PUBLIC_API_URL = "http://localhost:3000"
npm run start
```

Trên thiết bị thật, thay `localhost` bằng địa chỉ IP LAN của máy chạy backend.

## Giao diện mobile

Ứng dụng hiện có bốn khu vực chính:

- **Tổng quan:** thống kê sản phẩm, tổng tồn kho và cảnh báo sắp hết hàng.
- **Sản phẩm:** tìm kiếm theo tên, danh mục hoặc barcode.
- **Nhập / xuất kho:** chọn sản phẩm, nhập barcode, cập nhật số lượng và ghi chú.
- **Trợ lý AI:** chuẩn hóa mô tả sản phẩm và hiển thị độ tin cậy của đề xuất.
- AI tự sửa một số lỗi gõ tiếng Việt, tách các cụm danh từ khác loại thành nhiều
  gợi ý sản phẩm và cho phép chuyển từng gợi ý sang màn hình nhập kho.
- Có thể nhập danh sách sản phẩm từ Excel; các cột hỗ trợ gồm `name`/`Tên sản
  phẩm`, `barcode`/`Mã barcode`, `category`/`Danh mục`, `unit`/`Đơn vị`,
  `description`/`Mô tả`, `price`/`Giá` và `minStock`/`Tồn tối thiểu`.

Giao diện tự ẩn các thao tác cập nhật kho với tài khoản `VIEWER`; backend vẫn là
lớp kiểm tra quyền cuối cùng.

Mã nguồn mobile được tổ chức theo feature:

```text
App/InventorySupport/src/
├── screens/       # auth, dashboard, products, inventory, scanner, reports
├── components/   # ProductCard, StockBadge, RoleBasedView
├── services/     # API và service theo nghiệp vụ
├── navigation/   # AuthNavigator và AppNavigator
├── store/        # AuthProvider và phiên đăng nhập
├── types/
└── constants/
```

`App.tsx` chỉ khởi tạo `SafeAreaProvider`, `AuthProvider` và
`NavigationContainer`; giao diện được render qua navigator.

## API chính

| Method | Endpoint | Quyền |
|---|---|---|
| POST | `/auth/login` | Công khai |
| POST | `/auth/register` | Công khai, tạo STAFF/MANAGER/VIEWER |
| GET | `/products` | Đã đăng nhập |
| POST | `/products` | OWNER, MANAGER |
| POST | `/inventory/movement` | OWNER, MANAGER, STAFF |
| GET | `/inventory/low-stock` | Đã đăng nhập |
| GET | `/inventory/transactions` | Đã đăng nhập |
| POST | `/ai/normalize-product` | Đã đăng nhập |

Mọi API nghiệp vụ đều kiểm tra JWT, role và `storeId`. Mobile không giữ API key
của nhà cung cấp AI; các yêu cầu AI phải đi qua backend.
