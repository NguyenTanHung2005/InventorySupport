# Inventory Support

> **Chuyển đổi Gemini đang được kiểm thử:** xem [báo cáo và hướng dẫn mới](docs/AI_GEMINI_MIGRATION_REPORT.md). Xem báo cáo để biết trạng thái kiểm thử và hướng dẫn chi tiết.

Ứng dụng mobile (Expo / React Native, chạy được cả trên web) hỗ trợ cửa hàng nhỏ
kiểm kê sản phẩm: quét mã vạch / quét ảnh bằng AI, theo dõi nhập - xuất - tồn,
cảnh báo tồn kho thấp và chuẩn hóa mô tả sản phẩm bằng AI.

## Cấu trúc project

```text
InventorySupport/
├── App/InventorySupport/              # Expo SDK 57, React Native, React Navigation
│   ├── App.tsx                       # Khởi tạo ứng dụng và các provider
│   └── src/
│       ├── navigation/               # Điều hướng đăng nhập, các tab và màn chi tiết
│       ├── screens/
│       │   ├── auth/                 # Đăng nhập, đăng ký
│       │   ├── dashboard/            # Tổng quan kho
│       │   ├── products/             # Danh sách, chi tiết, form sản phẩm
│       │   ├── inventory/            # Nhập, xuất, kiểm kê
│       │   ├── scanner/              # Quét mã, quét liên tục, ảnh và phiếu nhập
│       │   ├── ai/                   # Hỏi đáp kho, chuẩn hóa và thẻ đề xuất
│       │   ├── reports/              # Báo cáo nhập–xuất–tồn
│       │   ├── notifications/        # Thông báo tồn kho
│       │   ├── users/                # Quản lý nhân viên
│       │   └── account/              # Tài khoản, đổi mật khẩu
│       ├── components/               # UI dùng chung, thẻ sản phẩm, AiSuggestionCard
│       ├── services/                 # Gọi API, upload và ánh xạ gợi ý AI vào form
│       ├── store/                    # Trạng thái đăng nhập, chat, thông báo
│       ├── hooks/                    # Phân trang, tải lại khi mở màn hình
│       ├── types/                    # Kiểu dữ liệu và contract API phía app
│       ├── constants/                # Địa chỉ API, quyền, theme
│       └── utils/                    # Định dạng, hộp thoại, nhập Excel
├── Server/backend/                   # NestJS 12, TypeScript ESM
│   ├── src/
│   │   ├── main.ts                   # Khởi động API, CORS, phục vụ ảnh upload
│   │   ├── app.module.ts             # Ghép các module và Observe
│   │   ├── auth/                     # JWT, đăng nhập và guards phân quyền
│   │   ├── users/                    # Tài khoản và vai trò
│   │   ├── products/                 # Sản phẩm, barcode/QR, đối chiếu ứng viên
│   │   ├── inventory/                # Kiểm tra và lưu giao dịch kho
│   │   ├── ai/
│   │   │   ├── ai.service.ts         # Chuẩn hóa, điều phối Gemini và lỗi
│   │   │   ├── gemini-product-vision.ts # Prompt, schema và adapter Gemini
│   │   │   └── assistant/            # Hội thoại, công cụ tra kho, phiên và đề xuất
│   │   ├── uploads/                  # Kiểm tra, lưu ảnh theo cửa hàng
│   │   ├── notifications/            # Cảnh báo tồn kho và push
│   │   ├── database/                 # MongoDB/Mongoose, fixture riêng cho test
│   │   └── common/                   # Kiểu dữ liệu, quyền, validation
│   ├── test/                         # Kiểm thử E2E API; unit test nằm cạnh source
│   ├── fixtures/mini-mart/           # Bộ mẫu 30 ngày kèm 60 ảnh sản phẩm
│   └── uploads/                      # Ảnh mặc định, tạo khi tải ảnh lên
└── docs/                             # Thiết kế AI, luồng quét, kế hoạch và nghiệm thu
```

## Kiến trúc và luồng nghiệp vụ

```mermaid
flowchart LR
  U[Nhân viên hoặc quản lý] --> A[App React Native / Web]
  A -->|HTTP + JWT| B[API NestJS]
  B --> P[Kiểm tra người dùng, quyền và cửa hàng]
  P --> S[Dịch vụ sản phẩm / kho / thông báo]
  S --> D[(DatabaseService: MongoDB)]
  P --> AI[Dịch vụ AI]
  AI --> C[Gemini API]
  AI -->|Tra cứu qua công cụ| S
  AI -->|Gợi ý, chưa ghi kho| A
```

