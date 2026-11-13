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
| `snow.js` | Hiệu ứng tuyết + trang trí lễ hội trên `hasakiexpress.vn`, `test.hasakiexpress.vn`, `chat.hasaki.vn`. |
| `chat.js` | Bỏ chữ "(UTC+7)" trên `chat.hasaki.vn`. |
| `chat-quick-reply.js` | Thanh câu trả lời nhanh trên `chat.hasaki.vn` (xem mục 11). |
| `chat-mark-all-read.js` | Nút "Đọc tất cả" trên danh sách hội thoại `chat.hasaki.vn` (xem mục 12). |
| `chat-bookmark-sort.js` | Thanh sắp xếp cho tab "Đánh dấu" trên `chat.hasaki.vn` (xem mục 13). |
| `chat-avatar-hover.css` | Hiệu ứng phóng to avatar khi rê chuột trên `chat.hasaki.vn` (xem mục 14). |
| `chat-theme.css` | Bảng màu + giao diện tổng thể cho `chat.hasaki.vn` (xem mục 15). |
| `rules_chat_icon.json` + `chat-icon-*.png` | Thay icon PWA của `chat.hasaki.vn` khi cài app (xem mục 10). |
| `webadmin.js` | Nút đổi domain/port cho request API trên `webadmin.system.local` (xem mục 9). |
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

---

## 9. Đổi domain API trên webadmin.system.local

Chỉ trên `http://webadmin.system.local`, extension hiện thêm một nút tròn (biểu tượng ⇄) phía trên vị trí nút giờ làm việc. Nút này dùng để chuyển các request REST API của trang sang domain/port khác, ví dụ backend chạy ở máy mình.

**Cách dùng:**
1. Bấm nút ⇄ để mở panel, nhập domain đích, ví dụ `http://localhost:8080` hoặc `http://api.system.local:3000`. Nếu bỏ trống protocol thì mặc định là `http://`.
2. Tick **"Bật chế độ đổi domain"** (hoặc bấm **Lưu**). Cấu hình được áp dụng ngay cho request mới và lưu vào `localStorage`, nên tải lại trang vẫn còn.
3. Khi đang bật, nút chuyển sang **màu cam** và có nhãn `API → host:port`. **Đặt lại mặc định** sẽ xoá cấu hình và tắt chế độ đổi domain.

**Phạm vi đổi:**
- Áp dụng cho `fetch` và `XMLHttpRequest`, kể cả URL tương đối. Chỉ thay protocol, host và port; path, query, method, headers và body giữ nguyên.
- Chỉ đổi request API, gồm request **cùng origin** với webadmin và request có path bắt đầu bằng **`/api`** tới host `*.system.local`.
- Không đổi file tĩnh (`.js`, `.css`, ảnh, font, `.html`, file `.json` nằm ngoài `/api`) và không đổi request tới host bên ngoài như Sentry hay Google.
- Mỗi request bị đổi được ghi log trong DevTools > Console với tiền tố `[HSK Domain Switcher]`.

**Lưu ý CORS khi đổi sang domain/port khác:**
- Request trở thành cross-origin, nên backend đích phải trả `Access-Control-Allow-Origin: http://webadmin.system.local` (đúng origin, không dùng `*` nếu có gửi cookie).
- Request có `Authorization`, header `X-...`, `Content-Type: application/json` hoặc dùng `PUT/PATCH/DELETE` sẽ gửi **preflight OPTIONS**. Backend cần trả `Access-Control-Allow-Methods` và `Access-Control-Allow-Headers` phù hợp.
- Về cookie: `fetch` mặc định không gửi cookie sang origin khác. Nếu app đăng nhập bằng cookie, backend cần `Access-Control-Allow-Credentials: true`, app phải gửi kèm credentials, và cookie phải thuộc domain đích. Đăng nhập bằng token trong header thì không gặp vấn đề này.
- Trang `https` gọi sang `http` sẽ bị chặn vì mixed content. Gọi từ domain sang `localhost` có thể bị Chrome chặn bởi Local Network Access: cho phép khi Chrome hỏi, hoặc backend trả thêm `Access-Control-Allow-Private-Network: true`.

**Giới hạn:** không đổi WebSocket, EventSource, `navigator.sendBeacon` và request trong Web Worker/Service Worker. Nếu trang gọi `localStorage.clear()` (ví dụ khi đăng xuất) thì cấu hình cũng bị xoá.

---

## 10. Đổi icon app Hasaki Chat khi cài trên Windows

