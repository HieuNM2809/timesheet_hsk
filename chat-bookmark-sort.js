// chat-bookmark-sort.js - Thanh sắp xếp cho tab "Đánh dấu" trên chat.hasaki.vn
// Sắp xếp theo Ngày / Người gửi / Nhóm, tăng hoặc giảm dần. Lưu lựa chọn trong chrome.storage.
//
// Cách làm: danh sách của app là flex column, nên chỉ gán CSS `order` cho từng item
// (không dời node trong DOM) -> React vẫn quản lý DOM như bình thường, không xung đột.
// DOM chỉ hiển thị ngày dd/mm/yyyy nên các tin cùng ngày giữ nguyên thứ tự gốc của app.
(function () {
  if (window.__hskBookmarkSortInjected) return;
  window.__hskBookmarkSortInjected = true;

  var STORAGE_KEY = "hsk_bookmark_sort";
  var TAB_CONTENT_SEL = "#chatHistoryTabContent";
  var ITEM_SEL = '[class*="row-message-notify"]';
  var DATE_SEL = '[class*="span-message-time__"]';     // span ngày (không trùng wrapper "span-message-time-detail")
  var GROUP_SEL = '[class*="span-message-detail__"]';

  var KEYS = [
    { key: "default", label: "Mặc định", dir: null },
    { key: "date", label: "Ngày", dir: "desc" },
    { key: "sender", label: "Người gửi", dir: "asc" },
    { key: "group", label: "Nhóm", dir: "asc" }
  ];

  var state = { key: "default", dir: "desc" };

  // ---------- Lưu / đọc lựa chọn ----------
  function loadState(cb) {
    try {
      var q = {};
      q[STORAGE_KEY] = null;
      chrome.storage.local.get(q, function (res) {
        var s = res && res[STORAGE_KEY];
        if (s && KEYS.some(function (k) { return k.key === s.key; })) state = { key: s.key, dir: s.dir === "asc" ? "asc" : "desc" };
        cb && cb();
      });
    } catch (e) { cb && cb(); }
  }

  function saveState() {
    try {
      var obj = {};
      obj[STORAGE_KEY] = state;
      chrome.storage.local.set(obj);
    } catch (e) {}
  }

  // ---------- Đọc dữ liệu từng item ----------
  function getItems() {
    var root = document.querySelector(TAB_CONTENT_SEL);
    return root ? Array.prototype.slice.call(root.querySelectorAll(ITEM_SEL)) : [];
  }

  function textOf(el) { return el ? (el.textContent || "").trim() : ""; }

  function parseDate(s) {
    var m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || "");
    return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : 0;
  }

  function readItem(el, index) {
    // Khối nội dung (loại trừ chính hàng "row-message-notify")
    var content = null;
    var cands = el.querySelectorAll('[class*="message-notify"]');
    for (var i = 0; i < cands.length; i++) {
      if (!/row-message-notify/.test(String(cands[i].className))) { content = cands[i]; break; }
    }
    return {
      el: el,
      index: index,
      date: parseDate(textOf(el.querySelector(DATE_SEL))),
      sender: textOf(content && content.children[0]),
      group: textOf(el.querySelector(GROUP_SEL))
    };
  }

  function compare(a, b, key) {
    if (key === "date") return a.date - b.date;
    var x = key === "sender" ? a.sender : a.group;
    var y = key === "sender" ? b.sender : b.group;
    return x.localeCompare(y, "vi", { sensitivity: "base" });
  }

  // ---------- Áp dụng sắp xếp bằng CSS order ----------
  function applySort() {
    var items = getItems();
    if (!items.length) return;
    if (state.key === "default") {
      items.forEach(function (el) { if (el.style.order) el.style.order = ""; });
      return;
    }
    var dir = state.dir === "asc" ? 1 : -1;
    var rows = items.map(readItem);
    rows.sort(function (a, b) {
      var c = compare(a, b, state.key) * dir;
      return c !== 0 ? c : a.index - b.index; // cùng giá trị -> giữ thứ tự gốc của app
    });
    rows.forEach(function (r, rank) {
      var v = String(rank + 1);
      if (r.el.style.order !== v) r.el.style.order = v;
    });
  }

  // ---------- Giao diện ----------
  var host = null, shadow = null, bar = null;

  var CSS =
    ':host, * { box-sizing: border-box; font-family: "Segoe UI", Roboto, Arial, sans-serif; }' +
    '.bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px 10px; background: #fff; border-bottom: 1px solid #eef0f3; font-size: 12px; }' +
    '.label { color: #777; font-weight: 600; margin-right: 2px; }' +
    '.pill {' +
    '  border: 1px solid #d6dde6; background: #f7f9fc; color: #444; border-radius: 12px; padding: 3px 10px;' +
    '  font-size: 12px; font-weight: 600; cursor: pointer; line-height: 1.2; white-space: nowrap;' +
    '}' +
    '.pill:hover { border-color: hsl(152, 39%, 31%); color: hsl(152, 39%, 24%); }' +
    '.pill.active { background: hsl(152, 39%, 31%); border-color: hsl(152, 39%, 31%); color: #fff; }' +
    '.pill .arrow { margin-left: 4px; font-size: 11px; }';

  function buildUi() {
    host = document.createElement("div");
    host.id = "hsk-bookmark-sort-root";
    // Là item đầu tiên trong danh sách flex, dính ở trên khi cuộn
    host.style.cssText = "order:-1;position:sticky;top:0;z-index:2;flex:0 0 auto;";
    shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    bar = document.createElement("div");
    bar.className = "bar";
    shadow.appendChild(bar);
    renderBar();
  }

  function renderBar() {
    bar.innerHTML = "";
    var label = document.createElement("span");
    label.className = "label";
    label.textContent = "Sắp xếp:";
    bar.appendChild(label);
    KEYS.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pill" + (state.key === k.key ? " active" : "");
      b.textContent = k.label;
      if (k.dir && state.key === k.key) {
        var arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = state.dir === "asc" ? "↑" : "↓";
        b.appendChild(arrow);
      }
      b.title = k.key === "default" ? "Thứ tự gốc của app"
        : (state.key === k.key ? "Bấm để đổi chiều" : "Sắp xếp theo " + k.label.toLowerCase());
      b.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (k.key === "default") state = { key: "default", dir: "desc" };
        else if (state.key === k.key) state.dir = state.dir === "asc" ? "desc" : "asc"; // bấm lại -> đổi chiều
        else state = { key: k.key, dir: k.dir };
        saveState();
        renderBar();
        applySort();
      });
      bar.appendChild(b);
    });
  }

  // Gắn thanh sắp xếp làm item đầu tiên của danh sách (chỉ khi tab "Đánh dấu" đang hiện)
  function attach() {
    var items = getItems();
    if (!items.length) {
      if (host && host.parentElement) host.parentElement.removeChild(host);
      return;
    }
    var list = items[0].parentElement;
    if (!host) buildUi();
    if (host.parentElement !== list) list.insertBefore(host, list.firstChild);
  }

  // Dùng setTimeout thay vì requestAnimationFrame: rAF không chạy khi tab ở nền,
  // còn tab "Đánh dấu" có thể được dựng lúc cửa sổ chưa hiện.
  var timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      attach();
      applySort();
    }, 50);
  }

  loadState(function () {
    schedule();
    // App là SPA: đổi tab / tải thêm bookmark sẽ dựng lại danh sách -> gắn lại và sắp xếp lại
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  });
})();
