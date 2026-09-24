// content.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getToken") {

      console.log('getToken');

      // Lấy token từ cookies với key "wshr-token"
      const match = document.cookie.match(/(?:^|;\s*)wshr-token=([^;]*)/);
      const token = match ? decodeURIComponent(match[1]) : null;
      sendResponse({ token });
    }
  });
  