**Vấn đề:** trang `chat.hasaki.vn` vẫn dùng `manifest.json` mặc định của Create React App. Hai icon `logo192.png` và `logo512.png` chưa được thay nên vẫn là **logo React**. Khi cài app lên Windows, Chrome lấy icon từ manifest nên shortcut hiện logo React thay vì logo Hasaki.

**Cách extension xử lý:** dùng `declarativeNetRequest` chuyển hướng 2 request ảnh đó sang icon đóng gói sẵn trong extension:

| Request | Thay bằng |
|---|---|
| `https://chat.hasaki.vn/logo192.png` | `chat-icon-192.png` |
| `https://chat.hasaki.vn/logo512.png` | `chat-icon-512.png` |

Cách này **không đụng vào `manifest.json` của trang**, chỉ thay nội dung ảnh, nên khả năng cài PWA và `start_url` giữ nguyên như cũ. `favicon.png` (icon ở tab trình duyệt) cũng không bị ảnh hưởng vì vốn đã đúng logo Hasaki.

**Cách áp dụng:**
1. Vào `chrome://extensions`, bấm **Reload** extension.
2. Nếu đã cài app Hasaki Chat trước đó: **gỡ app cũ** (chuột phải icon > Uninstall, hoặc trong `chrome://apps`).
3. Mở `https://chat.hasaki.vn/chat/welcome`, nhấn **Ctrl + Shift + R** để xoá cache ảnh cũ.
4. Cài lại app từ nút cài trên thanh địa chỉ. Icon mới sẽ xuất hiện.

**Đổi sang icon khác:** chỉ cần thay 2 file `chat-icon-192.png` và `chat-icon-512.png` (đúng kích thước 192x192 và 512x512), rồi Reload extension.

**Hạn chế:** cách này chỉ có tác dụng trên máy đã cài extension. Tên app vẫn là **"React App"** vì nằm trong `manifest.json` của trang, extension không sửa được mà không ảnh hưởng tới khả năng cài đặt.

**Cách sửa triệt để (nên làm):** trong source frontend của Hasaki Chat, thay 2 file `public/logo192.png`, `public/logo512.png` và sửa `public/manifest.json`:

```json
{
  "short_name": "Hasaki Chat",
  "name": "Hasaki Chat",
  ...
}
```

Sau khi deploy, mọi người đều có icon và tên đúng, không cần extension.

---

## 11. Câu trả lời nhanh trên Hasaki Chat

Thêm một thanh chip ngay **phía trên ô soạn tin**. Bấm một chip là câu đó được gửi ngay, không cần gõ.

**Cách dùng:**
- Bấm chip → chèn câu vào ô soạn tin rồi tự bấm nút gửi.
- Bấm **✏️ Sửa** → mở bảng chỉnh danh sách, **mỗi dòng là một câu**. Bấm **Lưu** để áp dụng, **Mặc định** để khôi phục danh sách ban đầu.
- Danh sách lưu trong `chrome.storage.local` (key `hsk_quick_replies`) nên vẫn còn sau khi tải lại trang.

**Quy tắc an toàn:** nếu ô soạn tin **đang có chữ dở**, bấm chip chỉ **chèn thêm chữ** chứ **không tự gửi** — tránh gửi nhầm tin đang viết.

**Cách hoạt động:** ô soạn tin của app là **Quill** (`.ql-editor[contenteditable]`), không phải input thường, nên không gán `value` được. Script dùng `document.execCommand("insertText", ...)` để sinh đúng sự kiện `beforeinput`/`input` cho Quill nhận, đợi Quill xử lý xong (bỏ class `ql-blank`) rồi mới bấm nút gửi `svg[data-testid="SendRoundedIcon"]`.

Giao diện dựng bằng Shadow DOM nên không ảnh hưởng CSS của app. App là SPA nên script dùng `MutationObserver` để gắn lại thanh chip mỗi khi đổi cuộc trò chuyện.

---

## 12. Nút "Đọc tất cả" trên Hasaki Chat

Trên header danh sách hội thoại có nút **✓ Đọc tất cả** (chữ "Cuộc trò chuyện" được ẩn đi cho header gọn). Bấm một lần để đánh dấu đã đọc **toàn bộ** hội thoại còn tin chưa đọc; badge số chưa đọc trên danh sách biến mất ngay, không cần tải lại trang.

**Trạng thái:** khi chạy, nút chuyển sang loading và hiện tiến độ (`Đang đánh dấu 3/10: <tên nhóm>`). Xong sẽ báo `Đã đánh dấu đã đọc N/M hội thoại`; nếu có hội thoại lỗi (server từ chối, không nhận được ack…) thì liệt kê từng nhóm kèm lý do.

