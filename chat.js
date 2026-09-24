// chat.js - Bỏ chữ "(UTC+7)" trên chat.hasaki.vn
(function () {
  if (window.__hskChatUtcInjected) return;
  window.__hskChatUtcInjected = true;

  // Bắt các biến thể: (UTC+7), (UTC +7), ( utc + 7 )...
  var RE = /\s*\(\s*UTC\s*\+\s*7\s*\)/gi;

  function cleanTextNode(node) {
    if (node.nodeValue && /UTC\s*\+\s*7/i.test(node.nodeValue)) {
      var replaced = node.nodeValue.replace(RE, "");
      if (replaced !== node.nodeValue) node.nodeValue = replaced;
    }
  }

  function cleanTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { cleanTextNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) cleanTextNode(n);
  }

  cleanTree(document.body);

  // Theo dõi nội dung động (chat cập nhật liên tục)
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === "characterData") {
        cleanTextNode(m.target);
      } else {
        for (var j = 0; j < m.addedNodes.length; j++) {
          cleanTree(m.addedNodes[j]);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