Backend là nơi kiểm tra dữ liệu, quyền và số tồn; app chịu trách nhiệm nhập liệu, hiển thị
kết quả và nhận xác nhận. AI không truy cập file dữ liệu trực tiếp và không tự ghi kho.

Luồng làm việc chính:

1. **Đăng nhập:** app nhận JWT và quyền, sau đó hiển thị các chức năng phù hợp. Backend
   kiểm tra lại tài khoản trên mỗi request; dữ liệu được giới hạn theo cửa hàng.
2. **Chuẩn bị sản phẩm:** tìm theo tên/barcode, quét mã, nhập tay, nhập Excel hoặc dùng
   gợi ý AI. Sản phẩm mới được tạo với tồn bằng 0; nếu nhập tồn ban đầu trên form, app
   thực hiện thêm giao dịch nhập kho riêng sau khi tạo sản phẩm.
3. **Nhập–xuất–kiểm kê:** chọn đúng sản phẩm, nhập số lượng và xác nhận. Backend kiểm
   tra quyền, dữ liệu và tồn kho rồi lưu giao dịch cùng số tồn trước/sau, người thao tác,
   thời điểm và lý do. Không cho xuất vượt tồn.
4. **Theo dõi:** dữ liệu giao dịch phục vụ lịch sử, báo cáo và cảnh báo hàng sắp hết/hết hàng.

| Thao tác | Cách thay đổi tồn | Ví dụ |
|---|---|---|
| Nhập kho | Tồn mới = tồn cũ + số lượng nhập | 24 + 10 = 34 chai |
| Xuất kho | Tồn mới = tồn cũ − số lượng xuất | 24 − 3 = 21 chai |
| Kiểm kê | Đặt tồn bằng số đếm thực tế | Sổ ghi 24, đếm được 22 → tồn mới 22 |

Đơn vị kho phải được kiểm tra trước khi lưu: “2 thùng” không tự chuyển thành “2 chai”.
Báo cáo doanh thu là ước tính từ lượng xuất và giá bán, chưa phải hệ thống kế toán.

## Chạy backend

```powershell
cd Server\backend
npm install
$env:JWT_SECRET = "TTTTTT1261261261212121224254324534"
$env:MONGODB_URI = 'mongodb+srv://inventory_app:mongodb123@cluster0.s43hbmf.mongodb.net/inventory_support?retryWrites=true&w=majority'
# Seed database trống và copy ảnh trước lần chạy đầu:
npm run seed:demo
# Tùy chọn: bật AI nhận diện ảnh + chuẩn hóa mô tả bằng Gemini
$env:GEMINI_API_KEY = ".Ab8RN6KYY7qbUhIq2HD_Sz6GIIMqaGTmV3le8NPktGM5acc7Ww"
thêm AQ ở đầu apikey
npm run start:dev
```

### Cấu hình key Gemini

Đặt `GEMINI_API_KEY` trong môi trường chạy **backend**. Với PowerShell, chạy lệnh đặt
key ở trên rồi khởi động backend trong cùng cửa sổ; nếu backend đã chạy thì dừng và chạy
lại. Biến `$env:...` chỉ có hiệu lực trong cửa sổ đó và các tiến trình được khởi động từ nó.

Project hiện đọc `process.env`, chưa tự nạp file `.env`; chỉ tạo file `.env` chưa đủ để
bật AI. Không đặt key trong `App/InventorySupport`, biến `EXPO_PUBLIC_*` hoặc commit Git.
`GET /ai/status` yêu cầu đăng nhập và quyền dùng AI; kết quả chỉ cho biết đã có cấu hình,
không chứng minh key hợp lệ hoặc Gemini đang kết nối thành công.

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `JWT_SECRET` | `development-only-secret` | Khóa ký JWT (bắt buộc đổi khi triển khai) |
| `PORT` | `3000` | Cổng HTTP |
| `MONGODB_URI` | Bắt buộc | URI MongoDB, phải chỉ rõ database; không fallback JSON |
| `UPLOAD_DIR` | `uploads` | Thư mục lưu ảnh sản phẩm |
| `GEMINI_API_KEY` | (trống) | Có key thì AI dùng Gemini; nếu thiếu key thì thông báo chưa cấu hình |
| `AI_MODEL` | `gemini-3.5-flash-lite` | Model Gemini dùng cho AI |
| `AI_EFFORT` | `low` | Mức suy luận của trợ lý hỏi đáp (`low`/`medium`/`high`) |
| `AI_RATE_LIMIT` | `20` | Số câu hỏi trợ lý / 5 phút / người dùng |

