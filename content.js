// content.js - Widget nổi hiển thị timesheet ngay trên trang work.hasaki.vn
(function () {
  if (window.__hskTimesheetInjected) return;
  window.__hskTimesheetInjected = true;

  // ---------- Helpers ngày tháng ----------
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function getDefaultRange() {
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = today.getMonth() + 1;
    var dd = today.getDate();
    return {
      from: yyyy + "-" + pad(mm) + "-01",
      to: yyyy + "-" + pad(mm) + "-" + pad(dd)
    };
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Tạo host + Shadow DOM ----------
  var host = document.createElement("div");
  host.id = "hsk-timesheet-root";
  host.style.all = "initial";
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML =
    '<style>' +
    ':host, * { box-sizing: border-box; font-family: "Segoe UI", Roboto, Arial, sans-serif; }' +
    // Nút nổi
    '.fab {' +
    '  position: fixed; bottom: 180px; right: 26px; z-index: 2147483647;' +
    '  width: 65px; height: 65px; border-radius: 50%; border: none; cursor: pointer;' +
    '  background: hsl(152 39% 31% / 1); color: #fff; font-size: 24px;' +
    '  box-shadow: 0 6px 18px hsl(152 39% 31% / 0.6); transition: transform 0.2s, box-shadow 0.2s;' +
    '  display: flex; align-items: center; justify-content: center;' +
    '}' +
    '.fab:hover { transform: scale(1.08); box-shadow: 0 8px 22px hsl(152 39% 31% / 0.8); }' +
    // Panel
    '.panel {' +
    '  position: fixed; bottom: 92px; right: 24px; z-index: 2147483647;' +
    '  width: 720px; max-width: calc(100vw - 48px); max-height: 80vh; overflow-y: auto;' +
    '  background: #fff; border-radius: 16px; padding: 20px;' +
    '  box-shadow: 0 12px 40px rgba(0,0,0,0.25); border: 1px solid #eef0f3;' +
    '  animation: slideUp 0.25s ease-out;' +
    '}' +
    '.panel[hidden] { display: none; }' +
    '@keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }' +
    // Header
    '.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }' +
    '.panel-title { font-size: 16px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 0.5px; }' +
    '.close-btn { background: none; border: none; font-size: 22px; cursor: pointer; color: #999; line-height: 1; padding: 4px; }' +
    '.close-btn:hover { color: #dc3545; }' +
    // Profile
    '.profile-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 16px; }' +
    '.staff-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid hsl(152, 39%, 31%); box-shadow: 0 3px 10px hsla(152, 39%, 31%, 0.25); margin-bottom: 8px; }' +
    '.staff-name { font-size: 18px; font-weight: 700; color: hsl(152, 39%, 24%); text-align: center; }' +
    // Controls
    '.controls { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px; background: #f7f9fc; border-radius: 10px; }' +
    '.field { display: flex; flex-direction: column; }' +
    '.field label { font-size: 12px; color: #666; margin-bottom: 4px; font-weight: 600; }' +
    '.field input { padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; outline: none; }' +
    '.field input:focus { border-color: hsl(152, 39%, 31%); box-shadow: 0 0 6px hsla(152, 39%, 31%, 0.2); }' +
    '.view-btn { padding: 9px 18px; background: linear-gradient(45deg, hsl(152, 39%, 31%), hsl(152, 39%, 24%)); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; }' +
    '.view-btn:hover { background: linear-gradient(45deg, hsl(152, 39%, 24%), hsl(152, 39%, 18%)); }' +
    // Summary
    '.summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }' +
    '.stat-card { background: #fff; border: 1px solid #eef0f3; border-radius: 12px; padding: 14px 10px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.06); border-top: 4px solid #ccc; }' +
    '.stat-card .stat-label { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }' +
    '.stat-card .stat-value { font-size: 24px; font-weight: 700; line-height: 1.1; }' +
    '.stat-card .stat-unit { font-size: 12px; font-weight: 500; color: #999; margin-left: 3px; }' +
    '.stat-card.excess { border-top-color: #28a745; } .stat-card.excess .stat-value { color: #28a745; }' +
    '.stat-card.shortage { border-top-color: #dc3545; } .stat-card.shortage .stat-value { color: #dc3545; }' +
    '.stat-card.final { border: 1px solid hsl(152, 39%, 78%); border-top: 4px solid hsl(152, 39%, 31%); background: linear-gradient(135deg, hsl(152, 39%, 94%), hsl(152, 39%, 98%)); box-shadow: 0 4px 12px hsla(152, 39%, 31%, 0.18); }' +
    '.stat-card.final .stat-label { color: hsl(152, 39%, 24%); font-weight: 700; }' +
    '.stat-card.final .stat-value { font-size: 30px; font-weight: 800; }' +
    '.stat-card.final.positive .stat-value { color: #1e7e34; }' +
    '.stat-card.final.negative .stat-value { color: #c82333; }' +
    // Table
    '.table-wrapper { overflow-x: auto; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }' +
    'table { width: 100%; border-collapse: collapse; background: #fff; font-size: 13px; }' +
    'th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eef0f3; }' +
    'thead th { background: linear-gradient(135deg, hsl(152, 39%, 31%), hsl(152, 39%, 24%)); color: #fff; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; position: sticky; top: 0; }' +
    'tbody tr:nth-child(even) { background: #f7f9fc; }' +
    'tbody tr:hover { background: hsl(152, 39%, 95%); }' +
    'tbody tr:last-child td { border-bottom: none; }' +
    '.overtime { color: #1e7e34; font-weight: 700; }' +
    '.shortage { color: #c82333; font-weight: 800; }' +
    'tr.row-warning { background: #fff5f5 !important; }' +
    'tr.row-warning:hover { background: #ffe9e9 !important; }' +
    'tr.row-warning td:first-child { border-left: 4px solid #dc3545; }' +
    '.missing-checkout { color: #c82333; font-weight: 800; }' +
    '.half-day-cell { text-align: center; }' +
    '.half-day { width: 18px; height: 18px; cursor: pointer; }' +
    '.state-msg { text-align: center; padding: 24px; color: hsl(152, 39%, 31%); font-weight: 600; }' +
    '</style>' +
    '<button class="fab" title="Giờ làm việc">⏱</button>' +
    '<div class="panel" hidden>' +
    '  <div class="panel-header">' +
    '    <span class="panel-title">Giờ làm việc</span>' +
    '    <button class="close-btn" title="Đóng">×</button>' +
    '  </div>' +
    '  <div class="profile-header">' +
    '    <img class="staff-avatar" alt="Avatar" style="display:none;">' +
    '    <div class="staff-name"></div>' +
    '  </div>' +
    '  <div class="controls">' +
    '    <div class="field"><label>Từ ngày</label><input type="date" class="from-date"></div>' +
    '    <div class="field"><label>Đến ngày</label><input type="date" class="to-date"></div>' +
    '    <button class="view-btn">Xem</button>' +
    '  </div>' +
    '  <div class="summary"></div>' +
    '  <div class="table-wrapper">' +
    '    <table>' +
    '      <thead><tr><th>Ngày</th><th>Check-in</th><th>Check-out</th><th>Kết quả</th><th>Nửa ngày (4h)</th></tr></thead>' +
    '      <tbody></tbody>' +
    '    </table>' +
    '  </div>' +
    '</div>';

  // ---------- Tham chiếu phần tử ----------
  var fab = shadow.querySelector(".fab");
  var panel = shadow.querySelector(".panel");
  var closeBtn = shadow.querySelector(".close-btn");
  var viewBtn = shadow.querySelector(".view-btn");
  var fromInput = shadow.querySelector(".from-date");
  var toInput = shadow.querySelector(".to-date");
  var avatarEl = shadow.querySelector(".staff-avatar");
  var nameEl = shadow.querySelector(".staff-name");
  var summaryEl = shadow.querySelector(".summary");
  var tbody = shadow.querySelector("tbody");

  var range = getDefaultRange();
  fromInput.value = range.from;
  toInput.value = range.to;
  var loadedOnce = false;

  // Lưu lựa chọn "nửa ngày" theo từng ngày (giữ khi tải lại cùng kỳ) và danh sách dòng hiện tại
  var halfDayMap = {};
  var currentRows = [];

  // ---------- Render ----------
  function renderProfile(profileResp) {
    if (profileResp && profileResp.status === 1 && profileResp.data && profileResp.data.profile) {
      var p = profileResp.data.profile;
      if (p.name) nameEl.textContent = p.name;
      if (p.avatar) { avatarEl.src = p.avatar; avatarEl.style.display = "block"; }
    }
  }

  function renderTimesheet(tsResp) {
    tbody.innerHTML = "";
    currentRows = [];
    var staffName = "";

    if (tsResp && tsResp.status === 1 && tsResp.data && Array.isArray(tsResp.data.rows)) {
      tsResp.data.rows.forEach(function (row) {
        if (!staffName && row.staff && row.staff.staff_name) staffName = row.staff.staff_name;

        var tr = document.createElement("tr");
        var checkInTime = new Date(row.check_in * 1000).toLocaleString();
        var checkOutTime = row.check_out ? new Date(row.check_out * 1000).toLocaleString() : "Chưa có";
        var hasCheckout = !!row.check_out;
        var checkOutCellClass = hasCheckout ? "" : "missing-checkout";
        var isChecked = halfDayMap[row.date] ? "checked" : "";
        var cbDisabled = hasCheckout ? "" : "disabled";

        // Cột "Kết quả" và class dòng sẽ được điền bởi recalc()
        tr.innerHTML =
          "<td>" + escapeHtml(row.date) + "</td>" +
          "<td>" + escapeHtml(checkInTime) + "</td>" +
          "<td class='" + checkOutCellClass + "'>" + escapeHtml(checkOutTime) + "</td>" +
          "<td class='result-cell'></td>" +
          "<td class='half-day-cell'><input type='checkbox' class='half-day' data-date='" + escapeHtml(row.date) + "' " + isChecked + " " + cbDisabled + "></td>";
        tbody.appendChild(tr);
        currentRows.push({ row: row, tr: tr });
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='5' class='state-msg'>Không có dữ liệu hiển thị hoặc xảy ra lỗi.</td></tr>";
    }

    if (!nameEl.textContent && staffName) nameEl.textContent = staffName;

    // Gắn sự kiện cho các checkbox "nửa ngày"
    shadow.querySelectorAll(".half-day").forEach(function (cb) {
      cb.addEventListener("change", function () {
        halfDayMap[this.getAttribute("data-date")] = this.checked;
        recalc();
      });
    });

    recalc();
  }

  // Tính lại kết quả từng dòng + tổng kết (chuẩn 8h/ngày, hoặc 4h nếu tick nửa ngày)
  function recalc() {
    var totalExcess = 0, totalShortage = 0;

    currentRows.forEach(function (item) {
      var row = item.row, tr = item.tr;
      var resultCell = tr.querySelector(".result-cell");
      var resultText = "", resultClass = "", isWarning = false;

      if (row.check_out) {
        var effectiveHours = (row.check_out - row.check_in) / 3600 - 1;
        var standard = halfDayMap[row.date] ? 4 : 8;
        var diff = effectiveHours - standard;
        if (diff >= 0) {
          resultText = "Dư: " + diff.toFixed(2) + " giờ";
          resultClass = "overtime";
          totalExcess += diff;
        } else {
          resultText = "Thiếu: " + Math.abs(diff).toFixed(2) + " giờ";
          resultClass = "shortage";
          totalShortage += Math.abs(diff);
          isWarning = true;
        }
      } else {
        resultText = "⚠ Chưa check-out";
        resultClass = "shortage";
        isWarning = true;
      }

      tr.className = isWarning ? "row-warning" : "";
      resultCell.className = "result-cell " + resultClass;
      resultCell.textContent = resultText;
    });

    var finalHours = totalExcess - totalShortage;
    var finalClass = finalHours >= 0 ? "positive" : "negative";
    summaryEl.innerHTML =
      "<div class='stat-card excess'><div class='stat-label'>Tổng giờ dư</div><div class='stat-value'>" + totalExcess.toFixed(2) + "<span class='stat-unit'>giờ</span></div></div>" +
      "<div class='stat-card shortage'><div class='stat-label'>Tổng giờ thiếu</div><div class='stat-value'>" + totalShortage.toFixed(2) + "<span class='stat-unit'>giờ</span></div></div>" +
      "<div class='stat-card final " + finalClass + "'><div class='stat-label'>Giờ cuối cùng</div><div class='stat-value'>" + finalHours.toFixed(2) + "<span class='stat-unit'>giờ</span></div></div>";
  }

  // ---------- Tải dữ liệu ----------
  function loadData() {
    var fromDate = fromInput.value;
    var toDate = toInput.value;
    tbody.innerHTML = "<tr><td colspan='5' class='state-msg'>Đang tải dữ liệu...</td></tr>";
    summaryEl.innerHTML = "";

    chrome.runtime.sendMessage(
      { action: "fetchTimesheet", fromDate: fromDate, toDate: toDate },
      function (resp) {
        if (chrome.runtime.lastError || !resp) {
          tbody.innerHTML = "<tr><td colspan='5' class='state-msg'>Không kết nối được extension. Hãy tải lại trang.</td></tr>";
          return;
        }
        if (resp.error === "no_token") {
          tbody.innerHTML = "<tr><td colspan='5' class='state-msg'>Không lấy được token. Vui lòng đăng nhập lại work.hasaki.vn.</td></tr>";
          return;
        }
        if (resp.error) {
          tbody.innerHTML = "<tr><td colspan='5' class='state-msg'>Đã xảy ra lỗi khi gọi API.</td></tr>";
          return;
        }
        renderProfile(resp.profile);
        renderTimesheet(resp.timesheet);
      }
    );
  }

  // ---------- Sự kiện ----------
  function openPanel() {
    panel.hidden = false;
    if (!loadedOnce) { loadedOnce = true; loadData(); }
  }
  function closePanel() { panel.hidden = true; }

  fab.addEventListener("click", function () {
    if (panel.hidden) openPanel(); else closePanel();
  });
  closeBtn.addEventListener("click", closePanel);
  viewBtn.addEventListener("click", loadData);

  // Bấm ra ngoài widget -> đóng panel (click trong shadow bị retarget thành host)
  document.addEventListener("click", function (e) {
    if (!panel.hidden && !host.contains(e.target)) {
      closePanel();
    }
  });

  // Nhấn Esc -> đóng panel
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) {
      closePanel();
    }
  });
})();
