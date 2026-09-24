// snow.js - Hiệu ứng tuyết rơi cho test.hasakiexpress.vn
(function () {
  if (window.__hskSnowInjected) return;
  window.__hskSnowInjected = true;

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

  // Tạm dừng khi tab ẩn để tiết kiệm tài nguyên
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      requestAnimationFrame(draw);
    }
  });

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
})();
