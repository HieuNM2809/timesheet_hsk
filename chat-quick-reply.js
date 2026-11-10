// chat-quick-reply.js - Thanh câu trả lời nhanh cho chat.hasaki.vn
// Bấm một chip -> chèn câu đó vào ô soạn tin (Quill) rồi tự bấm nút gửi.
// An toàn: nếu đang soạn dở thì chỉ chèn chữ, KHÔNG tự gửi.
(function () {
  if (window.__hskQuickReplyInjected) return;
  window.__hskQuickReplyInjected = true;

  var STORAGE_KEY = "hsk_quick_replies";
  var EDITOR_SEL = ".ql-editor[contenteditable='true']";
  var BOX_SEL = ".chat-dashboard__conversation__box";
  var SEND_SEL = 'svg[data-testid="SendRoundedIcon"]';

  var DEFAULTS = [
    "Ok ạ",
    "Đã nhận",
    "Em check rồi báo lại ạ",
    "Em đang xử lý",
    "Đã xong ạ",
    "Chờ em chút ạ",
    "Anh/chị check giúp em với ạ",
    "Cảm ơn anh/chị ạ"
  ];

  var replies = DEFAULTS.slice();

  // ---------- Lưu / đọc danh sách câu ----------
  function loadReplies(cb) {
    try {
      var q = {};
      q[STORAGE_KEY] = DEFAULTS;
      chrome.storage.local.get(q, function (res) {
        var list = res && res[STORAGE_KEY];
        replies = Array.isArray(list) && list.length ? list : DEFAULTS.slice();
        cb && cb();
      });
    } catch (e) {
      replies = DEFAULTS.slice();
      cb && cb();
    }
  }

  function saveReplies(list) {
    replies = list;
    try {
      var obj = {};
      obj[STORAGE_KEY] = list;
      chrome.storage.local.set(obj);
    } catch (e) {}
  }

  // ---------- Chèn chữ + gửi ----------
  function getEditor() { return document.querySelector(EDITOR_SEL); }

  function getSendBtn() {
    var svg = document.querySelector(SEND_SEL);
    return svg ? svg.parentElement : null;
  }

  // Quill cập nhật bất đồng bộ: đợi tới khi nó bỏ class ql-blank rồi mới bấm gửi
  function whenQuillReady(ed, done, tries) {
    tries = tries || 0;
    if (!ed.classList.contains("ql-blank") || tries >= 20) { done(); return; }
    setTimeout(function () { whenQuillReady(ed, done, tries + 1); }, 50);
  }

  function quickSend(text) {
    var ed = getEditor();
    if (!ed) return;

    var wasEmpty = ed.classList.contains("ql-blank") || !ed.innerText.trim();

    ed.focus();
    // execCommand sinh đúng sự kiện beforeinput/input nên Quill (và React) nhận được
    document.execCommand("insertText", false, text);

    // Đang soạn dở -> chỉ chèn thêm chữ, không tự gửi để tránh gửi nhầm
    if (!wasEmpty) return;

    whenQuillReady(ed, function () {
      var btn = getSendBtn();
      if (btn) btn.click();
    });
  }

  // ---------- Giao diện ----------
  var host = null;
  var shadow = null;

  var CSS =
    ':host, * { box-sizing: border-box; font-family: "Segoe UI", Roboto, Arial, sans-serif; }' +
    '[hidden] { display: none !important; }' +
    '.bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px 10px 2px 10px; }' +
    '.chip {' +
    '  border: 1px solid hsl(152, 39%, 78%); background: hsl(152, 39%, 96%); color: hsl(152, 39%, 24%);' +
    '  border-radius: 14px; padding: 4px 11px; font-size: 12.5px; font-weight: 600; cursor: pointer;' +
    '  white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis;' +
    '  transition: background 0.15s, transform 0.1s;' +
    '}' +
    '.chip:hover { background: hsl(152, 39%, 31%); color: #fff; }' +
    '.chip:active { transform: scale(0.96); }' +
    '.edit-btn {' +
    '  border: 1px dashed #c3ccd6; background: #fff; color: #777; border-radius: 14px;' +
    '  padding: 4px 9px; font-size: 12px; cursor: pointer; line-height: 1.2;' +
    '}' +
    '.edit-btn:hover { color: hsl(152, 39%, 31%); border-color: hsl(152, 39%, 31%); }' +
    // Bảng sửa danh sách
    '.panel {' +
    '  position: absolute; bottom: 100%; left: 10px; z-index: 50; width: 340px;' +
    '  background: #fff; border: 1px solid #e3e8ef; border-radius: 12px; padding: 14px;' +
    '  box-shadow: 0 10px 30px rgba(0,0,0,0.18); margin-bottom: 6px;' +
    '}' +
    '.panel h4 { margin: 0 0 4px; font-size: 13px; color: #333; text-transform: uppercase; letter-spacing: 0.4px; }' +
    '.panel .hint { font-size: 11px; color: #888; margin-bottom: 8px; }' +
    '.panel textarea {' +
    '  width: 100%; height: 150px; resize: vertical; padding: 8px; font-size: 12.5px;' +
    '  border: 1px solid #ddd; border-radius: 6px; outline: none; font-family: inherit; color: #333;' +
    '}' +
    '.panel textarea:focus { border-color: hsl(152, 39%, 31%); box-shadow: 0 0 6px hsla(152, 39%, 31%, 0.2); }' +
    '.actions { display: flex; gap: 8px; margin-top: 10px; }' +
    '.btn { padding: 7px 14px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12.5px; }' +
    '.save { background: linear-gradient(45deg, hsl(152, 39%, 31%), hsl(152, 39%, 24%)); color: #fff; border: none; }' +
    '.save:hover { background: linear-gradient(45deg, hsl(152, 39%, 24%), hsl(152, 39%, 18%)); }' +
    '.reset { background: #fff; color: #555; border: 1px solid #ccc; }' +
    '.reset:hover { color: #dc3545; border-color: #dc3545; }' +
    '.close { margin-left: auto; background: none; border: none; color: #999; font-size: 18px; cursor: pointer; padding: 0 4px; }' +
    '.close:hover { color: #dc3545; }';

  function buildUi() {
    host = document.createElement("div");
    host.id = "hsk-quick-reply-root";
    host.style.position = "relative";
    shadow = host.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);

    var bar = document.createElement("div");
    bar.className = "bar";
    shadow.appendChild(bar);

    var panel = document.createElement("div");
    panel.className = "panel";
    panel.hidden = true;
    panel.innerHTML =
      '<h4>Câu trả lời nhanh</h4>' +
      '<div class="hint">Mỗi dòng là một câu. Bấm chip để gửi ngay.</div>' +
      '<textarea class="list" spellcheck="false"></textarea>' +
      '<div class="actions">' +
      '  <button class="btn save">Lưu</button>' +
      '  <button class="btn reset">Mặc định</button>' +
      '  <button class="close" title="Đóng">×</button>' +
      '</div>';
    shadow.appendChild(panel);

    var textarea = panel.querySelector(".list");

    function renderBar() {
      bar.innerHTML = "";
      replies.forEach(function (text) {
        var chip = document.createElement("button");
        chip.className = "chip";
        chip.textContent = text;
        chip.title = "Gửi: " + text;
        chip.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          quickSend(text);
        });
        bar.appendChild(chip);
      });
      var edit = document.createElement("button");
      edit.className = "edit-btn";
      edit.textContent = "✏️ Sửa";
      edit.title = "Sửa danh sách câu trả lời nhanh";
      edit.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (panel.hidden) {
          textarea.value = replies.join("\n");
          panel.hidden = false;
          textarea.focus();
        } else {
          panel.hidden = true;
        }
      });
      bar.appendChild(edit);
    }

    panel.querySelector(".save").addEventListener("click", function () {
      var list = textarea.value.split("\n")
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length; });
      saveReplies(list.length ? list : DEFAULTS.slice());
      renderBar();
      panel.hidden = true;
    });

    panel.querySelector(".reset").addEventListener("click", function () {
      saveReplies(DEFAULTS.slice());
      textarea.value = replies.join("\n");
      renderBar();
    });

    panel.querySelector(".close").addEventListener("click", function () {
      panel.hidden = true;
    });

    // Gõ phím trong bảng không lọt ra app chat
    ["keydown", "keyup", "keypress"].forEach(function (t) {
      panel.addEventListener(t, function (e) {
        e.stopPropagation();
        if (t === "keydown" && e.key === "Escape") panel.hidden = true;
      });
    });

    // Bấm ra ngoài -> đóng bảng sửa
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !host.contains(e.target)) panel.hidden = true;
    }, true);

    host.__render = renderBar;
    renderBar();
  }

  // Gắn thanh chip ngay phía trên khung soạn tin
  function attach() {
    var box = document.querySelector(BOX_SEL);
    if (!box || !box.parentElement) return;
    if (host && host.parentElement === box.parentElement && host.nextElementSibling === box) return;
    if (!host) buildUi();
    box.parentElement.insertBefore(host, box);
  }

  loadReplies(function () {
    attach();
    // App là SPA: đổi cuộc trò chuyện sẽ dựng lại khung soạn tin -> gắn lại
    var observer = new MutationObserver(function () { attach(); });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
