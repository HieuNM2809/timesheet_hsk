// chat-bookmark-sort.js - Thanh sắp xếp cho tab "Đánh dấu" trên chat.hasaki.vn
// Sắp xếp theo Ngày / Người gửi / Nhóm (tăng hoặc giảm dần), hoặc "Tuỳ chỉnh": kéo thả để xếp
// thứ tự riêng của mình. Lựa chọn và thứ tự kéo thả lưu trong chrome.storage (cá nhân, theo máy).
//
// Cách làm: danh sách của app là flex column, nên chỉ gán CSS `order` cho từng item
// (không dời node trong DOM) -> React vẫn quản lý DOM như bình thường, không xung đột.
// DOM chỉ hiển thị ngày dd/mm/yyyy nên các tin cùng ngày giữ nguyên thứ tự gốc của app.
// Item không có id trong DOM, nên khoá nhận diện (để nhớ thứ tự kéo thả) được tạo từ
// người gửi | nội dung | ngày | nhóm, có đánh số #1, #2... nếu trùng nhau.
(function () {
  if (window.__hskBookmarkSortInjected) return;
  window.__hskBookmarkSortInjected = true;

  var STORAGE_KEY = "hsk_bookmark_sort";
  var TAB_CONTENT_SEL = "#chatHistoryTabContent";
  var ITEM_SEL = '[class*="row-message-notify"]';
  var DATE_SEL = '[class*="span-message-time__"]';     // span ngày (không trùng wrapper "span-message-time-detail")
  var GROUP_SEL = '[class*="span-message-detail__"]';
  var KEY_ATTR = "data-hsk-key";
  var DRAG_BOUND_ATTR = "data-hsk-drag";

  var KEYS = [
    { key: "default", label: "Mặc định", dir: null },
    { key: "date", label: "Ngày", dir: "desc" },
    { key: "sender", label: "Người gửi", dir: "asc" },
    { key: "group", label: "Nhóm", dir: "asc" },
    { key: "custom", label: "Tuỳ chỉnh", dir: null }
  ];

  var state = { key: "default", dir: "desc" };
  var customOrder = [];   // thứ tự người dùng đã kéo thả (danh sách khoá)
  var visibleKeys = [];   // thứ tự đang hiển thị (dùng để tính vị trí thả)

  // ---------- Lưu / đọc lựa chọn ----------
  function loadState(cb) {
    try {
      var q = {};
      q[STORAGE_KEY] = null;
      chrome.storage.local.get(q, function (res) {
        var s = res && res[STORAGE_KEY];
        if (s && KEYS.some(function (k) { return k.key === s.key; })) state = { key: s.key, dir: s.dir === "asc" ? "asc" : "desc" };
        if (s && Array.isArray(s.custom)) customOrder = s.custom.filter(function (k) { return typeof k === "string"; });
        cb && cb();
      });
    } catch (e) { cb && cb(); }
  }

  function saveState() {
    try {
      var obj = {};
      obj[STORAGE_KEY] = { key: state.key, dir: state.dir, custom: customOrder };
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
    var dateText = textOf(el.querySelector(DATE_SEL));
    return {
      el: el,
      index: index,
      date: parseDate(dateText),
      dateText: dateText,
      sender: textOf(content && content.children[0]),
      snippet: textOf(content && content.children[1]),
      group: textOf(el.querySelector(GROUP_SEL)),
      key: ""
    };
  }

  // Khoá nhận diện item; trùng nội dung thì đánh số theo thứ tự xuất hiện
  function assignKeys(rows) {
    var seen = {};
    rows.forEach(function (r) {
      var base = [r.sender, r.snippet, r.dateText, r.group].join("|");
      seen[base] = (seen[base] || 0) + 1;
      r.key = base + "#" + seen[base];
      if (r.el.getAttribute(KEY_ATTR) !== r.key) r.el.setAttribute(KEY_ATTR, r.key);
    });
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
    var rows = items.map(readItem);
    assignKeys(rows);
    setDragMode(items, state.key === "custom");

    if (state.key === "default") {
      items.forEach(function (el) { if (el.style.order) el.style.order = ""; });
      visibleKeys = rows.map(function (r) { return r.key; });
      return;
    }

    var ordered;
    if (state.key === "custom") {
      // Item đã xếp theo thứ tự đã lưu; item mới (chưa xếp) đưa lên đầu theo thứ tự app
      var rank = {};
      customOrder.forEach(function (k, i) { rank[k] = i; });
      var known = rows.filter(function (r) { return rank[r.key] !== undefined; })
        .sort(function (a, b) { return rank[a.key] - rank[b.key]; });
      var unknown = rows.filter(function (r) { return rank[r.key] === undefined; });
      ordered = unknown.concat(known);
    } else {
      var dir = state.dir === "asc" ? 1 : -1;
      ordered = rows.slice().sort(function (a, b) {
        var c = compare(a, b, state.key) * dir;
        return c !== 0 ? c : a.index - b.index; // cùng giá trị -> giữ thứ tự gốc của app
      });
    }
    ordered.forEach(function (r, i) {
      var v = String(i + 1);
      if (r.el.style.order !== v) r.el.style.order = v;
    });
    visibleKeys = ordered.map(function (r) { return r.key; });
  }

  // ---------- Kéo thả (chế độ Tuỳ chỉnh) ----------
  var dragKey = null;

  function isBefore(e, el) {
    var r = el.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2;
  }

  function clearMarks() {
    getItems().forEach(function (el) { if (el.style.boxShadow) el.style.boxShadow = ""; });
  }

  function moveKey(src, dst, before) {
    var keys = visibleKeys.slice();
    var from = keys.indexOf(src);
    if (from < 0 || src === dst) return;
    keys.splice(from, 1);
    var to = keys.indexOf(dst);
    if (to < 0) return;
    if (!before) to += 1;
    keys.splice(to, 0, src);
    customOrder = keys;
    saveState();
    applySort();
  }

  function bindDrag(el) {
    if (el.getAttribute(DRAG_BOUND_ATTR)) return;
    el.setAttribute(DRAG_BOUND_ATTR, "1");
    el.addEventListener("dragstart", function (e) {
      if (state.key !== "custom") { e.preventDefault(); return; }
      dragKey = el.getAttribute(KEY_ATTR);
      try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragKey); } catch (x) {}
      el.style.opacity = "0.5";
    });
    el.addEventListener("dragend", function () {
      el.style.opacity = "";
      clearMarks();
      dragKey = null;
    });
    el.addEventListener("dragover", function (e) {
      if (state.key !== "custom" || !dragKey) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = "move"; } catch (x) {}
      var mark = isBefore(e, el) ? "inset 0 3px 0 hsl(152, 39%, 31%)" : "inset 0 -3px 0 hsl(152, 39%, 31%)";
      if (el.style.boxShadow !== mark) { clearMarks(); el.style.boxShadow = mark; }
    });
    el.addEventListener("dragleave", function () { el.style.boxShadow = ""; });
    el.addEventListener("drop", function (e) {
      if (state.key !== "custom" || !dragKey) return;
      e.preventDefault();
      moveKey(dragKey, el.getAttribute(KEY_ATTR), isBefore(e, el));
      clearMarks();
    });
  }

  function setDragMode(items, on) {
    items.forEach(function (el) {
      if (on) {
        if (el.getAttribute("draggable") !== "true") el.setAttribute("draggable", "true");
        if (el.style.cursor !== "grab") el.style.cursor = "grab";
        bindDrag(el);
      } else {
        if (el.hasAttribute("draggable")) el.removeAttribute("draggable");
        if (el.style.cursor) el.style.cursor = "";
        if (el.style.boxShadow) el.style.boxShadow = "";
      }
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
    '.pill .arrow { margin-left: 4px; font-size: 11px; }' +
    '.hint { color: hsl(152, 39%, 31%); font-size: 11px; font-weight: 600; }';

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
        : k.key === "custom" ? "Kéo thả để xếp thứ tự riêng của bạn"
        : (state.key === k.key ? "Bấm để đổi chiều" : "Sắp xếp theo " + k.label.toLowerCase());
      b.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (k.key === "default") state = { key: "default", dir: "desc" };
        else if (!k.dir) state = { key: k.key, dir: "desc" };
        else if (state.key === k.key) state.dir = state.dir === "asc" ? "desc" : "asc"; // bấm lại -> đổi chiều
        else state = { key: k.key, dir: k.dir };
        saveState();
        renderBar();
        applySort();
      });
      bar.appendChild(b);
    });
    if (state.key === "custom") {
      var hint = document.createElement("span");
      hint.className = "hint";
      hint.textContent = "Kéo thả để sắp xếp";
      bar.appendChild(hint);
    }
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
