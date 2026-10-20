// webadmin.js - Nút đổi domain/port cho request REST API trên webadmin.system.local
//
// Chạy ở MAIN world + run_at "document_start" (khai báo trong manifest.json) để patch
// fetch / XMLHttpRequest của CHÍNH TRANG trước khi bất kỳ script nào của trang chạy.
// (Content script ở isolated world có window.fetch riêng nên không chặn được request của trang.)
//
// Lưu ý CORS khi đổi sang domain/port khác:
// - Request trở thành cross-origin: backend đích phải trả Access-Control-Allow-Origin đúng
//   origin của webadmin (vd http://webadmin.system.local), không dùng "*" nếu có gửi cookie.
// - Header tuỳ chỉnh (Authorization, X-...), Content-Type: application/json hoặc method
//   PUT/PATCH/DELETE sẽ kèm preflight OPTIONS: backend cần trả Access-Control-Allow-Methods /
//   Access-Control-Allow-Headers phù hợp.
// - Cookie: fetch mặc định credentials "same-origin" nên sau khi đổi domain cookie KHÔNG được gửi;
//   nếu dùng credentials "include" / withCredentials thì backend cần
//   Access-Control-Allow-Credentials: true và cookie phải thuộc domain đích.
// - Trang https gọi sang http bị chặn (mixed content); gọi từ domain sang localhost có thể bị
//   Chrome chặn bởi Private/Local Network Access (cho phép khi Chrome hỏi, hoặc backend trả
//   Access-Control-Allow-Private-Network: true).
(function () {
  if (window.__hskDomainSwitcherInjected) return;
  window.__hskDomainSwitcherInjected = true;

  // Chỉ hoạt động trên webadmin.system.local
  if (location.hostname !== "webadmin.system.local") return;

  var STORAGE_KEY = "hsk_domain_switcher";
  var API_PATH_PREFIX = "/api";
  // Host nội bộ cùng hệ thống (vd api.system.local): request /api tới host ngoài (Sentry, Google...) giữ nguyên
  var INTERNAL_HOST_SUFFIX = "." + location.hostname.split(".").slice(1).join(".");
  // File tĩnh: không đổi domain
  var STATIC_EXT_RE = /\.(?:js|mjs|cjs|css|map|html?|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|ogg)$/i;
  var HOST_RE = /^(?:localhost|\[[0-9a-f:.]+\]|(?:[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?\.)*[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?)$/i;

  // ---------- Log ----------
  // Giữ tham chiếu console gốc ngay từ document_start (phòng khi trang tắt console.log ở bản build)
  var LOG_PREFIX = "[HSK Domain Switcher]";
  var LOG_STYLE = "color:#fff;background:hsl(152,39%,31%);padding:1px 5px;border-radius:3px;font-weight:600";
  var consoleLog = console.log.bind(console);
  var consoleWarn = console.warn.bind(console);

  function log(msg) { consoleLog("%c" + LOG_PREFIX, LOG_STYLE, msg); }
  function warn(msg, detail) { consoleWarn(LOG_PREFIX + " " + msg, detail); }

  // ---------- Kiểm tra & chuẩn hoá domain/port người dùng nhập ----------
  // Trả về { origin: "http://host:port" } hoặc { error: "..." }
  function parseTarget(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return { error: "Vui lòng nhập domain/port đích." };
    if (/^:?\d+$/.test(s)) return { error: "Thiếu host. Ví dụ: http://localhost:" + s.replace(":", "") };
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "http://" + s; // thiếu protocol -> mặc định http://

    var u;
    try {
      u = new URL(s);
    } catch (e) {
      return { error: "Sai định dạng (port phải từ 1-65535). Ví dụ: http://localhost:8080" };
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return { error: "Chỉ hỗ trợ http:// hoặc https://" };
    if (u.username || u.password) return { error: "Không nhập user/password trong địa chỉ." };
    if (u.pathname !== "/" || u.search || u.hash) {
      return { error: "Chỉ nhập protocol + host + port, không kèm path/query (vd: http://localhost:8080)." };
    }
    if (!HOST_RE.test(u.hostname)) return { error: "Host không hợp lệ: " + u.hostname };
    if (u.port === "0") return { error: "Port phải từ 1 đến 65535." };
    return { origin: u.origin };
  }

  // ---------- Cấu hình (localStorage) ----------
  function defaultConfig() { return { enabled: false, target: "" }; }

  function loadConfig() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return defaultConfig(); }
    if (!raw) return defaultConfig();
    try {
      var saved = JSON.parse(raw);
      if (!saved || !saved.target) return defaultConfig();
      var res = parseTarget(saved.target);
      if (res.error) {
        warn("Cấu hình đã lưu không hợp lệ, bỏ qua:", saved.target);
        return defaultConfig();
      }
      return { enabled: !!saved.enabled, target: res.origin };
    } catch (e) {
      warn("Không đọc được cấu hình đã lưu:", e);
      return defaultConfig();
    }
  }

  function logState() {
    if (config.enabled) log("Đang BẬT • request API → " + config.target);
    else log("Đang TẮT • request đi tới domain gốc " + location.origin);
  }

  function saveConfig(next) {
    config = { enabled: !!next.enabled, target: next.target || "" };
    try {
      if (!config.enabled && !config.target) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      warn("Không lưu được cấu hình vào localStorage:", e);
    }
    logState();
  }

  // Đọc đồng bộ ngay khi nạp -> request đầu tiên của trang đã dùng đúng cấu hình
  var config = loadConfig();

  // ---------- Xác định request API & viết lại URL ----------
  function isApiPath(pathname) {
    return pathname.toLowerCase().indexOf(API_PATH_PREFIX) === 0;
  }

  function isStaticPath(pathname) {
    if (pathname === "/") return true;                         // trang HTML gốc
    if (STATIC_EXT_RE.test(pathname)) return true;             // js, css, ảnh, font, media...
    return /\.json$/i.test(pathname) && !isApiPath(pathname);  // vd: /assets/i18n/vi.json
  }

  function isApiRequest(u) {
    if (u.protocol !== "http:" && u.protocol !== "https:") return false; // data:, blob:...
    if (isStaticPath(u.pathname)) return false;
    if (u.origin === location.origin) return true;                       // cùng origin với webadmin
    var internal = u.hostname === location.hostname ||
      u.hostname.slice(-INTERNAL_HOST_SUFFIX.length) === INTERNAL_HOST_SUFFIX;
    return internal && isApiPath(u.pathname);                            // /api... trên host nội bộ
  }

  // Trả về { from, to } nếu cần đổi domain, ngược lại null.
  // URL tương đối được resolve theo document.baseURI giống cách trình duyệt làm.
  function rewriteUrl(rawUrl) {
    if (!config.enabled || !config.target) return null;
    var u;
    try { u = new URL(rawUrl, document.baseURI); } catch (e) { return null; }
    if (!isApiRequest(u)) return null;
    var next = config.target + u.pathname + u.search + u.hash; // chỉ đổi protocol + host + port
    return next === u.href ? null : { from: u.href, to: next };
  }

  // ---------- Patch fetch ----------
  // Tạo lại Request với URL mới, giữ nguyên method, headers, body và các tuỳ chọn khác
  function cloneRequest(req, url) {
    var method = req.method.toUpperCase();
    var bodyPromise = (method === "GET" || method === "HEAD") ? Promise.resolve(undefined) : req.clone().arrayBuffer();
    return bodyPromise.then(function (body) {
      return new Request(url, {
        method: req.method,
        headers: req.headers,
        body: body,
        mode: req.mode,
        credentials: req.credentials,
        cache: req.cache,
        redirect: req.redirect,
        referrer: req.referrer,
        referrerPolicy: req.referrerPolicy,
        integrity: req.integrity,
        keepalive: req.keepalive,
        signal: req.signal
      });
    });
  }

  var origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input, init) {
      var r = null;
      var isRequest = false;
      if (config.enabled) {
        try {
          isRequest = !!input && typeof input === "object" && typeof input.url === "string" && typeof input.clone === "function";
          r = rewriteUrl(isRequest ? input.url : String(input));
        } catch (e) {
          warn("Lỗi khi xử lý fetch, giữ nguyên request:", e);
          r = null;
        }
      }
      if (!r) return origFetch.apply(window, arguments);

      var method = (init && init.method) || (isRequest ? input.method : "GET");
      log("fetch " + String(method).toUpperCase() + " " + r.from + " → " + r.to);
      if (!isRequest) return origFetch.call(window, r.to, init); // init (method/headers/body) giữ nguyên
      return new Promise(function (resolve) { resolve(cloneRequest(input, r.to)); })
        .then(function (req) { return origFetch.call(window, req, init); });
    };
  }

  // ---------- Patch XMLHttpRequest.open ----------
  var XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype && typeof XHR.prototype.open === "function") {
    var origOpen = XHR.prototype.open;
    XHR.prototype.open = function (method, url) {
      var next = null;
      if (config.enabled && arguments.length >= 2) {
        try {
          var r = rewriteUrl(String(url));
          if (r) {
            log("XHR " + String(method).toUpperCase() + " " + r.from + " → " + r.to);
            next = r.to;
          }
        } catch (e) {
          warn("Lỗi khi xử lý XHR, giữ nguyên request:", e);
        }
      }
      if (next === null) return origOpen.apply(this, arguments);
      // Giữ nguyên số tham số: open(m, u) là bất đồng bộ, còn open(m, u, undefined) lại là đồng bộ
      var args = Array.prototype.slice.call(arguments);
      args[1] = next;
      return origOpen.apply(this, args);
    };
  }

  // Tab/frame khác (cùng origin) đổi cấu hình -> cập nhật ngay, không cần tải lại
  var refreshUi = null;
  window.addEventListener("storage", function (e) {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    config = loadConfig();
    logState();
    if (refreshUi) refreshUi();
  });

  if (window.top === window) logState();

  // ================= Giao diện: nút nổi + panel (chỉ ở frame chính) =================
  function buildUi() {
    var host = document.createElement("div");
    host.id = "hsk-domain-switcher-root";
    host.style.all = "initial";
    (document.body || document.documentElement).appendChild(host);
    var shadow = host.attachShadow({ mode: "open" });

    shadow.innerHTML =
      '<div class="ds-label" hidden title="Domain API đang áp dụng - bấm để cấu hình"></div>' +
      '<button class="ds-fab" title="Đổi domain API">' +
      '  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '    <path d="M4 7h14M15 4l3 3-3 3M20 17H6M9 14l-3 3 3 3"/>' +
      '  </svg>' +
      '</button>' +
      '<div class="ds-panel" hidden>' +
      '  <div class="ds-header">' +
      '    <span class="ds-title">Đổi domain API</span>' +
      '    <button class="ds-close" title="Đóng">×</button>' +
      '  </div>' +
      '  <div class="ds-status"><b class="ds-state"></b><div class="ds-desc"></div></div>' +
      '  <div class="ds-field">' +
      '    <label for="ds-target">Domain/host + port đích</label>' +
      '    <input type="text" id="ds-target" class="ds-target" placeholder="http://localhost:8080" spellcheck="false" autocomplete="off">' +
      '    <div class="ds-hint">Ví dụ: http://localhost:8080 hoặc http://api.system.local:3000</div>' +
      '    <div class="ds-error" hidden></div>' +
      '  </div>' +
      '  <label class="ds-switch"><input type="checkbox" class="ds-enabled"> Bật chế độ đổi domain</label>' +
      '  <div class="ds-actions">' +
      '    <button class="ds-btn ds-save">Lưu</button>' +
      '    <button class="ds-btn ds-reset">Đặt lại mặc định</button>' +
      '  </div>' +
      '  <div class="ds-msg" hidden><span class="ds-msg-text"></span> <button class="ds-reload">Tải lại trang</button></div>' +
      '  <div class="ds-note">Chỉ đổi request <b>fetch</b>/<b>XHR</b> tới API: cùng origin với trang, hoặc path bắt đầu bằng <b>/api</b> trên host *' +
      INTERNAL_HOST_SUFFIX + '. Bỏ qua file tĩnh (js, css, ảnh, font...). Mỗi request bị đổi đều có log trong DevTools &gt; Console.</div>' +
      '  <div class="ds-note ds-warn">⚠ CORS: backend đích phải cho phép origin <b class="ds-origin"></b> (Access-Control-Allow-Origin, -Headers, -Methods; thêm -Credentials nếu dùng cookie).</div>' +
      '</div>';

    var css =
      ':host, * { box-sizing: border-box; font-family: "Segoe UI", Roboto, Arial, sans-serif; }' +
      '[hidden] { display: none !important; }' +
      // Nút nổi: giống .fab của hsk-timesheet-root, đặt cao hơn (bottom 260px) để không đè nút cũ (bottom 180px)
      '.ds-fab {' +
      '  position: fixed; bottom: 260px; right: 26px; z-index: 2147483647;' +
      '  width: 65px; height: 65px; border-radius: 50%; border: none; cursor: pointer; padding: 0;' +
      '  background: hsl(152 39% 31% / 1); color: #fff;' +
      '  box-shadow: 0 6px 18px hsl(152 39% 31% / 0.6); transition: transform 0.2s, box-shadow 0.2s, background 0.2s;' +
      '  display: flex; align-items: center; justify-content: center;' +
      '}' +
      '.ds-fab:hover { transform: scale(1.08); box-shadow: 0 8px 22px hsl(152 39% 31% / 0.8); }' +
      // Đang bật: màu cam + nhịp sáng để dễ nhận biết request đang bị chuyển domain
      '.ds-fab.active { background: hsl(28 85% 46% / 1); animation: dsPulse 1.8s ease-out infinite; }' +
      '@keyframes dsPulse {' +
      '  0% { box-shadow: 0 0 0 0 hsl(28 85% 46% / 0.55), 0 6px 18px hsl(28 85% 46% / 0.6); }' +
      '  70% { box-shadow: 0 0 0 14px hsl(28 85% 46% / 0), 0 6px 18px hsl(28 85% 46% / 0.6); }' +
      '  100% { box-shadow: 0 0 0 0 hsl(28 85% 46% / 0), 0 6px 18px hsl(28 85% 46% / 0.6); }' +
      '}' +
      // Nhãn domain đang áp dụng, nằm bên trái nút
      '.ds-label {' +
      '  position: fixed; bottom: 278px; right: 100px; z-index: 2147483647;' +
      '  max-width: 300px; height: 29px; padding: 0 12px; border-radius: 15px; cursor: pointer;' +
      '  background: rgba(33,37,41,0.88); color: #fff; font-size: 12px; font-weight: 600; line-height: 29px;' +
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 3px 10px rgba(0,0,0,0.25);' +
      '}' +
      // Panel
      '.ds-panel {' +
      '  position: fixed; bottom: 24px; right: 104px; z-index: 2147483647;' +
      '  width: 400px; max-width: calc(100vw - 128px); max-height: calc(100vh - 48px); overflow-y: auto;' +
      '  background: #fff; border-radius: 16px; padding: 20px; color: #333; font-size: 13px;' +
      '  box-shadow: 0 12px 40px rgba(0,0,0,0.25); border: 1px solid #eef0f3;' +
      '  animation: dsSlideUp 0.25s ease-out;' +
      '}' +
      '@keyframes dsSlideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }' +
      // Header
      '.ds-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }' +
      '.ds-title { font-size: 16px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 0.5px; }' +
      '.ds-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #999; line-height: 1; padding: 4px; }' +
      '.ds-close:hover { color: #dc3545; }' +
      // Trạng thái đang áp dụng
      '.ds-status { padding: 10px 12px; margin-bottom: 16px; border-radius: 10px; border-left: 4px solid #adb5bd; background: #f7f9fc; color: #555; line-height: 1.5; word-break: break-all; }' +
      '.ds-status .ds-state { color: #333; }' +
      '.ds-status.on { border-left-color: hsl(28, 85%, 46%); background: hsl(32, 100%, 96%); color: hsl(28, 70%, 28%); }' +
      '.ds-status.on .ds-state { color: hsl(28, 85%, 36%); }' +
      // Form
      '.ds-field { display: flex; flex-direction: column; margin-bottom: 12px; }' +
      '.ds-field label { font-size: 12px; color: #666; margin-bottom: 4px; font-weight: 600; }' +
      '.ds-field input { padding: 9px 10px; border: 1px solid #ddd; border-radius: 6px; outline: none; font-size: 13px; font-family: Consolas, "Courier New", monospace; color: #333; background: #fff; }' +
      '.ds-field input:focus { border-color: hsl(152, 39%, 31%); box-shadow: 0 0 6px hsla(152, 39%, 31%, 0.2); }' +
      '.ds-field input.invalid { border-color: #dc3545; box-shadow: 0 0 6px rgba(220,53,69,0.2); }' +
      '.ds-hint { font-size: 11px; color: #888; margin-top: 4px; }' +
      '.ds-error { font-size: 12px; color: #c82333; font-weight: 600; margin-top: 4px; }' +
      '.ds-switch { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-weight: 600; cursor: pointer; user-select: none; }' +
      '.ds-switch input { width: 18px; height: 18px; margin: 0; cursor: pointer; accent-color: hsl(152, 39%, 31%); }' +
      // Nút hành động
      '.ds-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }' +
      '.ds-btn { padding: 9px 18px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 13px; }' +
      '.ds-save { background: linear-gradient(45deg, hsl(152, 39%, 31%), hsl(152, 39%, 24%)); color: #fff; border: none; }' +
      '.ds-save:hover { background: linear-gradient(45deg, hsl(152, 39%, 24%), hsl(152, 39%, 18%)); }' +
      '.ds-reset { background: #fff; color: #555; border: 1px solid #ccc; }' +
      '.ds-reset:hover { color: #dc3545; border-color: #dc3545; }' +
      '.ds-msg { font-size: 12px; color: hsl(152, 39%, 24%); font-weight: 600; margin-bottom: 10px; }' +
      '.ds-reload { background: none; border: none; padding: 0; cursor: pointer; color: hsl(152, 39%, 31%); font-weight: 700; font-size: 12px; text-decoration: underline; }' +
      // Ghi chú
      '.ds-note { font-size: 11px; color: #777; line-height: 1.5; padding: 8px 10px; margin-top: 8px; background: #f7f9fc; border-radius: 8px; }' +
      '.ds-note b { color: #555; }' +
      '.ds-warn { background: #fff8e6; color: #8a6d1f; }' +
      '.ds-warn b { color: #6d5410; }';

    // adoptedStyleSheets không bị CSP style-src của trang chặn (script này chạy ở MAIN world)
    if (typeof CSSStyleSheet === "function" && "replaceSync" in CSSStyleSheet.prototype && "adoptedStyleSheets" in shadow) {
      var sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      shadow.adoptedStyleSheets = [sheet];
    } else {
      var styleEl = document.createElement("style");
      styleEl.textContent = css;
      shadow.insertBefore(styleEl, shadow.firstChild);
    }

    // ---------- Tham chiếu phần tử ----------
    var fab = shadow.querySelector(".ds-fab");
    var label = shadow.querySelector(".ds-label");
    var panel = shadow.querySelector(".ds-panel");
    var closeBtn = shadow.querySelector(".ds-close");
    var statusEl = shadow.querySelector(".ds-status");
    var stateEl = shadow.querySelector(".ds-state");
    var descEl = shadow.querySelector(".ds-desc");
    var targetInput = shadow.querySelector(".ds-target");
    var enabledInput = shadow.querySelector(".ds-enabled");
    var errorEl = shadow.querySelector(".ds-error");
    var msgEl = shadow.querySelector(".ds-msg");
    var msgText = shadow.querySelector(".ds-msg-text");
    var saveBtn = shadow.querySelector(".ds-save");
    var resetBtn = shadow.querySelector(".ds-reset");
    var reloadBtn = shadow.querySelector(".ds-reload");
    shadow.querySelector(".ds-origin").textContent = location.origin;

    // ---------- Render trạng thái đang áp dụng (trên nút + trong panel) ----------
    function render() {
      var on = config.enabled;
      fab.classList.toggle("active", on);
      fab.title = on ? "Đổi domain API - đang BẬT: " + config.target : "Đổi domain API - đang TẮT";
      label.hidden = !on || !panel.hidden; // panel mở thì trạng thái đã hiện trong panel
      label.textContent = on ? "API → " + new URL(config.target).host : "";
      statusEl.classList.toggle("on", on);
      stateEl.textContent = on ? "ĐANG BẬT đổi domain" : "ĐANG TẮT (mặc định)";
      descEl.textContent = on
        ? "Request API đang chuyển tới: " + config.target
        : "Request đi tới domain gốc: " + location.origin + (config.target ? " • Đã lưu: " + config.target : "");
    }

    function showError(text) {
      errorEl.textContent = text;
      errorEl.hidden = !text;
      targetInput.classList.toggle("invalid", !!text);
    }

    function showMsg(text) {
      msgText.textContent = text;
      msgEl.hidden = false;
    }

    function fillForm() {
      targetInput.value = config.target;
      enabledInput.checked = config.enabled;
      showError("");
      msgEl.hidden = true;
    }

    // Kiểm tra + lưu giá trị trên form (nút Lưu, phím Enter, bật công tắc)
    function applyForm() {
      var raw = targetInput.value.trim();
      var target = "";
      if (raw) {
        var res = parseTarget(raw);
        if (res.error) { showError(res.error); return false; }
        target = res.origin;
      }
      if (enabledInput.checked && !target) {
        showError("Nhập domain/port đích trước khi bật.");
        return false;
      }
      showError("");
      saveConfig({ enabled: enabledInput.checked, target: target });
      targetInput.value = target; // hiển thị dạng đã chuẩn hoá
      render();
      showMsg(config.enabled
        ? "Đã lưu, áp dụng ngay cho request mới. Tải lại để áp dụng cho toàn trang."
        : "Đã lưu. Chế độ đổi domain đang tắt.");
      return true;
    }

    function openPanel() {
      fillForm();
      panel.hidden = false;
      render();
      targetInput.focus();
    }
    function closePanel() {
      panel.hidden = true;
      render();
    }

    // ---------- Sự kiện ----------
    fab.addEventListener("click", function () {
      if (panel.hidden) openPanel(); else closePanel();
    });
    label.addEventListener("click", function () {
      if (panel.hidden) openPanel();
    });
    closeBtn.addEventListener("click", closePanel);
    saveBtn.addEventListener("click", applyForm);
    reloadBtn.addEventListener("click", function () { location.reload(); });
    targetInput.addEventListener("input", function () { showError(""); });

    // Bật cần domain hợp lệ; tắt thì luôn được (giữ lại domain đã lưu)
    enabledInput.addEventListener("change", function () {
      if (enabledInput.checked) {
        if (!applyForm()) enabledInput.checked = false;
        return;
      }
      saveConfig({ enabled: false, target: config.target });
      render();
      showMsg("Đã tắt đổi domain, request đi về domain gốc.");
    });

    resetBtn.addEventListener("click", function () {
      saveConfig(defaultConfig());
      fillForm();
      render();
      showMsg("Đã đặt lại mặc định: không đổi domain.");
    });

    // Phím gõ trong panel không lan ra trang (tránh kích hoạt phím tắt của webadmin)
    ["keydown", "keyup", "keypress"].forEach(function (type) {
      panel.addEventListener(type, function (e) {
        e.stopPropagation();
        if (type !== "keydown") return;
        if (e.key === "Escape") closePanel();
        else if (e.key === "Enter" && e.target === targetInput) applyForm();
      });
    });

    // Bấm ra ngoài widget -> đóng panel (click trong shadow bị retarget thành host).
    // Dùng capture để trang có stopPropagation vẫn đóng được.
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !host.contains(e.target)) closePanel();
    }, true);

    // Nhấn Esc -> đóng panel
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) closePanel();
    });

    refreshUi = render;
    render();
  }

  function initUi() {
    if (window.top !== window || document.getElementById("hsk-domain-switcher-root")) return;
    try {
      buildUi();
    } catch (e) {
      // Lỗi giao diện (vd CSP/Trusted Types của trang) không ảnh hưởng phần đổi domain
      warn("Không dựng được giao diện, phần đổi domain vẫn hoạt động:", e);
    }
  }

  // document_start: chưa có <body>, đợi DOM sẵn sàng mới dựng nút
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initUi);
  else initUi();
})();