Dữ liệu được ghi ra `data/db.json` sau mỗi thao tác, nên khởi động lại không mất.
Lớp `DatabaseService` đã tách riêng để sau này thay bằng PostgreSQL mà không đổi API.

Kiểm thử:

```powershell
npm test            # unit test
npm run test:e2e    # e2e: phân quyền, nhập/xuất, cảnh báo, upload
npm run lint
```

Nếu Vitest mặc định báo `spawn EPERM` khi tải config trên Windows/sandbox, dùng:

```powershell
npm test -- --configLoader native --pool=threads
npm run test:e2e -- --configLoader native --pool=threads
```

Các lệnh kiểm tra bổ sung: `npm run build` và `node node_modules/typescript/bin/tsc --noEmit`
trong backend; `npm run lint` và `node node_modules/typescript/bin/tsc --noEmit` trong app.

### Tài khoản demo sau khi seed (mật khẩu chung `MiniMart123!`)

| Email | Vai trò |
|---|---|
| `admin@minimart.example` | ADMIN |
| `manager@minimart.example` | MANAGER |
| `staff1@minimart.example`, `staff2@minimart.example`, `staff3@minimart.example` | STAFF |
| `viewer@minimart.example` | VIEWER |

## Chạy mobile

```powershell
cd App\InventorySupport
npm install
npm run start      # hoặc: npm run web
```

App **tự tìm địa chỉ backend**, nên thường không cần cấu hình gì:

| Chạy trên | Địa chỉ được dùng |
|---|---|
| Expo Go / development build | IP LAN của máy đang chạy Metro, cổng 3000 |
| Android emulator (Metro ở localhost) | `http://10.0.2.2:3000` (địa chỉ của máy tính host) |
| Web | Cùng hostname với trang, cổng 3000 |
| Ghi đè | `$env:EXPO_PUBLIC_API_URL = "http://<ip>:3000"` (bắt buộc khi dùng `--tunnel`) |

Màn đăng nhập hiển thị địa chỉ máy chủ kèm trạng thái 🟢/🔴. Khi khởi động, backend in ra
các địa chỉ LAN có thể dùng.

**Không kết nối được từ điện thoại hoặc emulator?**

1. Kiểm tra backend đang chạy: mở `http://localhost:3000/health` trên máy tính.
2. Điện thoại và máy tính phải dùng cùng một mạng Wi-Fi.
3. Windows Firewall: nếu Wi-Fi đang ở chế độ *Public* và có rule *Block* cho
   "Node.js JavaScript Runtime", hãy mở PowerShell **với quyền Administrator** và chạy:

   ```powershell
   New-NetFirewallRule -DisplayName "Inventory Support API 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Public
   ```

   Hoặc chuyển mạng Wi-Fi sang *Private* (Settings → Network → Wi-Fi → Network profile).

## Lưu và khôi phục phiên đăng nhập

```text
Đăng nhập thành công → lưu token → mở ứng dụng
Mở lại ứng dụng → đọc token → GET /auth/me → tải user/quyền hiện tại → mở màn làm việc
Đăng xuất hoặc server trả 401 cho token đang dùng → xóa token và phiên trên app
```

- Android/iOS dùng `expo-secure-store`; web dùng `localStorage` theo origin trình duyệt.
  Chỉ lưu token, không lưu mật khẩu hoặc bản sao quyền để tự cấp quyền offline.
- Trong lúc khôi phục, app hiển thị loading, chưa mở màn làm việc hoặc chớp màn đăng nhập.
- `/auth/me` chờ tối đa 10 giây. Nếu mất mạng/backend chưa chạy hoặc bộ nhớ thiết bị lỗi,
  app cho thử lại; không xóa token chỉ vì không kết nối được. Có thể chọn xóa phiên để
  đăng nhập tài khoản khác. Xóa storage thất bại sẽ được báo, không giả báo đăng xuất xong.
- JWT hiện có hạn **8 giờ từ lúc đăng nhập**, không tự gia hạn. Token hết hạn, tài khoản
  bị khóa hoặc khóa JWT server thay đổi sẽ yêu cầu đăng nhập lại.
- Web localStorage có thể bị đọc bởi script cùng origin; khi triển khai web cần bảo vệ
  cao hơn, cân nhắc chuyển xác thực sang cookie HttpOnly ở một thay đổi backend riêng.

