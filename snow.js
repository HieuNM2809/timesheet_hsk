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
})();
