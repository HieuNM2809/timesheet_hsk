# Hướng dẫn cài đặt cơ bản

Cài extension "Tính Giờ Làm Việc" vào trình duyệt Chrome / Edge / Cốc Cốc.

---

## Bước 1: Tải extension về máy
Tải thư mục extension về và **giải nén** (nếu là file .zip/.rar) ra một thư mục, ví dụ:
`D:\extension`

> Bên trong thư mục phải có file `manifest.json`.

## Bước 2: Mở trang quản lý tiện ích
Mở trình duyệt và gõ vào thanh địa chỉ:

- Chrome: `chrome://extensions`
- Edge: `edge://extensions`
- Cốc Cốc: `coccoc://extensions`

Rồi nhấn **Enter**.

## Bước 3: Bật chế độ nhà phát triển
Bật công tắc **"Chế độ dành cho nhà phát triển" / "Developer mode"** ở **góc trên bên phải**.

## Bước 4: Nạp extension
1. Nhấn nút **"Tải tiện ích đã giải nén" / "Load unpacked"**.
2. Chọn đúng **thư mục** đã giải nén ở Bước 1 (thư mục chứa `manifest.json`).
3. Extension **"Đăng nhập và Tính Giờ Làm Việc"** sẽ hiện trong danh sách.

## Bước 5: Ghim ra thanh công cụ (tùy chọn)
Nhấn biểu tượng **mảnh ghép** 🧩 trên thanh công cụ → nhấn **đinh ghim 📌** cạnh extension để hiện icon ra ngoài.

---

## Cách dùng nhanh
1. Đăng nhập trang **https://work.hasaki.vn**.
2. **Cách A:** Bấm **nút tròn xanh lá** ở góc phải màn hình trên trang work.hasaki.vn.
3. **Cách B:** Bấm **icon extension** trên thanh công cụ.
4. Bảng giờ làm sẽ tự hiện dữ liệu **tháng hiện tại**.

---

## Khi cập nhật phiên bản mới
Sau khi thay code mới, vào lại `chrome://extensions` và nhấn nút **Reload (🔄)** ở ô extension, rồi **refresh lại trang** work.hasaki.vn.

---

## Gặp lỗi thường gặp
- **Không lấy được token** → đăng nhập lại `work.hasaki.vn` rồi thử lại.
- **Không thấy nút / không có dữ liệu** → Reload extension và refresh lại trang.