Cài native module đúng phiên bản SDK trước khi chạy trên điện thoại:

```powershell
cd App\InventorySupport
npx expo install expo-secure-store
```

SecureStore có trong Expo Go. Nếu đang dùng development build riêng, cần build lại sau
khi thêm native module. Tham khảo [Expo SDK 57 SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore.md).

## Quét mã vạch / QR / hình ảnh

Chi tiết nhu cầu, luồng xử lý và giới hạn: [docs/SCAN.md](docs/SCAN.md). Màn **Quét** có 3 chế độ:

- **Tra cứu**: quét một mã vạch, tem QR của cửa hàng hoặc QR chuẩn GS1 để xem giá, tồn và thao tác nhanh. Mã chưa có thì tạo sản phẩm ngay.
- **Liên tục**: kiểm kê, nhập hàng hoặc xuất nhiều món; mỗi lần quét +1, lưu một lần qua `POST /inventory/batch` (tất cả hoặc không).
- **Ảnh AI**: nhận diện sản phẩm từ bao bì, hoặc đọc phiếu giao hàng để nhập kho hàng loạt sau khi duyệt.

Sản phẩm không có mã vạch vẫn có **tem QR** (nút "Tem QR" ở chi tiết sản phẩm) để in dán kệ.

## Trợ lý AI

AI có bốn luồng. Chuẩn hóa và nhận diện dùng **structured output** (JSON theo schema);
hỏi đáp dùng **tool use** (model yêu cầu backend chạy công cụ tra cứu). Cả hai đều trả về
thông tin để người dùng duyệt, không thay thế API lưu nghiệp vụ.

### 1. Chuẩn hóa từ tên sản phẩm

```text
Nhập tên/mô tả → POST /ai/normalize-product → Gemini sửa chính tả, tách từng sản phẩm
  → backend kiểm tra kết quả và đối chiếu kho → hiển thị từng thẻ gợi ý có thể sửa
  → người dùng áp dụng vào form hoặc mở sản phẩm có sẵn → xác nhận lưu/nhập kho
```

Ví dụ đầu vào: `nuoc ngot coca chai 390ml; banh oreo goi 133g`. Kết quả mong đợi là
hai thẻ độc lập, mỗi thẻ có tên đã chuẩn hóa, mô tả riêng, danh mục và đơn vị phù hợp.

| Trường kết quả | Ý nghĩa |
|---|---|
| `correctedText` | Toàn bộ đầu vào sau sửa chính tả |
| `suggestions[].name` | Cụm tên gốc của riêng sản phẩm |
| `suggestions[].normalizedName` | Title/tên hiển thị đã biên tập, ánh xạ vào tên trong form |
| `suggestions[].description` | Mô tả riêng, không chỉ sao chép title |
| `suggestions[].category`, `unit` | Danh mục và đơn vị gợi ý |
| `suggestions[].matchedProducts` | Sản phẩm có sẵn có thể phù hợp trong đúng cửa hàng |

- Tối đa 5 sản phẩm mỗi lần; quá giới hạn thì yêu cầu chia nhỏ, không âm thầm bỏ món.
- Hai món cùng danh mục hoặc khác quy cách vẫn là hai sản phẩm. `1,5 lít` là số đo,
  không tự coi dấu phẩy là ranh giới sản phẩm.
- Người dùng duyệt title/mô tả và xác nhận đơn vị trước khi áp dụng; không tự chọn
  `suggestions[0]` để ghi đè form. Khi sửa sản phẩm có sẵn, áp dụng AI giữ nguyên đơn vị kho.
- Tên gần giống chỉ là ứng viên; biến thể mới vẫn có thể mở form với cảnh báo đối chiếu.
- AI không tự đoán giá, số lượng nhập, barcode hay đặc tính còn thiếu. Chuẩn hóa chuẩn bị
  thông tin sản phẩm; người dùng bổ sung dữ liệu giao dịch rồi xác nhận nhập kho riêng.

### 2. Hỏi đáp và đề xuất thao tác kho

```text
Câu hỏi + sessionId → POST /ai/assistant/chat → Gemini chọn công cụ
  → backend kiểm tra quyền và đọc dữ liệu cửa hàng → trả kết quả cho Gemini
  → câu trả lời/thẻ đề xuất → người dùng xác nhận → API nghiệp vụ lưu
```

