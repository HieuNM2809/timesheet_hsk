// background.js - service worker
// Đọc cookie wshr-token và gọi API Hasaki (bỏ qua CORS nhờ host_permissions).

async function getToken() {
  var urls = ["https://wshr.hasaki.vn/", "https://work.hasaki.vn/"];
  for (var i = 0; i < urls.length; i++) {
    try {
      var cookie = await chrome.cookies.get({ url: urls[i], name: "wshr-token" });
      if (cookie && cookie.value) {
        return cookie.value;
      }
    } catch (e) {
      // bỏ qua, thử url tiếp theo
    }
  }
  return null;
}

async function fetchData(fromDate, toDate) {
  var token = await getToken();
  if (!token) {
    return { error: "no_token" };
  }

  var headers = {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
  };

  var profileUrl = "https://wshr.hasaki.vn/api/setting/user/profile?employee=1";
  var timesheetUrl = "https://wshr.hasaki.vn/api/hr/timesheet/login-user?from_date=" +
    fromDate + "&to_date=" + toDate;

  try {
    var results = await Promise.all([
      fetch(profileUrl, { headers: headers }).then(function(r) { return r.json(); }),
      fetch(timesheetUrl, { headers: headers }).then(function(r) { return r.json(); })
    ]);
    return { profile: results[0], timesheet: results[1] };
  } catch (e) {
    return { error: "fetch_failed", message: String(e) };
  }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request && request.action === "fetchTimesheet") {
    fetchData(request.fromDate, request.toDate).then(sendResponse);
    return true; // giữ kênh mở cho phản hồi bất đồng bộ
  }
});