**Cơ chế (tái sử dụng đúng cách app đang làm):** khảo sát app thật cho thấy khi mở một nhóm và cuộn tới cuối, app **không gọi REST** mà gửi qua WebSocket `wss://apichat-ws.hasakichat.com/` (giao thức textroom):

```
{"request":"jointextroom","room":<id>,"transaction":<tx>,"ack":false}
{"textroom":"message","room":<id>,"transaction":<tx>,"ack":true,
 "text":"{\"update_seen_id\":<id tin mới nhất>,\"partner_id\":1,\"partner_user_id\":\"…\",\"time\":<thời gian tin>,
          \"room\":<id>,\"device_name\":\"SGU-1-…\",\"platform\":\"web\",\"event\":\"seen\"}"}
{"request":"leavetextroom","room":<id>,"transaction":<tx>,"ack":false}
```

Server trả `{"textroom":"success","event":"seen","transaction":<tx>}` và phát `sync_seen`; app nhận lại và tự xoá badge. Script làm đúng chuỗi này cho từng room:

1. Lấy danh sách room chưa đọc bằng `GET /api/v2/room/scroll?un_seen=true` (phân trang `last_anchor`), trường `last_message_id`/`last_time` là **tin mới nhất** của room.
2. Gửi `seen` với `update_seen_id = last_message_id` qua **chính socket app đang dùng** (script chạy ở MAIN world từ `document_start` để bọc `WebSocket` và giữ tham chiếu socket).
3. Chờ ack theo `transaction` (timeout 5s), rồi kiểm tra lại bằng `GET /api/v2/room/unseen/scroll`.
4. App tự cập nhật badge khi nhận `sync_seen`; script còn xoá badge trong DOM như lớp dự phòng cho room đã xác nhận về 0.

Header auth lấy từ `localStorage`: `authorization: Bearer <accessToken>` và `auth-token: <authToken>`.

**Lưu ý:**
- Backend **không có endpoint "đọc tất cả"** (không thấy trong traffic), nên gửi từng room; 10 room mất khoảng 2–3 giây.
- Gửi `update_seen_id` là tin **cũ** sẽ chỉ đánh dấu tới tin đó (đúng như app khi chưa cuộn tới cuối). `GET /api/v2/room/unseen/scroll` trả `last_message_id` là **tin mình đã xem cuối**, không phải tin mới nhất — đừng dùng nhầm.
- Số trên tab **"Chờ xử lý"** không phải số hội thoại chưa đọc (thực tế có 10 hội thoại chưa đọc nhưng tab hiện 60+), nên nút này không làm số đó về 0.
- Cần socket của app đang mở; nếu bấm ngay khi trang vừa tải mà chưa kết nối, script chờ tối đa 8s rồi báo lỗi.
- Debug trong console: `__hskMarkAllReadDebug()` (socket đã bắt được chưa) và `__hskMarkAllRead()` (chạy không cần nút).

---

## 13. Sắp xếp tab "Đánh dấu" trên Hasaki Chat

Trong tab **Đánh dấu**, phía trên danh sách có thanh **Sắp xếp: Mặc định · Ngày · Người gửi · Nhóm · Tuỳ chỉnh**.

- Bấm một tiêu chí để sắp xếp; **bấm lại tiêu chí đang chọn để đổi chiều** (mũi tên ↑/↓ cho biết tăng/giảm dần).
- Mặc định của từng tiêu chí: Ngày giảm dần (mới nhất trước), Người gửi và Nhóm tăng dần (A→Z, so sánh theo tiếng Việt).
- **Tuỳ chỉnh**: **kéo thả** từng item để xếp thứ tự riêng của bạn (có vạch xanh báo vị trí thả). Thứ tự này được lưu lại; bookmark mới chưa xếp sẽ hiện ở **đầu** danh sách để bạn kéo vào chỗ muốn. Chuyển sang tiêu chí khác rồi quay lại vẫn giữ nguyên thứ tự đã kéo.
- **Mặc định** trả về thứ tự gốc của app (thứ tự kéo thả vẫn được giữ trong bộ nhớ).
- Lựa chọn và thứ tự kéo thả lưu trong `chrome.storage.local` (key `hsk_bookmark_sort`), giữ nguyên khi tải lại trang. Đây là sắp xếp **cá nhân trên máy này**, không ảnh hưởng người khác.

