// chat-work-link.js - Thay nút "Tải App" trên header danh sách hội thoại chat.hasaki.vn
// bằng nút mở work.hasaki.vn (tab mới).
//
// Nút "Tải App" của app là span.chat-dashboard__history__top__left__download (bấm mở popover tải app).
// Chỉ ẩn nút đó (display:none, không xoá vì node do React quản lý) rồi chèn nút mới ngay sau nó,
// nên nút mới nằm đúng chỗ cũ. Chữ "Tải App" vẫn còn trong DOM nên chat-mark-all-read.js vẫn nhận ra
// hàng tiêu đề như trước. App là SPA nên dùng MutationObserver để gắn lại khi header được dựng lại.
(function () {
  if (window.__hskWorkLinkInjected) return;
  window.__hskWorkLinkInjected = true;

  var WORK_URL = "https://work.hasaki.vn/";
  var DOWNLOAD_SEL = ".chat-dashboard__history__top__left__download";
  // Icon "WorkOutline" của Material Icons (cùng bộ icon MUI app đang dùng)
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6V4h-4v2zM4 8v11h16V8zm16-2c1.11 0 2 .89 2 2v11' +
             'c0 1.11-.89 2-2 2H4c-1.11 0-2-.89-2-2l.01-11c0-1.11.88-2 1.99-2h4V4c0-1.11.89-2 2-2h4c1.11 0 2 .89 2 2v2z"/></svg>';

  // Cùng kiểu với nút "✓ Đọc tất cả" (chat-mark-all-read.js) cho header đồng bộ
  var CSS =
    ':host { display: inline-flex; align-items: center; }' +
    ':host, * { box-sizing: border-box; font-family: "Segoe UI", Roboto, Arial, sans-serif; }' +
    '.btn {' +
    '  display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px;' +
    '  border: 1px solid hsl(152, 39%, 31%); border-radius: 6px; background: #fff; color: hsl(152, 39%, 24%);' +
    '  font-size: 12px; font-weight: 600; text-decoration: none; white-space: nowrap; line-height: 1;' +
    '}' +
    '.btn:hover { background: hsl(152, 39%, 31%); color: #fff; }' +
    '.btn:focus-visible { outline: 2px solid hsl(152, 39%, 31%); outline-offset: 2px; }' +
    '.btn svg { width: 14px; height: 14px; fill: currentColor; flex: none; }';

  var host = null;

  function buildUi() {
    host = document.createElement("span");
    host.id = "hsk-work-link-root";
    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    var a = document.createElement("a");
    a.className = "btn";
    a.href = WORK_URL;
    a.target = "_blank";
    a.rel = "noopener";
    a.title = "Mở work.hasaki.vn trong tab mới";
    a.innerHTML = ICON + "<span>HasakiWork</span>";
    shadow.appendChild(a);
  }

  function attach() {
    var download = document.querySelector(DOWNLOAD_SEL);
    if (!download || !download.parentElement) return;
    if (download.style.display !== "none") download.style.display = "none";
    if (!host) buildUi();
    if (host.previousSibling !== download) download.parentElement.insertBefore(host, download.nextSibling);
  }

  attach();
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
})();
