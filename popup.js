// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // ----- Thiết lập giá trị mặc định cho ngày (tháng hiện tại) -----
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();

  if (dd < 10) { dd = '0' + dd; }
  if (mm < 10) { mm = '0' + mm; }

  var currentDate = yyyy + '-' + mm + '-' + dd;
  var firstDate = yyyy + '-' + mm + '-01';

  document.getElementById("fromDate").value = firstDate;
  document.getElementById("toDate").value = currentDate;

  // ----- Đọc cookie "wshr-token" bằng chrome.cookies API -----
  // Thử lần lượt các domain có thể chứa cookie (đọc được cả cookie HttpOnly).
  function getToken(callback) {
    var urls = ["https://wshr.hasaki.vn/", "https://work.hasaki.vn/"];
    var index = 0;

    function tryNext() {
      if (index >= urls.length) {
        callback(null);
        return;
      }
      var url = urls[index++];
      chrome.cookies.get({ url: url, name: "wshr-token" }, function(cookie) {
        if (chrome.runtime.lastError) {
          tryNext();
          return;
        }
        if (cookie && cookie.value) {
          callback(cookie.value);
        } else {
          tryNext();
        }
      });
    }

    tryNext();
  }

  // ----- Chuyển đổi giữa màn hình chọn ngày và màn hình dữ liệu -----
  function showForm() {
    document.getElementById("dataContainer").style.display = "none";
    document.getElementById("loginContainer").style.display = "block";
  }

  function showData() {
    document.getElementById("loginContainer").style.display = "none";
    document.getElementById("dataContainer").style.display = "block";
  }

  // ----- Tải thông tin nhân viên (avatar + tên) -----
  function loadProfile(token) {
    var apiUrl = "https://wshr.hasaki.vn/api/setting/user/profile?employee=1";
    fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      }
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.status === 1 && data.data && data.data.profile) {
        var profile = data.data.profile;
        var nameEl = document.getElementById("staffName");
        var avatarEl = document.getElementById("staffAvatar");

        if (profile.name) {
          nameEl.textContent = profile.name;
        }
        if (profile.avatar) {
          avatarEl.src = profile.avatar;
          avatarEl.style.display = "block";
        }
      }
    })
    .catch(function(error) {
      console.error("Lỗi khi lấy thông tin nhân viên:", error);
    });
  }

  // Lưu lựa chọn "nửa ngày" theo từng ngày và danh sách dòng hiện tại
  var halfDayMap = {};
  var currentRows = [];

  // ----- Render bảng + tổng kết -----
  function renderData(data) {
    var tableBody = document.querySelector("#dataTable tbody");
    tableBody.innerHTML = "";
    currentRows = [];
    var staffName = "";

    if (data.status === 1 && data.data && Array.isArray(data.data.rows)) {
      data.data.rows.forEach(function(row) {
        // Lấy tên nhân viên (giống nhau ở mọi dòng) để hiển thị lên đầu
        if (!staffName && row.staff && row.staff.staff_name) {
          staffName = row.staff.staff_name;
        }

        var tr = document.createElement("tr");
        var checkInTime = new Date(row.check_in * 1000).toLocaleString();
        var checkOutTime = row.check_out ? new Date(row.check_out * 1000).toLocaleString() : "Chưa có";
        var hasCheckout = !!row.check_out;
        var checkOutCellClass = hasCheckout ? "" : "missing-checkout";
        var isChecked = halfDayMap[row.date] ? "checked" : "";
        var cbDisabled = hasCheckout ? "" : "disabled";

        // Cột "Kết quả" và class dòng sẽ được điền bởi recalc()
        tr.innerHTML = "<td>" + row.date + "</td>" +
                       "<td>" + checkInTime + "</td>" +
                       "<td class='" + checkOutCellClass + "'>" + checkOutTime + "</td>" +
                       "<td class='result-cell'></td>" +
                       "<td class='half-day-cell'><input type='checkbox' class='half-day' data-date='" + row.date + "' " + isChecked + " " + cbDisabled + "></td>";
        tableBody.appendChild(tr);
        currentRows.push({ row: row, tr: tr });
      });
    } else {
      var trEmpty = document.createElement("tr");
      trEmpty.innerHTML = "<td colspan='5' style='text-align:center;'>Không có dữ liệu hiển thị hoặc xảy ra lỗi.</td>";
      tableBody.appendChild(trEmpty);
    }

    // Dự phòng: nếu profile chưa trả về tên thì dùng tên từ dữ liệu chấm công
    var nameEl = document.getElementById("staffName");
    if (!nameEl.textContent && staffName) {
      nameEl.textContent = staffName;
    }

    // Gắn sự kiện cho các checkbox "nửa ngày"
    tableBody.querySelectorAll(".half-day").forEach(function(cb) {
      cb.addEventListener("change", function() {
        halfDayMap[this.getAttribute("data-date")] = this.checked;
        recalc();
      });
    });

    recalc();
  }

  // Tính lại kết quả từng dòng + tổng kết (chuẩn 8h/ngày, hoặc 4h nếu tick nửa ngày)
  function recalc() {
    var totalExcess = 0;
    var totalShortage = 0;

    currentRows.forEach(function(item) {
      var row = item.row;
      var tr = item.tr;
      var resultCell = tr.querySelector(".result-cell");
      var resultText = "";
      var resultClass = "";
      var isWarning = false;

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
    var summaryDiv = document.getElementById("summary");
    summaryDiv.innerHTML =
      "<div class='stat-card excess'>" +
        "<div class='stat-label'>Tổng giờ dư</div>" +
        "<div class='stat-value'>" + totalExcess.toFixed(2) + "<span class='stat-unit'>giờ</span></div>" +
      "</div>" +
      "<div class='stat-card shortage'>" +
        "<div class='stat-label'>Tổng giờ thiếu</div>" +
        "<div class='stat-value'>" + totalShortage.toFixed(2) + "<span class='stat-unit'>giờ</span></div>" +
      "</div>" +
      "<div class='stat-card final " + finalClass + "'>" +
        "<div class='stat-label'>Giờ cuối cùng</div>" +
        "<div class='stat-value'>" + finalHours.toFixed(2) + "<span class='stat-unit'>giờ</span></div>" +
      "</div>";
  }

  // ----- Tải dữ liệu theo khoảng ngày -----
  function loadData(fromDate, toDate) {
    getToken(function(token) {
      if (!token) {
        alert("Không lấy được token (cookie 'wshr-token'). Vui lòng đăng nhập lại trang work.hasaki.vn rồi thử lại!");
        showForm();
        return;
      }

      // Hiển thị màn hình dữ liệu + trạng thái đang tải
      showData();
      document.getElementById("rangeLabel").textContent = "Từ " + fromDate + " đến " + toDate;

      // Tải thông tin nhân viên (avatar + tên)
      loadProfile(token);
      var tableBody = document.querySelector("#dataTable tbody");
      tableBody.innerHTML = "<tr><td colspan='5' id='loadingState'>Đang tải dữ liệu...</td></tr>";
      document.getElementById("summary").innerHTML = "";

      var apiUrl = "https://wshr.hasaki.vn/api/hr/timesheet/login-user?from_date=" + fromDate + "&to_date=" + toDate;

      fetch(apiUrl, {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        }
      })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        renderData(data);
      })
      .catch(function(error) {
        console.error("Lỗi khi gọi API:", error);
        alert("Đã xảy ra lỗi khi gọi API. Vui lòng thử lại!");
        showForm();
      });
    });
  }

  // ----- Sự kiện -----
  // Nút "Chọn lại tháng" -> quay về form chọn ngày
  document.getElementById("backBtn").addEventListener("click", function() {
    showForm();
  });

  // Submit form -> tải theo ngày người dùng chọn
  document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();
    var fromDate = document.getElementById("fromDate").value;
    var toDate = document.getElementById("toDate").value;
    loadData(fromDate, toDate);
  });

  // ----- Tự động tải dữ liệu tháng hiện tại khi mở popup -----
  loadData(firstDate, currentDate);
});