**Cách hoạt động:** danh sách của app là flex column, script chỉ gán CSS `order` cho từng item chứ **không dời node trong DOM**, nên React vẫn quản lý danh sách bình thường, không xung đột. Thanh sắp xếp được chèn làm item đầu tiên của danh sách (dính ở trên khi cuộn) và tự ẩn khi chuyển sang tab khác; `MutationObserver` gắn lại và sắp xếp lại khi app tải thêm hoặc dựng lại danh sách.

**Giới hạn:**
- DOM chỉ hiển thị ngày `dd/mm/yyyy` (không có giờ), nên các tin **cùng ngày** giữ nguyên thứ tự gốc của app.
- Item không có id trong DOM, nên thứ tự kéo thả được nhớ theo khoá tạo từ **người gửi | nội dung | ngày | nhóm** (trùng nhau thì đánh số #1, #2…). Nếu app đổi cách hiển thị nội dung của một bookmark, item đó được coi là mới và quay lên đầu.

---

## 14. Phóng to avatar khi rê chuột trên Hasaki Chat

Rê chuột vào bất kỳ ảnh avatar nào (danh sách hội thoại, danh sách thành viên, avatar trong tin nhắn, header hội thoại, tab Đánh dấu) thì ảnh **phóng to mượt lên 1.1 lần** trong 0.3 giây; rời chuột thì thu lại.

**Cách làm:** app dùng **MUI Avatar** cho toàn bộ avatar (đã kiểm chứng: 120/120 ảnh avatar nằm trong `.MuiAvatar-root`):

| Phần tử | Vốn đã có |
|---|---|
| `.MuiAvatar-root` (khung) | `overflow: hidden`, `border-radius: 50%` |
| `.MuiAvatar-img` (ảnh) | `object-fit: cover` |

Vì vậy chỉ cần **scale ảnh bên trong khung**, khung giữ nguyên kích thước:

```css
.MuiAvatar-root { overflow: hidden; }
.MuiAvatar-root .MuiAvatar-img { transition: transform 0.3s ease; }
.MuiAvatar-root:hover .MuiAvatar-img { transform: scale(1.1); }
```

- Ảnh phóng to bị **cắt gọn trong khung tròn**, không tràn ra ngoài.
- Khung không đổi kích thước nên **không xê dịch layout** của danh sách.
- Tỷ lệ ảnh giữ nguyên nhờ `object-fit: cover`, bo tròn giữ nguyên.
- Selector dùng **2 cấp** để thắng độ ưu tiên của class do emotion sinh ra (vd `.css-1hy9t21` chỉ 1 cấp).
- Có `@media (prefers-reduced-motion: reduce)` để tắt chuyển động nếu hệ điều hành yêu cầu.

File là **CSS thuần**, khai báo qua `content_scripts.css` trong manifest nên không cần JS và tự áp dụng cho cả phần tử mới do app render thêm.

**Không áp dụng cho** badge số đếm thành viên (`.styles_hsk-avatar__alphabet__*`): đó không phải ảnh và khung của nó `overflow: visible` nên scale sẽ bị tràn.

---

## 15. Chủ đề giao diện cho Hasaki Chat (`chat-theme.css`)

Một file **CSS thuần**, khai báo qua `content_scripts.css` trong manifest, phủ lên toàn bộ `chat.hasaki.vn`: bảng màu thống nhất, bong bóng tin nhắn phân biệt rõ, hover/focus nhẹ nhàng, thanh cuộn tuỳ chỉnh và sửa layout mobile. **Không đụng vào HTML hay logic** của app.

### 15.1. Bảng màu

Toàn bộ màu khai báo bằng **CSS variables** ở `:root`, đặt tên theo vai trò (không theo màu) nên đổi một dòng là đổi cả giao diện.

| Nhóm | Biến chính | Giá trị | Dùng ở đâu |
|---|---|---|---|
| Chủ đạo | `--hsk-primary` | `hsl(152 39% 31%)` = `#306E51` | Taskbar, nút gửi, vạch tab |
| | `--hsk-primary-hover` / `-deep` | `#35825E` / `#16462F` | Hover / active |
| | `--hsk-primary-strong` | `#225D42` | Chữ xanh trên nền trắng (7.7:1) |
| | `--hsk-primary-soft` / `-tint` | `#DEF2E9` / `#F0F9F5` | Header hội thoại, nền hover |
| Nền | `--hsk-surface` / `-2` | `#F6F9F7` / `#EDF1EF` | Thanh ghim, ô nhập |
| Viền | `--hsk-border` / `-strong` | `#DDE4E0` / `#C6D1CB` | Đường kẻ, thanh cuộn |
| Chữ | `--hsk-text` | `#1C2622` | Nội dung (15.6:1) |
| | `--hsk-text-muted` | `#5C7067` | Chữ phụ (5.3:1) |
| | `--hsk-text-on-bubble` | `#41584D` | Giờ gửi trong bong bóng (5.8:1) |
| Nhấn | `--hsk-accent` | `#B54708` | Tag `@mention` |
| | `--hsk-link` | `#0B67AD` | Link trong tin nhắn (5.9:1) |
| Trạng thái | `--hsk-success` / `--hsk-danger` | `#228145` / `#B81E1E` | Badge chưa đọc / badge đỏ |
| | `--hsk-online` / `--hsk-offline` | `#259D51` / `#7B8E85` | Chấm trạng thái (đều ≥ 3:1) |

**Vì sao chọn vậy:** giữ nguyên `#306E51` làm gốc (đúng màu taskbar app đang dùng và đúng màu logo Hasaki), rồi dựng cả thang màu quanh **hue 152** — cùng tông với logo nên không bị lệch nhận diện. Màu trung tính cũng ngả xanh nhẹ (hue 150) thay vì xám xanh lạnh `#F0F2F5` của app, nên nền và màu thương hiệu hoà vào nhau thay vì "chửi" nhau.

Ngoài ra còn thang **font-size** (`--hsk-fs-xs` … `--hsk-fs-lg`), **khoảng cách** bội số 4px (`--hsk-sp-1` … `-5`), **bo góc** (`--hsk-r-sm/md/lg/pill`) và **đổ bóng** (`--hsk-shadow-xs/sm/md/lg`) để mọi thành phần dùng chung một hệ số đo.

### 15.2. Sửa các lỗi tương phản (WCAG AA)

App gốc có 5 chỗ chữ **không đạt** chuẩn AA (cần ≥ 4.5:1). Đã đo bằng công thức WCAG 2.1 và sửa hết:

| Chỗ | Màu cũ | Tỷ lệ cũ | Màu mới | Tỷ lệ mới |
|---|---|---|---|---|
| Ngăn cách ngày, số thành viên | `#999999` | **2.85** ✗ | `#5C7067` | 5.29 ✓ |
| Tag `@mention` (chữ trắng) | `#FD6600` | **2.97** ✗ | `#B54708` | 5.43 ✓ |
| Link trong tin nhắn | `#1890FF` | **3.24** ✗ | `#0B67AD` | 5.90 ✓ |
| Giờ gửi trong bong bóng | `gray` | **3.95** ✗ | `#41584D` | 5.77 ✓ |
| Tin nhắn phụ ở danh sách | `#777777` | **4.48** ✗ | `#5C7067` | 5.29 ✓ |

Chữ trong bong bóng: **11.7:1** (của mình) và **14.1:1** (của người khác) — vượt xa mức AA.

### 15.3. Phân biệt bong bóng tin nhắn

App cũ dùng `#DDF0E7` (của mình) và `#F0F2F5` (của người khác) — hai màu chênh nhau chỉ **1.06:1**, gần như nhìn không ra. Bản mới dùng **3 tín hiệu chồng lên nhau** để kể cả người mù màu vẫn phân biệt được:

| | Của **mình** | Của **người khác** | Của **bot** |
|---|---|---|---|
| Nền | `#C0E8D5` (xanh bạc hà) | `#F1F4F2` (trung tính) | `#E7F8F0` |
| Viền | `#8BC6AA` liền | `#D2DAD6` liền | `#306E51` **nét đứt** |
| Bo góc | `14-14-6-14` (vát góc **dưới phải**) | `14-14-14-6` (vát góc **dưới trái**) | `14px` đều |
| Vị trí | Phải | Trái | Trái |

Góc vát đóng vai trò "đuôi bong bóng" chỉ về phía người gửi — đây là tín hiệu **hình dạng**, vẫn đọc được khi in đen trắng hoặc khi không phân biệt được màu.

### 15.4. Các thành phần khác

- **Header hội thoại**: cố định 56px (`flex: 0 0 56px`, trước đây bị thanh ghim ép co còn ~48px), nền `--hsk-primary-soft`, nhóm icon bên phải có vùng bấm tròn 36px và nền hover mờ.
- **Danh sách hội thoại**: mỗi dòng bo góc 10px, hover nền `--hsk-surface-2`; hội thoại **đang mở** có nền xanh nhạt **và vạch chỉ báo 3px bên trái**. Nhãn nhóm ("Đã ghim") viết hoa, giãn chữ. Chữ "chưa đọc" đổi từ `green` (`#008000`) sang xanh thương hiệu.
- **Ô tìm kiếm**: bo tròn hẳn, nền chìm; focus thì nền trắng + viền xanh + vòng sáng.
- **Khung soạn tin**: viền sáng lên bằng `:focus-within` khi con trỏ ở trong ô (đã kiểm chứng: lúc không focus là nền xám, viền `#DDE4E0`, không có vòng sáng).
- **Nút gửi**: từ icon xám `#666` thành **nút tròn 38px nền xanh thương hiệu, icon trắng**; hover nhấc lên 1px + đậm màu, nhấn thì lún xuống (`scale(0.94)`).
- **"Đang nhập…"**: thêm chấm tròn nhấp nháy 1.2s phía trước (chỉ hiện khi có người đang gõ).
- **Thanh cuộn**: rộng 10px, thumb bo tròn màu `--hsk-border-strong` trên nền trong suốt; ở danh sách hội thoại và khung tin nhắn thì **chỉ hiện khi rê chuột vào**.
- **Vòng focus bàn phím**: mọi phần tử tương tác có `:focus-visible` viền 2px + offset 2px, phục vụ người dùng bàn phím.

### 15.5. Responsive

| Bề ngang | Thay đổi |
|---|---|
| ≥ 1600px | Giới hạn bong bóng 620px cho dễ đọc |
| ≤ 1399px | Thu gọn padding, giảm cỡ chữ tiêu đề |
| 768–1199px | **Ẩn cột "Thông tin nhóm"**, chia lại 34% / 66% cho danh sách và hội thoại; taskbar còn 58px |
| ≤ 767px | Xem mục 15.6 |
| ≤ 400px | Ẩn nút "Tải App" để nhường chỗ tiêu đề |

### 15.6. Sửa lỗi layout mobile

**Lỗi của app:** dưới 768px, antd xếp 3 cột **chồng dọc**, mỗi cột cao `100vh`, trong khi `.chat-dashboard` lại là `position: fixed; height: 100%`. Hệ quả: khung hội thoại nằm ở `y = 844px` — **ngoài màn hình và không cuộn tới được**. Trên điện thoại chỉ xem được danh sách hội thoại, không mở được tin nhắn.

**Cách sửa (thuần CSS):** biến hàng chứa 3 cột thành vùng cuộn dọc có `scroll-snap`, mỗi cột là một "trang" chiếm trọn màn hình:

```css
.chat-dashboard > .ant-row {
  height: 100%; overflow-y: auto;
  scroll-snap-type: y mandatory; overscroll-behavior: contain;
}
.chat-dashboard__column { height: 100%; scroll-snap-align: start; scroll-snap-stop: always; }
```

Vuốt dọc để chuyển giữa **Danh sách → Hội thoại → Thông tin nhóm**. Đã kiểm chứng ở 390×844: vùng cuộn cao 2532px (3 trang), cuộn tới trang 2 thì khung hội thoại về đúng `y = 0`. Kèm theo: taskbar thu còn 54px, mỗi dòng hội thoại cao 75px (đạt khuyến nghị vùng chạm 44px của WCAG 2.5.5), bong bóng rộng tối đa 86%.

### 15.7. Lưu ý kỹ thuật

- **Vì sao nhiều `!important`:** CSS của content script được Chrome chèn **trước** stylesheet của trang, nên nếu không có `!important` thì rule của app (cùng độ ưu tiên) sẽ thắng.
- **Vì sao dùng `[class*="..."]`:** app dùng CSS Modules, tên class có hash đổi mỗi lần deploy (`chat-group_chat-item__RsOiz`). Chọn bằng `[class*="chat-group_chat-item"]` thì đổi hash vẫn chạy.
- **Không xung đột** với `chat-avatar-hover.css` (file đó chỉ đụng `.MuiAvatar-root` / `.MuiAvatar-img`).
- Có `@media (prefers-reduced-motion: reduce)` rút thời lượng chuyển động về ~0 và `@media print` ẩn taskbar / ô soạn tin khi in.
- **Áp dụng:** vào `chrome://extensions` bấm **Reload**, rồi **refresh** lại `chat.hasaki.vn`. Muốn tắt tạm thì bỏ `"chat-theme.css"` khỏi mảng `css` trong `manifest.json`.
