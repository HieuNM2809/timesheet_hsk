// snow.js - Hiệu ứng tuyết rơi cho test.hasakiexpress.vn
(function () {
  if (window.__hskSnowInjected) return;
  window.__hskSnowInjected = true;

  var effectsEnabled = true; // bật/tắt toàn bộ hiệu ứng
  var hatEl = null;          // mũ Noel trên logo (nếu có)

  // ---------- Canvas phủ toàn màn hình (không chặn thao tác) ----------
  var canvas = document.createElement("canvas");
  canvas.id = "hsk-snow-canvas";
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;" +
    "pointer-events:none;z-index:2147483646;";
  document.documentElement.appendChild(canvas);
  var ctx = canvas.getContext("2d");

  var W = 0, H = 0, dpr = window.devicePixelRatio || 1;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // ---------- Bông tuyết ----------
  var FLAKE_COUNT = Math.min(160, Math.round(W / 9)); // theo bề rộng màn hình
  var flakes = [];

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function makeFlake(atTop) {
    return {
      x: rand(0, W),
      y: atTop ? rand(-H, 0) : rand(0, H),
      r: rand(1.2, 4.2),               // bán kính
      speed: rand(0.5, 2.2),           // tốc độ rơi
      drift: rand(-0.6, 0.6),          // trôi ngang
      sway: rand(0, Math.PI * 2),      // pha lắc lư
      swaySpeed: rand(0.005, 0.02),
      opacity: rand(0.4, 0.95)
    };
  }

  for (var i = 0; i < FLAKE_COUNT; i++) flakes.push(makeFlake(false));

  // ---------- Tuyết đọng dưới đáy (tích tụ theo thời gian) ----------
  var binW = 6;
  var bins = 0;
  var heights = [];
  var MAX_PILE = 90;
  function rebuildPile() {
    bins = Math.ceil(W / binW);
    var nh = [];
    for (var b = 0; b < bins; b++) nh[b] = heights[b] || 0;
    heights = nh;
  }
  rebuildPile();
  window.addEventListener("resize", rebuildPile);

  function heightAt(x) {
    var b = Math.floor(x / binW);
    if (b < 0) b = 0; else if (b >= bins) b = bins - 1;
    return heights[b] || 0;
  }

  function drawPile() {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var b = 0; b < bins; b++) ctx.lineTo(b * binW, H - heights[b]);
    ctx.lineTo(W, H);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, H - MAX_PILE, 0, H);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(228,240,255,0.9)");
    ctx.fillStyle = g;
    ctx.fill();
  }

  // ---------- Vụ nổ tuyết khi click ----------
  var bursts = [];
  function spawnBurst(x, y) {
    for (var i = 0; i < 22; i++) {
      var ang = rand(0, Math.PI * 2), sp = rand(1.5, 5.5);
      bursts.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - rand(0, 2),
        r: rand(1.5, 3.8), life: 1
      });
    }
  }

  // ---------- Vệt lấp lánh theo con trỏ ----------
  var sparkles = [];
  function spawnSparkle(x, y) {
    if (sparkles.length > 140) return;
    sparkles.push({ x: x + rand(-4, 4), y: y + rand(-4, 4), r: rand(1, 2.6), life: 1, vy: rand(0.2, 0.9) });
  }

  // ---------- Vòng lặp animation ----------
  var running = true;

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    // Tuyết đọng
    drawPile();

    // Bông tuyết rơi
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.sway += f.swaySpeed;
      f.y += f.speed;
      f.x += f.drift + Math.sin(f.sway) * 0.5;

      var groundY = H - heightAt(f.x);
      if (f.y >= groundY) {
        // Đọng lại thành lớp tuyết
        var bi = Math.floor(f.x / binW);
        if (bi >= 0 && bi < bins && heights[bi] < MAX_PILE) {
          heights[bi] += 0.4;
          if (bi > 0) heights[bi - 1] += 0.12;
          if (bi < bins - 1) heights[bi + 1] += 0.12;
        }
        f.y = rand(-20, -5);
        f.x = rand(0, W);
      }
      if (f.x > W + 5) f.x = -5;
      else if (f.x < -5) f.x = W + 5;

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255," + f.opacity + ")";
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.shadowBlur = 4;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Vụ nổ tuyết
    for (var j = bursts.length - 1; j >= 0; j--) {
      var p = bursts[j];
      p.vy += 0.08; // trọng lực
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.012;
      if (p.life <= 0 || p.y > H + 10) { bursts.splice(j, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255," + Math.max(0, p.life) + ")";
      ctx.fill();
    }

    // Vệt lấp lánh
    for (var k = sparkles.length - 1; k >= 0; k--) {
      var sp = sparkles[k];
      sp.y += sp.vy;
      sp.life -= 0.03;
      if (sp.life <= 0) { sparkles.splice(k, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.life);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(180,220,255,0.95)";
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }

  // Sự kiện: click nổ tuyết, di chuột tạo lấp lánh
  document.addEventListener("click", function (e) {
    spawnBurst(e.clientX, e.clientY);
  });
  var lastSpark = 0;
  document.addEventListener("mousemove", function (e) {
    var now = Date.now();
    if (now - lastSpark > 28) {
      lastSpark = now;
      spawnSparkle(e.clientX, e.clientY);
    }
  });

  // Bật/tắt vòng lặp theo trạng thái hiệu ứng và hiển thị tab
  function updateRunning() {
    var shouldRun = effectsEnabled && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      requestAnimationFrame(draw);
    } else if (!shouldRun) {
      running = false;
      if (ctx) ctx.clearRect(0, 0, W, H);
    }
  }
  document.addEventListener("visibilitychange", updateRunning);

  requestAnimationFrame(draw);

  // ---------- Trang trí góc phải dưới: cây thông + tuyết rơi nhỏ ----------
  var deco = document.createElement("div");
  deco.id = "hsk-xmas-root";
  deco.style.cssText =
    "position:fixed;right:16px;bottom:0;z-index:2147483646;" +
    "pointer-events:none;width:150px;height:210px;";
  document.documentElement.appendChild(deco);
  var dshadow = deco.attachShadow({ mode: "open" });

  var lights = "";
  var lightPos = [
    [60, 60], [45, 85], [78, 88], [55, 110], [82, 115],
    [40, 130], [72, 140], [58, 150], [88, 145], [50, 165]
  ];
  var lightColors = ["#ff4d4d", "#ffd24d", "#4dff88", "#4dd2ff", "#ff7ae0"];
  for (var li = 0; li < lightPos.length; li++) {
    lights += "<circle class='light' cx='" + lightPos[li][0] + "' cy='" + lightPos[li][1] +
      "' r='3.2' fill='" + lightColors[li % lightColors.length] +
      "' style='animation-delay:" + (li * 0.18).toFixed(2) + "s'/>";
  }

  dshadow.innerHTML =
    "<style>" +
    ":host, * { box-sizing: border-box; }" +
    ".wrap { position: relative; width: 150px; height: 210px; }" +
    ".tree { position: absolute; left: 0; bottom: 0; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25)); animation: sway 4s ease-in-out infinite; transform-origin: 75px 200px; }" +
    "@keyframes sway { 0%,100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }" +
    ".light { animation: twinkle 1.4s ease-in-out infinite alternate; }" +
    "@keyframes twinkle { from { opacity: 0.35; } to { opacity: 1; filter: drop-shadow(0 0 3px currentColor); } }" +
    ".star { animation: glow 2s ease-in-out infinite alternate; transform-origin: center; }" +
    "@keyframes glow { from { opacity: 0.7; } to { opacity: 1; } }" +
    // Tuyết rơi nhỏ quanh cây
    ".snow-local { position: absolute; left: 0; top: 0; width: 150px; height: 210px; overflow: hidden; }" +
    ".lf { position: absolute; top: -8px; border-radius: 50%; background: #fff; opacity: 0.9; box-shadow: 0 0 3px rgba(255,255,255,0.8); animation: fall linear infinite; }" +
    "@keyframes fall { 0% { transform: translateY(0) translateX(0); opacity: 0; } 10% { opacity: 0.9; } 100% { transform: translateY(200px) translateX(10px); opacity: 0.2; } }" +
    "</style>" +
    "<div class='wrap'>" +
    "  <div class='snow-local'></div>" +
    "  <svg class='tree' width='150' height='210' viewBox='0 0 150 210'>" +
    "    <!-- tuyết đọng dưới gốc -->" +
    "    <ellipse cx='75' cy='202' rx='62' ry='10' fill='#ffffff' opacity='0.9'/>" +
    "    <!-- thân cây -->" +
    "    <rect x='67' y='178' width='16' height='24' rx='2' fill='#7a4a21'/>" +
    "    <!-- tán lá -->" +
    "    <polygon points='75,30 112,95 38,95' fill='#2e7d32'/>" +
    "    <polygon points='75,65 122,140 28,140' fill='#388e3c'/>" +
    "    <polygon points='75,105 132,182 18,182' fill='#43a047'/>" +
    "    <!-- viền tuyết trên tán -->" +
    "    <polygon points='75,30 112,95 38,95' fill='none' stroke='#ffffff' stroke-width='2' opacity='0.35'/>" +
    "    <!-- ngôi sao -->" +
    "    <polygon class='star' points='75,10 80,24 95,24 83,33 88,47 75,38 62,47 67,33 55,24 70,24' fill='#ffd700'/>" +
    lights +
    "  </svg>" +
    "</div>";

  // Tạo các bông tuyết rơi nhỏ quanh cây
  var snowLocal = dshadow.querySelector(".snow-local");
  for (var s = 0; s < 14; s++) {
    var lf = document.createElement("span");
    var size = rand(2, 4);
    lf.className = "lf";
    lf.style.left = rand(0, 140) + "px";
    lf.style.width = size + "px";
    lf.style.height = size + "px";
    lf.style.animationDuration = rand(4, 8).toFixed(2) + "s";
    lf.style.animationDelay = rand(0, 6).toFixed(2) + "s";
    snowLocal.appendChild(lf);
  }

  // ---------- Viền màn hình đóng băng (frost 4 cạnh) ----------
  var frost = document.createElement("div");
  frost.id = "hsk-frost";
  frost.style.cssText =
    "position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2147483645;" +
    "box-shadow: inset 0 0 90px 24px rgba(255,255,255,0.35), inset 0 0 180px 70px rgba(205,232,255,0.16);" +
    "background:" +
    "radial-gradient(circle at 0 0, rgba(255,255,255,0.55), transparent 16%)," +
    "radial-gradient(circle at 100% 0, rgba(255,255,255,0.55), transparent 16%)," +
    "radial-gradient(circle at 0 100%, rgba(255,255,255,0.55), transparent 16%)," +
    "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.55), transparent 16%);";
  document.documentElement.appendChild(frost);

  // ================= Trang trí lễ hội =================
  var festiveStyle = document.createElement("style");
  festiveStyle.textContent =
    "@keyframes hsk-santa-fly { 0% { transform: translateX(-340px) translateY(0); } 50% { transform: translateX(50vw) translateY(-20px); } 100% { transform: translateX(calc(100vw + 340px)) translateY(0); } }" +
    "@keyframes hsk-gift-fall { 0% { transform: translateY(-60px) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(100vh) rotate(340deg); opacity: 0.85; } }" +
    ".hsk-santa { position: fixed; top: 30px; left: 0; font-size: 44px; line-height: 1; z-index: 2147483646; pointer-events: none; white-space: nowrap; will-change: transform; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25)); }" +
    ".hsk-gift { position: fixed; top: -60px; font-size: 30px; line-height: 1; z-index: 2147483646; pointer-events: none; will-change: transform; }";
  document.documentElement.appendChild(festiveStyle);

  // ----- 1) Ông già Noel cưỡi tuần lộc bay ngang -----
  function flySanta() {
    if (!effectsEnabled || document.hidden) return;
    var s = document.createElement("div");
    s.className = "hsk-santa";
    s.textContent = "🎅🛷🦌🦌";
    s.style.top = (20 + Math.random() * 50) + "px";
    s.style.animation = "hsk-santa-fly 12s linear forwards";
    document.documentElement.appendChild(s);
    s.addEventListener("animationend", function () { s.remove(); });
  }
  setTimeout(flySanta, 8000); // lần đầu sau 8s
  setInterval(flySanta, 150000 + Math.random() * 90000); // ~2.5 - 4 phút/lần

  // ----- 2) Quà rơi xen lẫn tuyết -----
  function dropGift() {
    if (!effectsEnabled || document.hidden) return;
    var g = document.createElement("div");
    g.className = "hsk-gift";
    g.textContent = Math.random() < 0.85 ? "🎁" : (Math.random() < 0.5 ? "🍬" : "⛄");
    g.style.left = (Math.random() * 95) + "vw";
    g.style.animation = "hsk-gift-fall " + (7 + Math.random() * 5).toFixed(1) + "s linear forwards";
    document.documentElement.appendChild(g);
    g.addEventListener("animationend", function () { g.remove(); });
  }
  setInterval(dropGift, 18000);

  // ----- 3) Dây đèn nháy vắt ngang mép trên -----
  var garlandHost = document.createElement("div");
  garlandHost.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:46px;z-index:2147483646;pointer-events:none;";
  document.documentElement.appendChild(garlandHost);
  var gsh = garlandHost.attachShadow({ mode: "open" });
  var bulbColors = ["#ff4d4d", "#ffd24d", "#4dff88", "#4dd2ff", "#ff7ae0"];
  var bulbCount = Math.max(14, Math.round(window.innerWidth / 55));
  var bulbsHtml = "";
  for (var gi = 0; gi < bulbCount; gi++) {
    var cx = ((gi + 0.5) * (100 / bulbCount)).toFixed(2);
    bulbsHtml += "<span class='bulb' style='left:" + cx + "vw;color:" + bulbColors[gi % bulbColors.length] +
      ";animation-delay:" + (gi * 0.15).toFixed(2) + "s'></span>";
  }
  gsh.innerHTML =
    "<style>" +
    ".wire { position:absolute; top:0; left:-2%; width:104%; height:22px; border-bottom:2px solid rgba(70,45,25,0.55); border-radius:0 0 48% 48% / 0 0 100% 100%; }" +
    ".bulb { position:absolute; top:18px; width:9px; height:13px; margin-left:-4.5px; border-radius:50% 50% 55% 55%; background:currentColor; box-shadow:0 0 8px currentColor; animation:hsk-blink 1.4s ease-in-out infinite alternate; }" +
    ".bulb::before { content:''; position:absolute; top:-3px; left:2px; width:5px; height:3px; background:#555; border-radius:2px; }" +
    "@keyframes hsk-blink { from { opacity:0.35; } to { opacity:1; } }" +
    "</style><div class='wire'></div>" + bulbsHtml;

  // ----- 4) Người tuyết ở góc trái dưới -----
  var snowmanHost = document.createElement("div");
  snowmanHost.style.cssText = "position:fixed;left:16px;bottom:0;width:120px;height:175px;z-index:2147483646;pointer-events:none;";
  document.documentElement.appendChild(snowmanHost);
  var msh = snowmanHost.attachShadow({ mode: "open" });
  msh.innerHTML =
    "<style>.sm { filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2)); animation: hsk-bob 4s ease-in-out infinite; transform-origin: 60px 165px; } @keyframes hsk-bob { 0%,100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }</style>" +
    "<svg class='sm' width='120' height='175' viewBox='0 0 120 175'>" +
    "<ellipse cx='60' cy='167' rx='50' ry='8' fill='#fff' opacity='0.9'/>" +
    "<circle cx='60' cy='122' r='34' fill='#f4f9ff'/>" +
    "<circle cx='60' cy='72' r='24' fill='#f4f9ff'/>" +
    "<rect x='39' y='48' width='42' height='8' rx='2' fill='#c0392b'/>" +
    "<rect x='46' y='24' width='28' height='26' rx='3' fill='#222'/>" +
    "<rect x='44' y='44' width='32' height='7' fill='#c0392b'/>" +
    "<circle cx='52' cy='68' r='3' fill='#333'/><circle cx='68' cy='68' r='3' fill='#333'/>" +
    "<polygon points='60,74 84,78 60,82' fill='#e67e22'/>" +
    "<circle cx='53' cy='84' r='1.6' fill='#333'/><circle cx='60' cy='86' r='1.6' fill='#333'/><circle cx='67' cy='84' r='1.6' fill='#333'/>" +
    "<circle cx='60' cy='110' r='3' fill='#333'/><circle cx='60' cy='124' r='3' fill='#333'/><circle cx='60' cy='138' r='3' fill='#333'/>" +
    "<rect x='37' y='94' width='46' height='9' rx='3' fill='#2980b9'/>" +
    "<rect x='72' y='98' width='9' height='24' rx='3' fill='#2980b9'/>" +
    "<line x1='27' y1='120' x2='3' y2='106' stroke='#7a4a21' stroke-width='3' stroke-linecap='round'/>" +
    "<line x1='93' y1='120' x2='117' y2='106' stroke='#7a4a21' stroke-width='3' stroke-linecap='round'/>" +
    "</svg>";

  // ----- 5) Mũ Noel gắn lên logo trang (best-effort) -----
  try {
    var logo = document.querySelector(
      'img[alt*="logo" i], img[src*="logo" i], .logo img, header a img, a[href="/"] img, header img'
    );
    if (logo) {
      var hatWrap = document.createElement("div");
      hatWrap.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;transform:rotate(-18deg);";
      hatWrap.innerHTML =
        "<svg width='100%' height='100%' viewBox='0 0 40 34'>" +
        "<path d='M4 27 Q9 3 33 8 Q29 18 30 27 Z' fill='#c0392b'/>" +
        "<rect x='2' y='24' width='33' height='8' rx='4' fill='#fff'/>" +
        "<circle cx='34' cy='7' r='5' fill='#fff'/>" +
        "</svg>";
      document.documentElement.appendChild(hatWrap);
      hatEl = hatWrap;
      var placeHat = function () {
        if (!effectsEnabled) { hatWrap.style.display = "none"; return; }
        var r = logo.getBoundingClientRect();
        if (!r.width || !r.height) { hatWrap.style.display = "none"; return; }
        hatWrap.style.display = "block";
        var w = Math.max(26, r.height * 0.9);
        hatWrap.style.width = w + "px";
        hatWrap.style.height = (w * 0.85) + "px";
        hatWrap.style.left = (r.left - w * 0.12) + "px";
        hatWrap.style.top = (r.top - w * 0.55) + "px";
      };
      placeHat();
      window.addEventListener("scroll", placeHat, true);
      window.addEventListener("resize", placeHat);
      setInterval(placeHat, 1000);
    }
  } catch (e) { /* bỏ qua nếu không tìm được logo */ }

  // ================= Nút bật/tắt hiệu ứng =================
  var toggleBtn = document.createElement("button");
  toggleBtn.style.cssText =
    "position:fixed;top:56px;right:14px;z-index:2147483647;width:36px;height:36px;" +
    "border:none;border-radius:50%;cursor:pointer;background:rgba(255,255,255,0.9);" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.25);font-size:17px;line-height:36px;text-align:center;" +
    "padding:0;pointer-events:auto;transition:transform 0.2s;";
  toggleBtn.addEventListener("mouseenter", function () { toggleBtn.style.transform = "scale(1.12)"; });
  toggleBtn.addEventListener("mouseleave", function () { toggleBtn.style.transform = "scale(1)"; });
  document.documentElement.appendChild(toggleBtn);

  function setEnabled(on) {
    effectsEnabled = on;
    var disp = on ? "" : "none";
    canvas.style.display = disp;
    frost.style.display = disp;
    deco.style.display = disp;
    garlandHost.style.display = disp;
    snowmanHost.style.display = disp;
    if (hatEl) hatEl.style.display = on ? "block" : "none";
    updateRunning();
    toggleBtn.textContent = on ? "❄️" : "🌙";
    toggleBtn.title = on ? "Tắt hiệu ứng lễ hội" : "Bật hiệu ứng lễ hội";
  }

  // Key lưu trạng thái RIÊNG theo từng trang (domain)
  var STORAGE_KEY = "hsk_effects_enabled_" + location.hostname;

  toggleBtn.addEventListener("click", function () {
    var next = !effectsEnabled;
    setEnabled(next);
    try {
      var obj = {};
      obj[STORAGE_KEY] = next;
      chrome.storage.local.set(obj);
    } catch (e) {}
  });

  // Đọc lựa chọn đã lưu cho trang này (mặc định bật)
  try {
    var query = {};
    query[STORAGE_KEY] = true;
    chrome.storage.local.get(query, function (res) {
      setEnabled(res && res[STORAGE_KEY] !== false);
    });
  } catch (e) {
    setEnabled(true);
  }
})();
