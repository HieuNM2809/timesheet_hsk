# Đăng nhập và Tính Giờ Làm Việc (Chrome Extension)

Extension lấy token đăng nhập từ **cookie `wshr-token`** của Hasaki, gọi API chấm công và **tính giờ làm việc** (dư/thiếu so với chuẩn 8 giờ/ngày, đã trừ 1 giờ nghỉ trưa).

Có **2 cách dùng**:
1. **Widget nổi ngay trên trang** `work.hasaki.vn` — nút tròn ở góc phải màn hình, bấm để mở bảng giờ làm.
2. **Popup** — bấm icon extension trên thanh công cụ.

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
5. Chọn đúng thư mục chứa file `manifest.json`.
6. Extension **"Đăng nhập và Tính Giờ Làm Việc"** sẽ xuất hiện trong danh sách.
7. (Khuyến khích) Ghim icon extension lên thanh công cụ để dễ mở.

> **Lưu ý:** Sau mỗi lần cập nhật code, hãy quay lại trang extensions và nhấn nút **Reload (🔄)** để áp dụng thay đổi (đặc biệt khi thay đổi `manifest.json`, quyền, hoặc `background.js`).

---

## 3. Cách sử dụng

### Cách 1 — Widget nổi trên trang (khuyến khích)

1. Đăng nhập và mở/refresh trang **https://work.hasaki.vn**.
2. Bấm **nút tròn ⏱ màu xanh lá** ở góc phải màn hình.
3. Panel mở ra, **tự tải dữ liệu tháng hiện tại**, hiển thị:
   - **Avatar + tên nhân viên** ở đầu.
   - **Tổng kết**: Tổng giờ dư, Tổng giờ thiếu, Giờ cuối cùng.
   - **Bảng chi tiết**: Ngày, Check-in, Check-out, Kết quả, Nửa ngày.
4. Muốn xem kỳ khác: đổi **Từ ngày / Đến ngày** rồi bấm **Xem**.

### Cách 2 — Popup từ icon extension

1. Đăng nhập **https://work.hasaki.vn** ít nhất một lần (để có cookie).
2. Bấm icon extension trên thanh công cụ.
3. Popup tự tải tháng hiện tại; đổi ngày rồi bấm **"Đăng nhập & Lấy dữ liệu"**, hoặc **"← Chọn lại tháng"** để quay lại form.

---

## 4. Cách tính giờ

Với mỗi ngày **có check-out**:

```
Giờ làm thực tế = (check_out - check_in) / 3600 - 1   (trừ 1 giờ nghỉ trưa)
Chênh lệch      = Giờ làm thực tế - 8
```

- Chênh lệch ≥ 0 → **Dư** (màu xanh).
- Chênh lệch < 0 → **Thiếu** (màu đỏ, dòng được tô nền cảnh báo).
- **Giờ cuối cùng** = Tổng giờ dư − Tổng giờ thiếu.

> Ngày **chưa check-out** hiển thị "⚠ Chưa check-out" và không tính vào tổng kết.

### Nửa ngày (4 giờ)

Mỗi dòng có ô tick **"Nửa ngày (4h)"**. Khi tick, ngày đó chỉ cần **4 giờ** thay vì 8:

```
Chênh lệch = Giờ làm thực tế - 4   (thay vì - 8)
```

Kết quả dòng đó và toàn bộ tổng kết được **tính lại ngay** khi tick/bỏ tick. Lựa chọn được giữ khi tải lại cùng khoảng ngày (trong phiên).

---

## 5. Cấu trúc file

| File | Vai trò |
|------|---------|
| `manifest.json` | Khai báo extension, quyền (`storage`, `tabs`, `cookies`), host cho phép, `background` và `content_scripts`. |
| `background.js` | Service worker: đọc cookie `wshr-token` qua `chrome.cookies`, gọi API profile + timesheet (bỏ qua CORS nhờ host_permissions). |
| `content.js` | Widget nổi trên `work.hasaki.vn`: dựng UI bằng Shadow DOM, gửi message cho `background.js` để lấy dữ liệu. |
| `popup.html` | Giao diện popup (form chọn ngày + avatar + bảng + tổng kết). |
| `popup.js` | Logic popup: đọc cookie qua `chrome.cookies`, gọi API, tính giờ, render, xử lý nút chọn lại tháng. |
| `checkin.png` | Icon của extension. |

---

## 6. Kiến trúc & lấy token

- **Popup** (`popup.js`) đọc cookie trực tiếp bằng `chrome.cookies.get`, thử lần lượt domain `wshr.hasaki.vn` rồi `work.hasaki.vn`, rồi tự `fetch` API.
- **Widget** (`content.js`) không dùng được `chrome.cookies` (giới hạn content script) nên gửi message tới **`background.js`**; service worker đọc cookie và gọi API hộ, tránh cả vấn đề CORS.
- API sử dụng:
  - `GET /api/setting/user/profile?employee=1` — lấy avatar + tên.
  - `GET /api/hr/timesheet/login-user?from_date=...&to_date=...` — lấy dữ liệu chấm công.

---

## 7. Xử lý sự cố

| Vấn đề | Nguyên nhân & cách khắc phục |
|--------|------------------------------|
| **"Không lấy được token"** | Chưa đăng nhập hoặc phiên hết hạn → đăng nhập lại `work.hasaki.vn`. Nếu vừa cập nhật quyền/`background.js`, hãy **Reload** extension. |
| **"Không kết nối được extension"** (widget) | Sau khi Reload extension, hãy **refresh lại trang** `work.hasaki.vn` để content script nạp lại. |
| **"Đã xảy ra lỗi khi gọi API"** | Token hết hạn (401) hoặc mất mạng → đăng nhập lại và thử lại. |
| **Không có dữ liệu hiển thị** | Khoảng ngày không có dữ liệu chấm công, hoặc API trả về lỗi. |
| **Không thấy nút nổi** | Đảm bảo đang ở `work.hasaki.vn`; Reload extension rồi refresh trang. |
| Icon không hiện | Kiểm tra extension đã được bật trong `chrome://extensions`. |

---

## 8. Quyền riêng tư

- Extension chỉ đọc cookie `wshr-token` để gắn vào header `Authorization` khi gọi API Hasaki.
- Không gửi token đi bất kỳ máy chủ nào ngoài **`https://wshr.hasaki.vn`**.