Các câu hỏi như “Coca còn bao nhiêu?”, “Hàng nào sắp hết?”, “Giao dịch hôm nay” dùng công
cụ tìm sản phẩm, đọc tồn, lịch sử hoặc báo cáo. Một lượt tối đa 6 vòng tra cứu. Yêu cầu
“xuất 3 chai Coca” tạo thẻ đề xuất; chỉ nút xác nhận mới gọi `POST /inventory/movement`.
Đề xuất tạo sản phẩm mở form để người dùng kiểm tra rồi lưu.

Sau khi giao dịch kho đã lưu, app gửi `transactionId` tới endpoint xác nhận action.
Backend đối chiếu giao dịch thật và nối kết quả vào ngữ cảnh; bước này không ghi kho lần
nữa và không gọi model. Nếu đồng bộ chat lỗi, giao dịch đã lưu vẫn được giữ nguyên.

Phiên chat ở RAM, tối đa 30 lượt và hết hạn sau 2 giờ không hoạt động. Đổi vai trò/model
hoặc khởi động lại backend có thể khiến app phải mở phiên mới. Lượt AI lỗi được khôi phục
về mốc trước lượt đó; reset trên app bỏ qua response cũ còn đang chạy.

### 3. Nhận diện sản phẩm từ ảnh

```text
Chụp/chọn ảnh → POST /uploads/image → POST /ai/scan-image
  → Gemini nhận diện → backend đối chiếu barcode/tên/quy cách → thẻ duyệt
  → mở sản phẩm có sẵn hoặc form tạo mới với ảnh vừa tải
```

Không đoán mã vạch khi ảnh không đọc rõ. Các ứng viên được lọc theo cửa hàng; response
ứng viên AI không chứa giá nhập với người thiếu quyền. Thẻ dùng cùng cơ chế sửa title,
mô tả, danh mục, đơn vị với luồng chuẩn hóa văn bản.

### 4. Đọc phiếu giao hàng để nhập kho

```text
Ảnh phiếu → upload → POST /ai/scan-invoice → AI trích từng dòng hàng
  → backend tìm ứng viên → người dùng chọn sản phẩm, duyệt số lượng/đơn vị
  → POST /inventory/batch → kiểm tra toàn bộ rồi lưu giao dịch
```

Chỉ chọn sẵn một ứng viên duy nhất khi đơn vị khớp rõ ràng. Nhiều ứng viên, thiếu hoặc
khác đơn vị thì cần người dùng chọn; không mặc nhiên nhập vào sản phẩm đứng đầu.
Người có quyền có thể chọn cập nhật giá nhập theo phiếu; đây là bước riêng sau khi lưu kho.

### Giới hạn và xử lý lỗi AI

Khi Gemini bị giới hạn hoặc lỗi kết nối, ứng dụng hiển thị thông báo và giữ dữ liệu đang nhập. Người dùng có thể thử lại hoặc thao tác kho thủ công. Không có fallback offline tự động.

Mỗi lời gọi Gemini có timeout; một lượt chat tối đa 60 giây. Không tự lặp thao tác ghi kho. Người dùng cần kiểm tra lại sản phẩm, quy cách và số lượng trước khi xác nhận.
Chi tiết thiết kế: [docs/AI_ASSISTANT.md](docs/AI_ASSISTANT.md). Luồng quét:
[docs/SCAN.md](docs/SCAN.md). Bộ ca nghiệm thu và giới hạn kiểm chứng:
[docs/AI_NORMALIZATION_EVAL.md](docs/AI_NORMALIZATION_EVAL.md).

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
  `/ai/scan-image` gửi ảnh cho Gemini (structured output) → trả về tên chuẩn, danh mục,
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
| POST · DELETE | `/ai/assistant/chat` · `/ai/assistant/sessions/:id` | Dùng AI |
| POST | `/ai/assistant/sessions/:id/actions/:actionId/confirm` (`transactionId`) | Dùng AI; chỉ xác minh giao dịch đã lưu |
| GET | `/health` | Công khai |
| GET | `/products/resolve?raw=` · `/products/:id/label` | Xem sản phẩm |
| POST | `/inventory/batch` | Theo loại giao dịch |
| POST | `/ai/scan-invoice` | Dùng AI + Nhập kho |
| GET | `/notifications` · `/notifications/unread-count` | Quản trị viên, Quản lý |
| POST | `/notifications/:id/read` · `/notifications/read-all` · `/notifications/push-token` | Quản trị viên, Quản lý |
| GET · POST · PATCH · DELETE | `/users` · `/users/:id` | Quản lý tài khoản |

Mobile không giữ API key của nhà cung cấp AI; mọi yêu cầu AI đều đi qua backend.
