// chat-mark-all-read.js - Nút "Đọc tất cả" trên danh sách hội thoại chat.hasaki.vn
//
// Chạy ở MAIN world + document_start (khai báo trong manifest.json) để bọc WebSocket của trang
// trước khi app tạo kết nối, nhờ đó TÁI SỬ DỤNG đúng socket app đang dùng để gửi sự kiện "seen".
//
// Cơ chế app dùng khi mở một room và cuộn tới cuối (khảo sát bằng cách bắt frame socket):
//   1) {"request":"jointextroom","room":<id>,"transaction":<tx>,"ack":false}
//   2) {"textroom":"message","room":<id>,"transaction":<tx>,"ack":true,
//       "text": JSON({"update_seen_id":<id tin mới nhất>,"partner_id","partner_user_id","time":<thời gian tin>,
//                     "room":<id>,"device_name":"SGU-<partner_id>-<partner_user_id>","platform":"web","event":"seen"})}
//      -> server trả {"textroom":"success","event":"seen","transaction":<tx>} và phát "sync_seen",
//         app nhận lại và tự xoá badge chưa đọc trên danh sách.
//   3) {"request":"leavetextroom","room":<id>,"transaction":<tx>,"ack":false}
// Danh sách room chưa đọc + id tin mới nhất lấy từ GET /api/v2/room/scroll?un_seen=true (phân trang last_anchor).
// Backend không có endpoint "đọc tất cả" (không thấy trong traffic) nên gửi "seen" cho từng room.
(function () {
  if (window.__hskMarkAllReadInjected) return;
  window.__hskMarkAllReadInjected = true;
  if (location.hostname !== "chat.hasaki.vn") return;

  var API = "https://api.hasakichat.com";
  var WS_HOST = "apichat-ws.hasakichat.com";
  var PAGE_SIZE = 50;
  var ACK_TIMEOUT = 5000;
  var LOG_PREFIX = "[HSK Đọc tất cả]";

  // ---------- Bọc WebSocket để lấy socket của app ----------
  var sockets = [];
  var pending = {}; // transaction -> { resolve, reject, timer }

  function onFrame(ev) {
    var raw = typeof ev.data === "string" ? ev.data : "";
    if (!raw || raw.charAt(0) !== "{") return;
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    var tx = msg && msg.transaction;
    if (!tx || !pending[tx]) return;
    var p = pending[tx];
    delete pending[tx];
    clearTimeout(p.timer);
    if (msg.textroom === "success") p.resolve(msg);
    else p.reject(new Error(msg.error || msg.error_code || ("server trả " + msg.textroom)));
  }

  function track(ws) {
    try {
      if (String(ws.url).indexOf(WS_HOST) === -1) return;
      sockets.push(ws);
      ws.addEventListener("message", onFrame);
    } catch (e) {}
  }

  var NativeWS = window.WebSocket;
  if (typeof NativeWS === "function") {
    var HookedWS = function (url, protocols) {
      var ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      track(ws);
      return ws;
    };
    HookedWS.prototype = NativeWS.prototype;
    HookedWS.CONNECTING = 0; HookedWS.OPEN = 1; HookedWS.CLOSING = 2; HookedWS.CLOSED = 3;
    window.WebSocket = HookedWS;

    // Dự phòng: socket tạo trước khi bọc (không xảy ra ở document_start, nhưng cho chắc)
    var nativeSend = NativeWS.prototype.send;
    NativeWS.prototype.send = function () {
      if (sockets.indexOf(this) === -1) track(this);
      return nativeSend.apply(this, arguments);
    };
  }

  function getSocket() {
    for (var i = sockets.length - 1; i >= 0; i--) {
      if (sockets[i].readyState === 1) return sockets[i];
    }
    return null;
  }

  function waitSocket(maxMs) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() {
        var ws = getSocket();
        if (ws) return resolve(ws);
        if (Date.now() - t0 > maxMs) return resolve(null);
        setTimeout(poll, 200);
      })();
    });
  }

  // ---------- Helpers ----------
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function randomTx() {
    var c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", s = "";
    for (var i = 0; i < 12; i++) s += c.charAt(Math.floor(Math.random() * c.length));
    return s;
  }

  function lsGet(k) { return (localStorage.getItem(k) || "").replace(/^"|"$/g, ""); }

  function jwtPayload(token) {
    try {
      var p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      while (p.length % 4) p += "=";
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return null; }
  }

  function authHeaders() {
    var access = lsGet("accessToken"), auth = lsGet("authToken");
    if (!access) throw new Error("Không tìm thấy accessToken, hãy đăng nhập lại.");
    return { "authorization": "Bearer " + access, "auth-token": auth, "accept": "application/json, text/plain, */*",
             "accept-language": "vi", "x-timezone": "Asia/Ho_Chi_Minh" };
  }

  function apiGet(path) {
    return fetch(API + path, { headers: authHeaders() }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " " + path.split("?")[0]);
      return r.json();
    }).then(function (j) {
      if (!j || !j.status || j.status.error_code !== 0) throw new Error((j && j.status && j.status.error_message) || "API lỗi");
      return j.data || {};
    });
  }

  // Liệt kê toàn bộ room còn tin chưa đọc (phân trang theo last_anchor)
  function listUnreadRooms(identity) {
    var base = "/api/v2/room/scroll?partner_id=" + identity.partner_id + "&partner_user_id=" + identity.partner_user_id +
               "&size=" + PAGE_SIZE + "&un_seen=true";
    var rooms = [], ids = {}, anchor = null, pages = 0;
    function next() {
      return apiGet(base + (anchor ? "&last_anchor=" + anchor : "")).then(function (d) {
        var list = d.list || [], added = 0;
        list.forEach(function (r) {
          if (!r.id || ids[r.id]) return;
          ids[r.id] = true; added++;
          rooms.push({ id: r.id, name: r.to_name || r.name || r.id, unseen: r.unseen_count || 0,
                       lastMessageId: r.last_message_id, lastTime: r.last_time });
        });
        pages++;
        if (!added || !d.last_anchor || d.last_anchor === anchor || list.length < PAGE_SIZE || pages >= 40) return rooms;
        anchor = d.last_anchor;
        return next();
      });
    }
    return next();
  }

  // Gửi frame và (tuỳ chọn) chờ ack theo transaction
  function sendFrame(ws, frame, waitAck) {
    var tx = frame.transaction;
    var p = waitAck ? new Promise(function (resolve, reject) {
      pending[tx] = { resolve: resolve, reject: reject,
        timer: setTimeout(function () { delete pending[tx]; reject(new Error("không nhận được ack sau " + ACK_TIMEOUT / 1000 + "s")); }, ACK_TIMEOUT) };
    }) : Promise.resolve();
    ws.send(JSON.stringify(frame));
    return p;
  }

  // Đánh dấu đã đọc 1 room: join -> seen(ack) -> leave, y hệt app
  function markRoomSeen(ws, room, identity) {
    if (!room.lastMessageId) return Promise.reject(new Error("room không có tin mới nhất"));
    var seen = {
      update_seen_id: room.lastMessageId, partner_id: identity.partner_id, partner_user_id: identity.partner_user_id,
      time: room.lastTime || Date.now(), room: room.id,
      device_name: "SGU-" + identity.partner_id + "-" + identity.partner_user_id, platform: "web", event: "seen"
    };
    sendFrame(ws, { request: "jointextroom", transaction: randomTx(), room: room.id, ack: false }, false);
    return sleep(120).then(function () {
      return sendFrame(ws, { textroom: "message", room: room.id, transaction: randomTx(), ack: true, text: JSON.stringify(seen) }, true);
    }).then(function (ack) {
      sendFrame(ws, { request: "leavetextroom", transaction: randomTx(), room: room.id, ack: false }, false);
      return ack;
    }, function (err) {
      sendFrame(ws, { request: "leavetextroom", transaction: randomTx(), room: room.id, ack: false }, false);
      throw err;
    });
  }

  // Kiểm tra lại trên server sau khi gửi
  function verifyRooms(rooms) {
    var result = {};
    var chunks = [];
    for (var i = 0; i < rooms.length; i += 50) chunks.push(rooms.slice(i, i + 50));
    return chunks.reduce(function (chain, chunk) {
      return chain.then(function () {
        var qs = chunk.map(function (r) { return "room_ids[]=" + encodeURIComponent(r.id); }).join("&") + "&size=" + chunk.length;
        return apiGet("/api/v2/room/unseen/scroll?" + qs).then(function (d) {
          (d.list || []).forEach(function (x) { result[x.id] = x.unseen_count || 0; });
        });
      });
    }, Promise.resolve()).then(function () { return result; });
  }

  // Dự phòng cập nhật DOM nếu app chưa tự xoá badge (app thường tự xoá khi nhận sync_seen)
  function clearBadgeInDom(roomId) {
    var el = document.getElementById("chathistoryitem-" + roomId);
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll('[class*="member-action__num"]'), function (b) { b.remove(); });
    Array.prototype.forEach.call(el.querySelectorAll("[class]"), function (n) {
      var cls = String(n.className || "");
      if (/unseen/.test(cls)) n.className = cls.split(/\s+/).filter(function (c) { return !/unseen/.test(c); }).join(" ");
    });
  }

  // ---------- Luồng chính ----------
  function markAllAsRead(onProgress) {
    var identity;
    return Promise.resolve().then(function () {
      var payload = jwtPayload(lsGet("accessToken"));
      if (!payload || !payload.partner_user_id) throw new Error("Không đọc được thông tin đăng nhập (accessToken).");
      identity = { partner_id: payload.partner_id, partner_user_id: String(payload.partner_user_id) };
      onProgress("Đang lấy danh sách chưa đọc…");
      return listUnreadRooms(identity);
    }).then(function (rooms) {
      if (!rooms.length) return { total: 0, ok: [], failed: [], remaining: [] };
      onProgress("Đang kết nối socket…");
      return waitSocket(8000).then(function (ws) {
        if (!ws) throw new Error("Chưa có kết nối socket của app. Đợi vài giây rồi thử lại.");
        var ok = [], failed = [];
        return rooms.reduce(function (chain, room, idx) {
          return chain.then(function () {
            onProgress("Đang đánh dấu " + (idx + 1) + "/" + rooms.length + ": " + room.name);
            var sock = getSocket() || ws;
            return markRoomSeen(sock, room, identity).then(function () { ok.push(room); },
              function (err) { failed.push({ room: room, error: err.message || String(err) }); console.warn(LOG_PREFIX, room.name, err); });
          });
        }, Promise.resolve()).then(function () {
          onProgress("Đang kiểm tra lại…");
          return verifyRooms(ok).then(function (counts) {
            var remaining = [];
            ok.forEach(function (r) {
              if (counts[r.id] > 0) remaining.push({ room: r, unseen: counts[r.id] });
              else clearBadgeInDom(r.id);
            });
            return { total: rooms.length, ok: ok, failed: failed, remaining: remaining };
          }, function () {
            ok.forEach(function (r) { clearBadgeInDom(r.id); });
            return { total: rooms.length, ok: ok, failed: failed, remaining: [], verifyFailed: true };
          });
        });
      });
    });
  }

  // ---------- Giao diện ----------
  var host = null, shadow = null, btn = null, statusEl = null, running = false, hideTimer = null;

  var CSS =
    ':host, * { box-sizing: border-box; font-family: "Segoe UI", Roboto, Arial, sans-serif; }' +
    '.wrap { position: relative; display: inline-flex; align-items: center; margin-left: 6px; }' +
    '.btn {' +
    '  display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px;' +
    '  border: 1px solid hsl(152, 39%, 31%); border-radius: 6px; background: #fff; color: hsl(152, 39%, 24%);' +
    '  font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; line-height: 1;' +
    '}' +
    '.btn:hover { background: hsl(152, 39%, 31%); color: #fff; }' +
    '.btn[disabled] { opacity: 0.7; cursor: progress; }' +
    '.spin { width: 11px; height: 11px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: sp 0.7s linear infinite; }' +
    '@keyframes sp { to { transform: rotate(360deg); } }' +
    '.status {' +
    '  position: absolute; top: calc(100% + 6px); left: 0; z-index: 2147483647; min-width: 240px; max-width: 340px;' +
    '  background: #fff; border: 1px solid #e3e8ef; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #333;' +
    '  box-shadow: 0 10px 30px rgba(0,0,0,0.18); line-height: 1.5;' +
    '}' +
    '.status[hidden] { display: none; }' +
    '.status.ok { border-left: 4px solid #28a745; }' +
    '.status.err { border-left: 4px solid #dc3545; }' +
    '.status.busy { border-left: 4px solid hsl(152, 39%, 31%); }' +
    '.status ul { margin: 6px 0 0; padding-left: 16px; max-height: 160px; overflow: auto; }' +
    '.status li { margin: 2px 0; color: #b02a37; }' +
    '.status .close { position: absolute; top: 4px; right: 8px; border: none; background: none; color: #999; font-size: 16px; cursor: pointer; }' +
    '.status .close:hover { color: #dc3545; }';

  function setStatus(kind, html, autoHide) {
    if (!statusEl) return;
    clearTimeout(hideTimer);
    statusEl.className = "status " + kind;
    statusEl.innerHTML = "<button class='close' title='Đóng'>×</button>" + html;
    statusEl.querySelector(".close").addEventListener("click", function () { statusEl.hidden = true; });
    statusEl.hidden = false;
    if (autoHide) hideTimer = setTimeout(function () { statusEl.hidden = true; }, autoHide);
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function setBusy(on, label) {
    running = on;
    btn.disabled = on;
    btn.innerHTML = on ? "<span class='spin'></span>" + esc(label || "Đang xử lý…") : "✓ Đọc tất cả";
  }

  function run() {
    if (running) return;
    setBusy(true, "Đang xử lý…");
    setStatus("busy", "Đang bắt đầu…");
    markAllAsRead(function (text) {
      btn.innerHTML = "<span class='spin'></span>" + esc(text.length > 34 ? text.slice(0, 34) + "…" : text);
      setStatus("busy", esc(text));
    }).then(function (res) {
      setBusy(false);
      if (res.total === 0) return setStatus("ok", "Không có hội thoại nào chưa đọc.", 4000);
      var html = "Đã đánh dấu đã đọc <b>" + res.ok.length + "/" + res.total + "</b> hội thoại.";
      var problems = [];
      res.failed.forEach(function (f) { problems.push("<li><b>" + esc(f.room.name) + "</b>: " + esc(f.error) + "</li>"); });
      res.remaining.forEach(function (r) { problems.push("<li><b>" + esc(r.room.name) + "</b>: còn " + r.unseen + " tin (có thể vừa có tin mới)</li>"); });
      if (res.verifyFailed) problems.push("<li>Không kiểm tra lại được trên server.</li>");
      if (problems.length) setStatus("err", html + "<ul>" + problems.join("") + "</ul>");
      else setStatus("ok", html, 5000);
      console.log(LOG_PREFIX, res);
    }, function (err) {
      setBusy(false);
      setStatus("err", "Lỗi: " + esc(err && err.message ? err.message : err));
      console.error(LOG_PREFIX, err);
    });
  }

  function buildUi() {
    host = document.createElement("span");
    host.id = "hsk-mark-all-read-root";
    shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    var wrap = document.createElement("span");
    wrap.className = "wrap";
    btn = document.createElement("button");
    btn.className = "btn";
    btn.type = "button";
    btn.title = "Đánh dấu đã đọc toàn bộ hội thoại";
    btn.textContent = "✓ Đọc tất cả";
    btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); run(); });
    statusEl = document.createElement("div");
    statusEl.className = "status";
    statusEl.hidden = true;
    wrap.appendChild(btn);
    wrap.appendChild(statusEl);
    shadow.appendChild(wrap);
    document.addEventListener("click", function (e) {
      if (statusEl && !statusEl.hidden && !host.contains(e.target) && !running) statusEl.hidden = true;
    }, true);
  }

  // Tìm hàng tiêu đề "Cuộc trò chuyện" (có nút "Tải App") để đặt nút cạnh đó
  function findHeaderRow() {
    var all = document.querySelectorAll("h1,h2,h3,h4,h5,h6,span,div,p");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.childElementCount === 0 && (el.textContent || "").trim() === "Cuộc trò chuyện") {
        var row = el;
        for (var up = 0; up < 4 && row.parentElement; up++) {
          row = row.parentElement;
          if (/Tải App/.test(row.textContent || "")) return { row: row, title: el };
        }
        return { row: el.parentElement, title: el };
      }
    }
    return null;
  }

  function attach() {
    if (host && document.contains(host)) return;
    var h = findHeaderRow();
    if (!h) return;
    if (!host) buildUi();
    // Chèn ngay sau tiêu đề, trước nút "Tải App"
    if (h.title.parentElement === h.row) h.row.insertBefore(host, h.title.nextSibling);
    else h.row.appendChild(host);
  }

  function init() {
    attach();
    new MutationObserver(function () { attach(); }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // Cho phép gọi tay từ console để debug: window.__hskMarkAllRead() / window.__hskMarkAllReadDebug()
  window.__hskMarkAllRead = function () { return markAllAsRead(function (t) { console.log(LOG_PREFIX, t); }); };
  window.__hskMarkAllReadDebug = function () {
    return { socketsTracked: sockets.length, socketOpen: !!getSocket(), buttonAttached: !!(host && document.contains(host)), pendingAcks: Object.keys(pending).length };
  };
})();
