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

  // ---------- Vòng lặp animation ----------
  var running = true;

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.sway += f.swaySpeed;
      f.y += f.speed;
      f.x += f.drift + Math.sin(f.sway) * 0.5;

      // Ra khỏi màn hình -> đưa lại lên trên
      if (f.y > H + 5) {
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

    requestAnimationFrame(draw);
  }

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
})();
