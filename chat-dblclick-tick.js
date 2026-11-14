// chat-dblclick-tick.js - Double-click vào một tin nhắn trên chat.hasaki.vn -> thả reaction tích (✓)
//
// Chạy ở MAIN world (khai báo trong manifest.json) để đọc được React/Redux của app: biết chính xác
// tin nào mình đã thả ✓, và vẽ reaction ngay bằng chính reducer của app thay vì sửa DOM.
//
// Cơ chế reaction của app (khảo sát bundle + trang thật):
//   - Icon tích là reaction "accept" (https://api.hasakichat.com/assets/reactions/accept.png).
//   - Bấm một icon trong bảng chọn reaction -> POST /api/v1/chat/reaction {message_id, reaction_name}.
//     App không có API gỡ riêng: bấm lại icon đang chọn cũng gọi đúng API này, nên gửi khi đã thả rồi
//     sẽ GỠ mất reaction -> luôn kiểm tra trước khi gửi.
//   - App không tự vẽ sau khi gọi API: server phát sự kiện socket "update_reaction", app dispatch
//     {type: "UPDATE_REACTION", msg_id, emotions} để vẽ lại. Reaction của từng tin nằm ở
//     state.chatConversation.messages[].emotions = [{name, partner_id, partner_user_id, user_display_name, ...}].
//
// Không đụng single-click của app: bỏ qua phần tử có click riêng (mention, link, ảnh, vùng reaction...)
// và chặn trình duyệt bôi đen chữ khi double-click trên tin (app sẽ hiện popup "trả lời đoạn đã chọn").
(function () {
  if (window.__hskDblClickTickInjected) return;
  window.__hskDblClickTickInjected = true;
  if (location.hostname !== "chat.hasaki.vn") return;

  var API = "https://api.hasakichat.com/api/v1";
  var TICK = "accept";
  var TICK_ICON = "https://api.hasakichat.com/assets/reactions/accept.png";
  var MSG_SEL = '[id^="msg-"]';
  // Phần tử bấm được trong bubble; ngoài ra còn các phần tử có onClick của React (xem hasClickHandler)
  var CLICKABLE_SEL = "a, button, input, textarea, select, img, video, audio, [role='button'], [contenteditable='true']," +
                      " .chat-dashboard__conversation__content__mention, [id^='emotionTaskArea-']";
  var LOG_PREFIX = "[HSK Double-click ✓]";

  var busy = {}; // msg_id -> đang xử lý: double-click dồn dập không được gửi 2 lần (= thả rồi gỡ)

  // ---------- Đọc React / Redux của app ----------
  function reactKey(el, prefix) {
    var keys = Object.keys(el);
    for (var i = 0; i < keys.length; i++) if (keys[i].indexOf(prefix) === 0) return el[keys[i]];
    return null;
  }

  // Phần tử có click riêng của app (mention mở thông tin, ảnh mở trình xem, vùng reaction mở chi tiết...)
  function hasClickHandler(el) {
    var p = reactKey(el, "__reactProps$");
    return !!p && (typeof p.onClick === "function" || typeof p.onDoubleClick === "function");
  }

  // Store Redux: đi ngược cây React từ phần tử tin nhắn lên tới Provider của react-redux
  function getStore(el) {
    var f = reactKey(el, "__reactFiber$");
    for (var depth = 0; f && depth < 500; depth++, f = f.return) {
      var p = f.memoizedProps;
      var s = p && (p.store || (p.value && p.value.store));
      if (s && typeof s.getState === "function" && typeof s.dispatch === "function") return s;
    }
    return null;
  }

  function findMessage(state, id) {
    var list = state && state.chatConversation && state.chatConversation.messages;
    if (!Array.isArray(list)) return null;
    for (var i = list.length - 1; i >= 0; i--) if (list[i] && list[i].id === id) return list[i];
    return null;
  }

  // ---------- Người dùng hiện tại ----------
  function lsGet(k) { return (localStorage.getItem(k) || "").replace(/^"|"$/g, ""); }

  function jwtPayload(token) {
    try {
      var p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      while (p.length % 4) p += "=";
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return null; }
  }

  // Ưu tiên profile trong store (app dùng chính nó để tô icon đã chọn), dự phòng đọc accessToken
  function getMe(state) {
    var p = state && state.auth && state.auth.profile;
    if (!p || p.partner_user_id == null) p = jwtPayload(lsGet("accessToken"));
    if (!p || p.partner_user_id == null) return null;
    return { partner_id: p.partner_id, partner_user_id: p.partner_user_id, name: p.name || "" };
  }

  function isMyTick(r, me) {
    return !!r && r.name === TICK && String(r.partner_id) === String(me.partner_id) &&
           String(r.partner_user_id) === String(me.partner_user_id);
  }

  // ---------- API (cùng endpoint + header app đang dùng) ----------
  function api(method, path, body) {
    var access = lsGet("accessToken");
    if (!access) return Promise.reject(new Error("chưa đăng nhập"));
    var headers = { "authorization": "Bearer " + access, "auth-token": lsGet("authToken"), "accept": "application/json, text/plain, */*",
                    "accept-language": "vi", "x-timezone": "Asia/Ho_Chi_Minh" };
    if (body) headers["content-type"] = "application/json";
    return fetch(API + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      if (r.status === 401) throw new Error("phiên đăng nhập hết hạn, hãy tải lại trang");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !j.status || j.status.error_code !== 0) throw new Error((j && j.status && (j.status.alert_message || j.status.error_message)) || "API lỗi");
      return j.data;
    });
  }

  // Hỏi lại server (chính xác nhất): store có thể chưa kịp nhận ✓ mình vừa thả ở thiết bị khác
  function serverHasMyTick(msgId, me) {
    return api("GET", "/chat/fetchReactionInfo?message_id=" + encodeURIComponent(msgId)).then(function (d) {
      return ((d && d.tabs) || []).some(function (tab) {
        return (tab.list || []).some(function (r) { return isMyTick(r, me); });
      });
    });
  }

  // ---------- Xác định tin được double-click ----------
  // Trả về tin hợp lệ để thả ✓, hoặc null để app xử lý như bình thường
  function hitTest(e) {
    if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return null;
    var t = e.target;
    var bubble = t && t.closest ? t.closest(MSG_SEL) : null;
    if (!bubble) return null;
    for (var el = t; el; el = el.parentElement) {
      if (el.matches(CLICKABLE_SEL) || hasClickHandler(el)) return null;
      if (el === bubble) break;
    }

    var hit = { msgId: bubble.id.slice(4), store: getStore(bubble), msg: null };
    var state = hit.store && hit.store.getState();
    if (state) {
      // Các trường hợp app ẩn nút reaction
      var cc = state.chatConversation || {}, ch = state.chatHistory || {};
      var aiId = state.app && state.app.config && state.app.config.ai_partner_user_id;
      if (cc.selectedMessages && cc.selectedMessages.open) return null;            // đang chọn nhiều tin
      if (ch.currentRoomDetail && ch.currentRoomDetail.is_blocked) return null;    // nhóm bị khoá
      if (aiId && String(ch.currentRoomId || "").split("-").indexOf(String(aiId)) !== -1) return null; // phòng trợ lý AI
      if ((cc.sendingMsgs || []).some(function (m) { return m.msg_id === hit.msgId; })) return null;   // tin đang gửi
      hit.msg = findMessage(state, hit.msgId);
      if (hit.msg && (hit.msg.is_deleted || hit.msg.is_failed || hit.msg.is_blocked)) return null;
    }
    return hit;
  }

  // ---------- Thả ✓ ----------
  function dropTick(hit, x, y) {
    var msgId = hit.msgId, store = hit.store;
    if (busy[msgId]) return;
    var me = getMe(store && store.getState());
    if (!me) { hint(x, y, "Không đọc được thông tin đăng nhập", true); return; }

    var before = hit.msg && Array.isArray(hit.msg.emotions) ? hit.msg.emotions : null;
    if (before && before.some(function (r) { return isMyTick(r, me); })) { hint(x, y, "Bạn đã thả ✓ tin này rồi"); return; }

    busy[msgId] = true;
    pop(x, y);
    // Vẽ ngay bằng reducer của app; socket "update_reaction" sẽ thay bằng danh sách thật từ server
    var optimistic = null;
    if (before) {
      optimistic = before.concat([{ name: TICK, partner_id: me.partner_id, partner_user_id: me.partner_user_id,
        user_display_name: me.name, time: Date.now(), _id: "hsk-tick-" + msgId, id: "hsk-tick-" + msgId }]);
      store.dispatch({ type: "UPDATE_REACTION", msg_id: msgId, emotions: optimistic });
    }

    serverHasMyTick(msgId, me).then(function (has) {
      if (has) { hint(x, y, "Bạn đã thả ✓ tin này rồi"); return; } // thả từ trước, store chưa cập nhật -> không gửi
      return api("POST", "/chat/reaction", { message_id: msgId, reaction_name: TICK });
    }).catch(function (err) {
      // Trả lại như cũ, trừ khi socket đã cập nhật danh sách mới hơn
      var cur = optimistic && findMessage(store.getState(), msgId);
      if (cur && cur.emotions === optimistic) store.dispatch({ type: "UPDATE_REACTION", msg_id: msgId, emotions: before });
      hint(x, y, "Không thả được ✓: " + (err && err.message ? err.message : err), true);
      console.warn(LOG_PREFIX, err);
    }).then(function () { delete busy[msgId]; });
  }

  // ---------- Phản hồi tại chỗ double-click ----------
  var host = null, shadow = null, hintEl = null, hintTimer = null;

  var CSS =
    ':host, * { box-sizing: border-box; font-family: "Segoe UI", Roboto, Arial, sans-serif; }' +
    '.pop { position: fixed; width: 30px; height: 30px; margin: -15px 0 0 -15px; animation: pop 0.7s ease-out forwards; }' +
    '@keyframes pop {' +
    '  0% { transform: scale(0.3); opacity: 0; }' +
    '  35% { transform: scale(1.2); opacity: 1; }' +
    '  100% { transform: translateY(-28px) scale(1); opacity: 0; }' +
    '}' +
    '@keyframes fade { from { opacity: 1; } to { opacity: 0; } }' +
    '@media (prefers-reduced-motion: reduce) { .pop { animation-name: fade; } }' +
    '.hint {' +
    '  position: fixed; max-width: 340px; padding: 5px 11px; border-radius: 12px; background: hsl(152, 39%, 24%);' +
    '  color: #fff; font-size: 12px; font-weight: 600; line-height: 1.4; box-shadow: 0 6px 18px rgba(0,0,0,0.2);' +
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' +
    '}' +
    '.hint[hidden] { display: none; }' +
    '.hint.err { background: #b02a37; }';

  function ensureHost() {
    if (host) return;
    host = document.createElement("div");
    host.id = "hsk-dblclick-tick-root";
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
    shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    document.documentElement.appendChild(host);
  }

  // Icon ✓ bật lên tại con trỏ
  function pop(x, y) {
    ensureHost();
    var img = document.createElement("img");
    img.className = "pop";
    img.src = TICK_ICON;
    img.alt = "";
    img.style.left = x + "px";
    img.style.top = y + "px";
    shadow.appendChild(img);
    setTimeout(function () { img.remove(); }, 900);
  }

  // Dòng nhắn ngắn phía trên con trỏ (tự ẩn)
  function hint(x, y, text, isErr) {
    ensureHost();
    clearTimeout(hintTimer);
    if (!hintEl) { hintEl = document.createElement("div"); shadow.appendChild(hintEl); }
    hintEl.className = "hint" + (isErr ? " err" : "");
    hintEl.textContent = text;
    hintEl.hidden = false;
    var r = hintEl.getBoundingClientRect();
    var top = y - r.height - 14;
    hintEl.style.left = Math.max(8, Math.min(x - r.width / 2, window.innerWidth - r.width - 8)) + "px";
    hintEl.style.top = (top < 8 ? y + 18 : top) + "px";
    hintTimer = setTimeout(function () { hintEl.hidden = true; }, isErr ? 4000 : 1800);
  }

  // ---------- Sự kiện ----------
  // Lần bấm thứ 2 của double-click: chặn trình duyệt bôi đen chữ, nếu không app sẽ hiện popup
  // "trả lời đoạn đã chọn" (onMouseUp của bubble) đè lên tin
  document.addEventListener("mousedown", function (e) {
    if (e.detail >= 2 && hitTest(e)) e.preventDefault();
  }, true);

  document.addEventListener("dblclick", function (e) {
    var hit = hitTest(e);
    if (hit) dropTick(hit, e.clientX, e.clientY);
  }, true);
})();
