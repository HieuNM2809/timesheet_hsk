# Đăng nhập và Tính Giờ Làm Việc (Chrome Extension)

Extension lấy token đăng nhập từ **cookie `wshr-token`** của Hasaki, gọi API chấm công và **tính giờ làm việc** (dư/thiếu so với chuẩn 8 giờ/ngày, đã trừ 1 giờ nghỉ trưa).

---

## 1. Yêu cầu

- Trình duyệt nhân **Chromium**: Google Chrome, Microsoft Edge, Brave, Cốc Cốc...
- Đã đăng nhập trang **https://work.hasaki.vn** (để cookie `wshr-token` tồn tại).

---

## 2. Cài đặt (chế độ Developer)

1. Tải/giải nén thư mục extension này về máy (ví dụ: `D:\HieuNM\Checkin\extension`).
2. Mở trình duyệt, vào địa chỉ:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Bật **Chế độ dành cho nhà phát triển / Developer mode** (góc trên bên phải).
4. Nhấn **Tải tiện ích đã giải nén / Load unpacked**.
5. Chọn đúng thư mục chứa file `manifest.json` (thư mục `extension`).
6. Extension **"Đăng nhập và Tính Giờ Làm Việc"** sẽ xuất hiện trong danh sách.
7. (Khuyến khích) Ghim icon extension lên thanh công cụ để dễ mở.

> **Lưu ý:** Sau mỗi lần cập nhật code, hãy quay lại trang extensions và nhấn nút **Reload (🔄)** để áp dụng thay đổi (đặc biệt khi thay đổi `manifest.json` như quyền `cookies`).

---

## 3. Cách sử dụng

1. Đăng nhập vào **https://work.hasaki.vn** ít nhất một lần (để có cookie).
2. Nhấn vào icon extension trên thanh công cụ để mở popup.
3. Chọn **Từ ngày** và **Đến ngày** (mặc định là từ đầu tháng đến hôm nay).
4. Nhấn **"Đăng nhập & Lấy dữ liệu"**.
5. Extension sẽ hiển thị:
   - **Bảng chi tiết**: Ngày, Nhân viên, Check-in, Check-out, Kết quả (dư/thiếu từng ngày).
   - **Tổng kết** (ở đầu): Tổng giờ dư, Tổng giờ thiếu, Giờ cuối cùng.

---

## 4. Cách tính giờ

Với mỗi ngày **có check-out**:

```
Giờ làm thực tế = (check_out - check_in) / 3600 - 1   (trừ 1 giờ nghỉ trưa)
Chênh lệch      = Giờ làm thực tế - 8
```

- Chênh lệch ≥ 0 → **Dư** (màu xanh).
- Chênh lệch < 0 → **Thiếu** (màu đỏ).
- **Giờ cuối cùng** = Tổng giờ dư − Tổng giờ thiếu.

> Ngày chưa check-out sẽ không được tính vào tổng kết.

---

## 5. Cấu trúc file

| File | Vai trò |
|------|---------|
| `manifest.json` | Khai báo extension, quyền (`storage`, `tabs`, `cookies`) và host cho phép. |
| `popup.html` | Giao diện popup (form chọn ngày + bảng + tổng kết). |
| `popup.js` | Logic chính: đọc cookie `wshr-token` qua `chrome.cookies`, gọi API, tính giờ, render. |
| `content.js` | Script phụ chạy trên `work.hasaki.vn` (đọc token dự phòng). |
| `checkin.png` | Icon của extension. |

---

## 6. Xử lý sự cố

| Vấn đề | Nguyên nhân & cách khắc phục |
|--------|------------------------------|
| **"Không lấy được token (cookie 'wshr-token')"** | Chưa đăng nhập hoặc phiên hết hạn → đăng nhập lại `work.hasaki.vn`. Nếu vừa cập nhật quyền, hãy **Reload** extension. |
| **"Đã xảy ra lỗi khi gọi API"** | Token hết hạn (401) hoặc mất mạng → đăng nhập lại và thử lại. |
| **Không có dữ liệu hiển thị** | Khoảng ngày không có dữ liệu chấm công, hoặc API trả về lỗi. |
| Icon không hiện | Kiểm tra extension đã được bật trong trang `chrome://extensions`. |

---

## 7. Quyền riêng tư

- Extension chỉ đọc cookie `wshr-token` để gắn vào header `Authorization` khi gọi API Hasaki.
- Không gửi token đi bất kỳ máy chủ nào ngoài **`https://wshr.hasaki.vn`**.
