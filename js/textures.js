/* ============================================================
   程序化纹理 —— 全部用 Canvas 实时绘制，零外部资源依赖
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function grain(ctx, w, h, amount, alpha) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
      if (alpha) d[i + 3] = Math.min(255, d[i + 3] * (0.9 + Math.random() * 0.2));
    }
    ctx.putImageData(img, 0, 0);
  }

  function tex(canvas, rx, ry) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 16;
    return t;
  }

  /* ---------- 黄琉璃瓦（筒瓦垄） ---------- */
  function tileCanvas() {
    const S = 512;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    // 底色：金黄琉璃（整体压暗，靠光照提亮）
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, '#8a6a16');
    g.addColorStop(0.5, '#b08c22');
    g.addColorStop(1, '#8a6a16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // 8 条筒瓦垄（每条一个高光弧 + 沟槽阴影）
    // 注意：纹理沿屋面坡度方向重复平铺，纵向不能有渐变，否则出现条带
    const n = 8;
    const w = S / n;
    for (let i = 0; i < n; i++) {
      const x = i * w;
      const lg = ctx.createLinearGradient(x, 0, x + w, 0);
      lg.addColorStop(0.0, 'rgba(88,60,10,0.32)');  // 垄沟
      lg.addColorStop(0.18, 'rgba(160,120,30,0.06)');
      lg.addColorStop(0.36, 'rgba(255,246,204,0.44)');// 高光
      lg.addColorStop(0.52, 'rgba(238,204,110,0.12)');
      lg.addColorStop(0.74, 'rgba(150,104,26,0.10)');
      lg.addColorStop(1.0, 'rgba(76,50,10,0.32)');
      ctx.fillStyle = lg;
      ctx.fillRect(x, 0, w, S);
    }
    /* 瓦垄横向分块：只画纵向垄沟时，屋面在斜视下会拉成一片长条，
       远看像瓦楞铁。每 16 像素压一道瓦口横缝，近处才有
       "一块一块瓦"的读感；缝上留一道高光，模拟压边。
       缝要 2px 以上，1px 线在 mipmap 里会直接被滤掉。 */
    const rows = 16;
    for (let r = 1; r < rows; r++) {
      const y = Math.round((r * S) / rows);
      const tone = 0.26 + 0.06 * Math.sin(r * 1.7);
      ctx.fillStyle = 'rgba(70,46,8,' + tone.toFixed(3) + ')';
      ctx.fillRect(0, y, S, 2);
      ctx.fillStyle = 'rgba(255,240,186,0.16)';
      ctx.fillRect(0, y - 1, S, 1);
    }
    // 琉璃釉面细微斑驳
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const v = Math.random();
      ctx.fillStyle = v > 0.5
        ? `rgba(255,236,180,${0.02 + Math.random() * 0.05})`
        : `rgba(70,48,8,${0.03 + Math.random() * 0.06})`;
      ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 6);
    }
    grain(ctx, S, S, 12);
    return c;
  }

  /* ---------- 琉璃瓦凹凸（灰度，线性空间） ---------- */
  function tileBumpCanvas() {
    const S = 256;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, S, S);
    const n = 8;
    const w = S / n;
    // 筒瓦横截面：半圆脊，用横向渐变模拟坡度
    for (let i = 0; i < n; i++) {
      const x = i * w;
      const lg = ctx.createLinearGradient(x, 0, x + w, 0);
      lg.addColorStop(0.0, '#3a3a3a');
      lg.addColorStop(0.16, '#666666');
      lg.addColorStop(0.38, '#e8e8e8');
      lg.addColorStop(0.5, '#f4f4f4');
      lg.addColorStop(0.68, '#9a9a9a');
      lg.addColorStop(0.88, '#4a4a4a');
      lg.addColorStop(1.0, '#3a3a3a');
      ctx.fillStyle = lg;
      ctx.fillRect(x, 0, w, S);

    }
    return c;
  }

  /* ---------- 接地暗影（径向渐变，柔边） ---------- */
  function shadowBlobCanvas() {
    const S = 256;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.62)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.72, 'rgba(0,0,0,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return c;
  }

  /* ---------- 云层：已改为天空 shader 内的程序化云（见 app.js），
       这里保留一个轻量版本供备用 ---------- */
  function cloudCanvas() {
    const W = 512, H = 256;
    const c = cv(W, H);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const t = Math.pow(Math.random(), 1.35);
      const y = (0.26 + t * 0.36) * H;
      const x = Math.random() * W;
      const r = 14 + Math.random() * 60 * (1 - t * 0.45);
      const a = (0.22 + Math.random() * 0.4) * (1 - t * 0.42);
      const g = ctx.createRadialGradient(x, y - r * 0.18, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a * 1.5})`);
      g.addColorStop(0.45, `rgba(246,249,253,${a})`);
      g.addColorStop(0.78, `rgba(214,224,236,${a * 0.45})`);
      g.addColorStop(1, 'rgba(200,212,228,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + Math.random() * 0.25), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  }

  /* ---------- 殿额匾（蓝底金字，沥粉贴金边框） ---------- */
  const plaqueCache = {};
  function plaqueCanvas(text) {
    const W = 660, H = 200;
    const c = cv(W, H);
    const ctx = c.getContext('2d');

    // 底：靛蓝
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d3f61');
    g.addColorStop(0.55, '#152f49');
    g.addColorStop(1, '#0f2236');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 木纹噪点
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 90 : 10},${Math.random() > 0.5 ? 120 : 20},${Math.random() > 0.5 ? 150 : 30},0.05)`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 1);
    }

    // 外金边
    ctx.strokeStyle = '#d8b25c';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, W - 10, H - 10);
    // 内细边
    ctx.strokeStyle = 'rgba(232,198,120,0.75)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(22, 22, W - 44, H - 44);
    // 四角回纹扣
    const corner = (x, y, sx, sy) => {
      ctx.fillStyle = '#c9a227';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sx * 26, y);
      ctx.lineTo(x + sx * 26, y + sy * 9);
      ctx.lineTo(x + sx * 9, y + sy * 9);
      ctx.lineTo(x + sx * 9, y + sy * 26);
      ctx.lineTo(x, y + sy * 26);
      ctx.closePath();
      ctx.fill();
    };
    corner(22, 22, 1, 1);
    corner(W - 22, 22, -1, 1);
    corner(22, H - 22, 1, -1);
    corner(W - 22, H - 22, -1, -1);

    // 文字：金字，带浮雕感
    const chars = text.split('');
    const n = chars.length;
    const fs = Math.min(104, (W - 120) / Math.max(n, 2));
    ctx.font = `600 ${fs}px "Songti SC", "STSong", "SimSun", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const totalW = fs * n * 1.16;
    const startX = W / 2 - totalW / 2 + (fs * 1.16) / 2;
    for (let i = 0; i < n; i++) {
      const x = startX + i * fs * 1.16;
      const y = H / 2 + 2;
      // 阴刻投影
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(chars[i], x + 2, y + 3);
      // 主体
      const tg = ctx.createLinearGradient(0, y - fs / 2, 0, y + fs / 2);
      tg.addColorStop(0, '#f6e3a6');
      tg.addColorStop(0.5, '#d3a83f');
      tg.addColorStop(1, '#a87f24');
      ctx.fillStyle = tg;
      ctx.fillText(chars[i], x, y);
      // 高光描边
      ctx.strokeStyle = 'rgba(255,240,190,0.35)';
      ctx.lineWidth = 1.2;
      ctx.strokeText(chars[i], x, y);
    }
    return c;
  }

  /* ---------- 云龙御路石雕（阴刻灰度） ---------- */
  function carvedStoneCanvas() {
    const S = 512;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c9c3b4';
    ctx.fillRect(0, 0, S, S);
    // 边框
    ctx.strokeStyle = 'rgba(90,86,76,0.7)';
    ctx.lineWidth = 14;
    ctx.strokeRect(26, 26, S - 52, S - 52);
    ctx.strokeStyle = 'rgba(250,248,240,0.5)';
    ctx.lineWidth = 5;
    ctx.strokeRect(38, 38, S - 76, S - 76);

    // 云纹：同心弧 + 卷涡
    function cloud(cx, cy, r, rot, alpha) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = `rgba(70,66,58,${alpha})`;
      ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, r - i * (r / 5), Math.PI * 0.15, Math.PI * 1.55);
        ctx.stroke();
      }
      // 卷尾
      ctx.beginPath();
      ctx.arc(r * 0.55, -r * 0.55, r * 0.28, 0, Math.PI * 1.7);
      ctx.stroke();
      // 高光
      ctx.strokeStyle = `rgba(255,253,246,${alpha * 0.8})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, r - i * (r / 5) - 3, Math.PI * 0.2, Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (let i = 0; i < 22; i++) {
      const x = 70 + Math.random() * (S - 140);
      const y = 70 + Math.random() * (S - 140);
      cloud(x, y, 26 + Math.random() * 30, Math.random() * Math.PI * 2, 0.35 + Math.random() * 0.3);
    }

    // 中央龙形（简化为盘旋的 S 形脊线 + 鳞片）
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.strokeStyle = 'rgba(58,54,46,0.62)';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-40, 120);
    ctx.bezierCurveTo(-130, 40, 40, -20, -10, -110);
    ctx.bezierCurveTo(-50, -180, 110, -150, 120, -70);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(252,250,242,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-40, 120);
    ctx.bezierCurveTo(-130, 40, 40, -20, -10, -110);
    ctx.bezierCurveTo(-50, -180, 110, -150, 120, -70);
    ctx.stroke();
    // 鳞
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const x = -40 + Math.sin(t * 7) * 70;
      const y = 120 - t * 240;
      ctx.strokeStyle = 'rgba(70,66,58,0.4)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    // 龙首
    ctx.fillStyle = 'rgba(58,54,46,0.5)';
    ctx.beginPath();
    ctx.ellipse(118, -66, 30, 21, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    grain(ctx, S, S, 14);
    return c;
  }

  /* ---------- 绿琉璃瓦（次要建筑 / 剪边） ---------- */
  function tileGreenCanvas() {
    const S = 256;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#28402f';
    ctx.fillRect(0, 0, S, S);
    const n = 8, w = S / n;
    for (let i = 0; i < n; i++) {
      const lg = ctx.createLinearGradient(i * w, 0, i * w + w, 0);
      lg.addColorStop(0, 'rgba(10,22,15,0.55)');
      lg.addColorStop(0.36, 'rgba(126,178,138,0.30)');
      lg.addColorStop(0.72, 'rgba(24,44,32,0.18)');
      lg.addColorStop(1, 'rgba(8,18,12,0.55)');
      ctx.fillStyle = lg;
      ctx.fillRect(i * w, 0, w, S);
    }
    grain(ctx, S, S, 12);
    return c;
  }

  /* ---------- 蓝琉璃瓦（天坛祈年殿 / 皇穹宇 / 坛门） ----------
     与黄琉璃同一套瓦垄结构，只换釉色。天坛蓝不是纯蓝，釉里带一点
     青灰；高光偏冷白，垄沟压到近黑的靛蓝，远看才不会糊成一块塑料。 */
  function tileBlueCanvas() {
    const S = 512;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, '#123050');
    g.addColorStop(0.5, '#1f4d7c');
    g.addColorStop(1, '#123050');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    const n = 8;
    const w = S / n;
    for (let i = 0; i < n; i++) {
      const x = i * w;
      const lg = ctx.createLinearGradient(x, 0, x + w, 0);
      lg.addColorStop(0.0, 'rgba(4,14,28,0.5)');
      lg.addColorStop(0.18, 'rgba(22,56,94,0.10)');
      lg.addColorStop(0.36, 'rgba(150,192,232,0.34)');
      lg.addColorStop(0.52, 'rgba(82,132,184,0.14)');
      lg.addColorStop(0.74, 'rgba(14,40,72,0.14)');
      lg.addColorStop(1.0, 'rgba(3,12,26,0.5)');
      ctx.fillStyle = lg;
      ctx.fillRect(x, 0, w, S);
    }
    /* 瓦口横缝：与黄琉璃同节奏，近看才有"一片一片瓦" */
    const rows = 16;
    for (let r = 1; r < rows; r++) {
      const y = Math.round((r * S) / rows);
      ctx.fillStyle = 'rgba(6,18,34,0.30)';
      ctx.fillRect(0, y, S, 2);
      ctx.fillStyle = 'rgba(190,222,250,0.14)';
      ctx.fillRect(0, y - 1, S, 1);
    }
    /* 釉面斑驳：冷色高光 + 靛色暗点 */
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const v = Math.random();
      ctx.fillStyle = v > 0.5
        ? `rgba(188,220,250,${0.02 + Math.random() * 0.05})`
        : `rgba(4,14,30,${0.03 + Math.random() * 0.06})`;
      ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 6);
    }
    grain(ctx, S, S, 12);
    return c;
  }

  /* ---------- 汉白玉 / 花岗岩台基 ---------- */
  function stoneCanvas() {
    const S = 256;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c8c2b1';
    ctx.fillRect(0, 0, S, S);
    // 石缝
    ctx.strokeStyle = 'rgba(126,120,106,0.55)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y <= S; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(S, y);
      ctx.stroke();
    }
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 0 : 64;
      for (let x = off; x <= S; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, row * 64);
        ctx.lineTo(x, row * 64 + 64);
        ctx.stroke();
      }
    }
    // 石面斑纹 + 风化
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const v = 150 + Math.random() * 90;
      ctx.fillStyle = `rgba(${v},${v - 6},${v - 20},${0.07 + Math.random() * 0.13})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // 大面积水渍 / 风化
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 12 + Math.random() * 34;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, `rgba(126,120,104,${0.05 + Math.random() * 0.06})`);
      gg.addColorStop(1, 'rgba(126,120,104,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    grain(ctx, S, S, 10);
    return c;
  }

  /* ---------- 广场铺地砖 ---------- */
  function pavingCanvas() {
    const S = 512;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8e8779';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) {
      for (let x = 0; x < S; x += 32) {
        const v = 0.78 + Math.random() * 0.34;
        ctx.fillStyle = `rgba(${Math.floor(158 * v)},${Math.floor(151 * v)},${Math.floor(136 * v)},1)`;
        ctx.fillRect(x + 0.7, y + 0.7, 30.6, 30.6);
      }
    }
    // 大尺度污渍，打散规则的网格感
    for (let i = 0; i < 34; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 16 + Math.random() * 46;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() > 0.45;
      gg.addColorStop(0, dark ? 'rgba(96,90,78,0.14)' : 'rgba(190,184,170,0.10)');
      gg.addColorStop(1, 'rgba(120,114,100,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(96,90,80,0.42)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= S; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(S, y);
      ctx.stroke();
    }
    for (let x = 0; x <= S; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, S);
      ctx.stroke();
    }
    grain(ctx, S, S, 14);
    return c;
  }

  /* ---------- 宫墙（朱红抹灰 + 底部城砖） ---------- */
  function wallCanvas() {
    const S = 512;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#8f382b');
    g.addColorStop(0.55, '#7f2c21');
    g.addColorStop(1, '#6e2419');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // 竖向抹灰纹理
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * S;
      ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? 255 : 90},${Math.random() > 0.5 ? 190 : 40},${Math.random() > 0.5 ? 150 : 30},${0.02 + Math.random() * 0.045})`;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 6, S);
      ctx.stroke();
    }
    // 底部砖石勒脚
    ctx.fillStyle = 'rgba(96,92,84,0.85)';
    ctx.fillRect(0, S * 0.86, S, S * 0.14);
    ctx.strokeStyle = 'rgba(80,78,70,0.4)';
    for (let y = S * 0.86; y < S; y += 12) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
    grain(ctx, S, S, 16);
    return c;
  }

  /* ---------- 隔扇门窗（三交六椀菱花格心） ----------
     三交六椀是明清宫殿最高等级的门窗棂花：三组平行棂条互成 60° 交叉，
     交点处结成六瓣菱花。之前画的是菱形网格，远看像纱窗；
     真正的辨识点是那些六瓣花，所以必须把花画出来。 */
  function latticeCanvas() {
    const S = 512;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7d2715';
    ctx.fillRect(0, 0, S, S);
    const unit = 128;                       // 每扇隔扇一个单元
    const step = 21;                        // 棂条间距
    for (let ux = 0; ux < S; ux += unit) {
      /* 边框（大边） */
      ctx.strokeStyle = '#a13a1d';
      ctx.lineWidth = 9;
      ctx.strokeRect(ux + 4.5, 4.5, unit - 9, S - 9);

      const gx = ux + 15, gy = 18, gw = unit - 30, gh = S * 0.60;

      /* 格心：深色窗纸底 */
      ctx.fillStyle = '#5e1f10';
      ctx.fillRect(gx, gy, gw, gh);

      /* 三组棂条：0° / 60° / 120° */
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();
      ctx.strokeStyle = 'rgba(206,158,66,0.92)';
      ctx.lineWidth = 2.4;
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        const dx = Math.cos(a), dy = Math.sin(a);
        const span = gw + gh;
        for (let d = -span; d <= span; d += step) {
          const cx = gx + gw / 2 + dx * d - dy * span;
          const cy = gy + gh / 2 + dy * d + dx * span;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dx * span * 2, cy + dy * span * 2);
          ctx.stroke();
        }
      }
      /* 交点处的六瓣菱花：三角形格点 */
      const rowH = step * 0.866;
      for (let j = -1; j * rowH < gh + rowH; j++) {
        for (let i = -1; i * step < gw + step; i++) {
          const px = gx + i * step + (j % 2 ? step / 2 : 0);
          const py = gy + j * rowH;
          if (px < gx - 4 || px > gx + gw + 4 || py < gy - 4 || py > gy + gh + 4) continue;
          /* 花瓣 */
          ctx.strokeStyle = 'rgba(232,190,104,0.95)';
          ctx.lineWidth = 1.9;
          for (let p = 0; p < 6; p++) {
            const pa = (p * Math.PI) / 3 + 0.3;
            ctx.beginPath();
            ctx.arc(px + Math.cos(pa) * 4.2, py + Math.sin(pa) * 4.2, 2.6, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(240,206,130,0.9)';
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      /* 格心外框 */
      ctx.strokeStyle = 'rgba(224,182,92,0.95)';
      ctx.lineWidth = 5;
      ctx.strokeRect(gx, gy, gw, gh);

      /* 裙板与绦环板 */
      const sy = gy + gh + 14;
      ctx.fillStyle = '#93331c';
      ctx.fillRect(gx, sy, gw, S - sy - 16);
      ctx.strokeStyle = 'rgba(226,186,96,0.62)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(gx + 7, sy + 7, gw - 14, S - sy - 30);
      /* 裙板上的如意云头 */
      ctx.strokeStyle = 'rgba(232,194,110,0.5)';
      ctx.lineWidth = 2;
      const cy2 = sy + (S - sy) / 2;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(gx + gw / 2 + sgn * 14, cy2, 9, 0.2, Math.PI * 1.5);
        ctx.stroke();
      }
    }
    grain(ctx, S, S, 9);
    return c;
  }

  /* ---------- 和玺彩画（三大殿等级：金龙枋心 + 沥粉贴金） ----------
     与旋子彩画的区别不在颜色，在线路：和玺的枋心两端是 Σ 形圭线光，
     枋心内画金龙，箍头、藻头通体贴金。远看是"一条金线压着青绿"，
     这正是三大殿与东西六宫檐下的等级差。 */
  function caihuaHexiCanvas() {
    const S = 512, H = 128;
    const c = cv(S, H);
    const ctx = c.getContext('2d');
    /* 青绿相间：枋心青、藻头绿 */
    ctx.fillStyle = '#17435f';
    ctx.fillRect(0, 0, S, H);
    const seg = S / 2;
    for (let s = 0; s < 2; s++) {
      const x0 = s * seg;
      /* 藻头（绿） */
      ctx.fillStyle = s % 2 ? '#1a4a44' : '#1c5a52';
      ctx.fillRect(x0 + 18, 6, seg - 36, H - 12);
      /* 枋心（青） */
      const fx = x0 + seg * 0.30, fw = seg * 0.40;
      ctx.fillStyle = '#123a58';
      ctx.fillRect(fx, H * 0.26, fw, H * 0.48);

      /* 圭线光：枋心两端的 Σ 形金线 */
      ctx.strokeStyle = '#d9b25e';
      ctx.lineWidth = 3.4;
      for (const sgn of [-1, 1]) {
        const gx = sgn < 0 ? fx : fx + fw;
        ctx.beginPath();
        ctx.moveTo(gx, H * 0.26);
        ctx.lineTo(gx + sgn * 9, H * 0.40);
        ctx.lineTo(gx, H * 0.50);
        ctx.lineTo(gx + sgn * 9, H * 0.60);
        ctx.lineTo(gx, H * 0.74);
        ctx.stroke();
      }

      /* 枋心金龙：盘曲的 S 形躯干 + 鳞 + 首 */
      const dx = fx + fw / 2;
      ctx.strokeStyle = 'rgba(226,188,96,0.95)';
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(dx - fw * 0.26, H * 0.62);
      ctx.bezierCurveTo(dx - fw * 0.06, H * 0.34, dx + fw * 0.14, H * 0.66, dx + fw * 0.28, H * 0.40);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 7; i++) {
        const t = i / 7;
        const px = dx - fw * 0.24 + t * fw * 0.5;
        const py = H * 0.56 - Math.sin(t * Math.PI * 1.6) * H * 0.12;
        ctx.beginPath();
        ctx.arc(px, py, 3.1, 0.3, Math.PI - 0.3);
        ctx.stroke();
      }
      /* 龙首 */
      ctx.fillStyle = 'rgba(232,198,110,0.95)';
      ctx.beginPath();
      ctx.ellipse(dx + fw * 0.28, H * 0.38, 7, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();

      /* 藻头：西番莲卷草 */
      ctx.strokeStyle = 'rgba(214,178,84,0.8)';
      ctx.lineWidth = 2.2;
      for (const sgn of [-1, 1]) {
        const cx = x0 + seg / 2 + sgn * seg * 0.30;
        ctx.beginPath();
        ctx.arc(cx, H / 2, H * 0.14, 0.4, Math.PI * 1.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - sgn * 5, H / 2 + 3, H * 0.07, 1.4, Math.PI * 2.5);
        ctx.stroke();
      }

      /* 箍头：两端金带 + 退晕 */
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(x0, 0, 9, H);
      ctx.fillRect(x0 + seg - 9, 0, 9, H);
      ctx.fillStyle = 'rgba(120,190,190,0.30)';
      ctx.fillRect(x0 + 9, 0, 5, H);
      ctx.fillRect(x0 + seg - 14, 0, 5, H);
    }
    /* 上下边 */
    ctx.fillStyle = '#0e2a3d';
    ctx.fillRect(0, 0, S, 6);
    ctx.fillRect(0, H - 6, S, 6);
    grain(ctx, S, H, 8);
    return c;
  }

  /* ---------- 檐下彩画（青绿叠晕 + 沥粉贴金） ---------- */
  function caihuaCanvas() {
    const S = 256, H = 64;
    const c = cv(S, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1d4a63';
    ctx.fillRect(0, 0, S, H);
    // 分段
    const seg = 64;
    for (let x = 0; x < S; x += seg) {
      ctx.fillStyle = x % (seg * 2) === 0 ? '#1b5570' : '#1d4a63';
      ctx.fillRect(x, 0, seg, H);
      // 箍头
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(x, 0, 5, H);
      ctx.fillRect(x + seg - 5, 0, 5, H);
      // 枋心
      ctx.fillStyle = '#123b52';
      ctx.fillRect(x + 12, H * 0.28, seg - 24, H * 0.44);
      // 金色涡卷
      ctx.strokeStyle = 'rgba(214,178,80,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x + seg / 2, H / 2, H * 0.16, 0.3, Math.PI * 1.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + seg / 2 - 8, H / 2 + 2, H * 0.09, 1.2, Math.PI * 2.4);
      ctx.stroke();
      // 退晕
      ctx.strokeStyle = 'rgba(120,190,190,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 8, H * 0.18, seg - 16, H * 0.64);
    }
    // 上下边
    ctx.fillStyle = '#0f2c3d';
    ctx.fillRect(0, 0, S, 4);
    ctx.fillRect(0, H - 4, S, 4);
    grain(ctx, S, H, 10);
    return c;
  }

  /* ---------- 斗拱层（小块阵列） ---------- */
  function dougongCanvas() {
    const S = 128, H = 64;
    const c = cv(S, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#123c50';
    ctx.fillRect(0, 0, S, H);
    const step = 16;
    for (let x = 0; x < S; x += step) {
      // 斗
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(x + 3, H * 0.22, step - 6, H * 0.2);
      // 拱
      ctx.fillStyle = '#2a7a7a';
      ctx.fillRect(x + 1, H * 0.5, step - 2, H * 0.22);
      ctx.fillStyle = 'rgba(220,190,110,0.9)';
      ctx.fillRect(x + 1, H * 0.5, step - 2, 3);
      // 昂
      ctx.fillStyle = '#d8c07a';
      ctx.fillRect(x + step / 2 - 2, H * 0.68, 4, H * 0.26);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, H - 5, S, 5);
    grain(ctx, S, H, 10);
    return c;
  }

  /* ---------- 屋顶椽子（檐底，整体压暗，读作檐口暗部） ---------- */
  function rafterCanvas() {
    const S = 128;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2e2118';
    ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 16) {
      ctx.fillStyle = x % 32 === 0 ? 'rgba(118,64,38,0.55)' : 'rgba(40,68,58,0.55)';
      ctx.fillRect(x + 2, 0, 12, S);
    }
    // 檐下阴影：上深下浅（压得太黑会变成一条纯黑带，只留三分暗）
    const sg = ctx.createLinearGradient(0, 0, 0, S);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)');
    sg.addColorStop(0.55, 'rgba(0,0,0,0.24)');
    sg.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, S, S);
    grain(ctx, S, S, 8);
    return c;
  }

  /* ---------- 城外土地 / 草地 ---------- */
  function groundCanvas() {
    const S = 256;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5c6046';
    ctx.fillRect(0, 0, S, S);
    // 大块地表色彩变化（土黄 / 草绿 / 灰褐）
    const palette = ['#6b6a4c', '#565c40', '#6f6550', '#4c5238', '#77704f'];
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 12 + Math.random() * 52;
      const col = palette[Math.floor(Math.random() * palette.length)];
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, col + 'cc');
      gg.addColorStop(1, col + '00');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 细颗粒
    for (let i = 0; i < 4200; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const v = 0.6 + Math.random() * 0.8;
      ctx.fillStyle = `rgba(${Math.floor(104 * v)},${Math.floor(108 * v)},${Math.floor(74 * v)},0.45)`;
      ctx.fillRect(x, y, 2, 2);
    }
    grain(ctx, S, S, 18);
    return c;
  }

  /* ---------- 宫苑草地（御花园 / 慈宁宫花园 / 乾隆花园） ---------- */
  function grassCanvas() {
    const S = 256;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4c6a37';
    ctx.fillRect(0, 0, S, S);
    // 大块明暗：草坡的阴阳面与补播痕迹
    const palette = ['#587a41', '#46622f', '#62864a', '#3d5a2b', '#6d8b51'];
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 12 + Math.random() * 50;
      const col = palette[Math.floor(Math.random() * palette.length)];
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, col + 'cc');
      gg.addColorStop(1, col + '00');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 草叶笔触：竖直短亮线
    ctx.lineWidth = 1;
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const l = 1.1 + Math.random() * 2.4;
      const v = 0.65 + Math.random() * 0.7;
      ctx.strokeStyle = `rgba(${Math.floor(150 * v)},${Math.floor(178 * v)},${Math.floor(96 * v)},0.5)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 0.8, y - l);
      ctx.stroke();
    }
    // 细颗粒
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      ctx.fillStyle = `rgba(${60 + Math.floor(Math.random() * 40)},${86 + Math.floor(Math.random() * 40)},${42 + Math.floor(Math.random() * 30)},0.4)`;
      ctx.fillRect(x, y, 2, 2);
    }
    grain(ctx, S, S, 16);
    return c;
  }

  /* ---------- 灰筒瓦（胡同四合院 / 城墙顶） ----------
     与黄琉璃同一套瓦垄逻辑，但瓦垄更密、更哑光。
     远景四合院只有 1 个 InstancedMesh，全部质感都压在这张图上。 */
  function tileGrayCanvas() {
    const S = 512;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#64645e';
    ctx.fillRect(0, 0, S, S);
    const n = 12;
    const w = S / n;
    for (let i = 0; i < n; i++) {
      const x = i * w;
      const lg = ctx.createLinearGradient(x, 0, x + w, 0);
      lg.addColorStop(0.0, 'rgba(38,38,36,0.42)');
      lg.addColorStop(0.16, 'rgba(96,96,90,0.10)');
      lg.addColorStop(0.34, 'rgba(186,186,176,0.26)');
      lg.addColorStop(0.52, 'rgba(146,146,138,0.10)');
      lg.addColorStop(0.78, 'rgba(64,64,60,0.16)');
      lg.addColorStop(1.0, 'rgba(32,32,30,0.42)');
      ctx.fillStyle = lg;
      ctx.fillRect(x, 0, w, S);
    }
    /* 瓦口横缝：每 32 px 一道，缝下压暗、缝上留高光 */
    for (let y = 0; y < S; y += 32) {
      ctx.fillStyle = 'rgba(34,34,32,0.30)';
      ctx.fillRect(0, y, S, 2);
      ctx.fillStyle = 'rgba(210,210,200,0.12)';
      ctx.fillRect(0, y - 1, S, 1);
    }
    /* 苔痕 / 雨渍：灰瓦比琉璃脏，斑驳是它的辨识度 */
    for (let i = 0; i < 320; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const green = Math.random() > 0.72;
      ctx.fillStyle = green
        ? `rgba(84,96,68,${0.04 + Math.random() * 0.09})`
        : `rgba(${Math.random() > 0.5 ? 30 : 190},${Math.random() > 0.5 ? 30 : 190},${Math.random() > 0.5 ? 28 : 180},${0.02 + Math.random() * 0.05})`;
      ctx.fillRect(x, y, 1 + Math.random() * 5, 1 + Math.random() * 3);
    }
    grain(ctx, S, S, 10);
    return c;
  }

  /* ---------- 灰砖墙（四合院院墙 / 影壁 / 城墙） ---------- */
  function brickGrayCanvas() {
    const S = 512;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8a8880';
    ctx.fillRect(0, 0, S, S);
    const bh = 26, bw = 64;
    for (let row = 0; row * bh < S; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < S + bw; x += bw) {
        const v = 0.86 + Math.random() * 0.26;
        ctx.fillStyle = `rgb(${Math.floor(150 * v)},${Math.floor(147 * v)},${Math.floor(138 * v)})`;
        ctx.fillRect(x + off + 1, row * bh + 1, bw - 2, bh - 2);
        /* 砖面斑驳 */
        if (Math.random() > 0.72) {
          ctx.fillStyle = `rgba(90,88,82,${0.06 + Math.random() * 0.10})`;
          ctx.fillRect(x + off + 4 + Math.random() * 30, row * bh + 3 + Math.random() * 12,
            8 + Math.random() * 20, 3 + Math.random() * 8);
        }
      }
    }
    /* 灰缝 */
    ctx.strokeStyle = 'rgba(96,94,88,0.5)';
    ctx.lineWidth = 1.6;
    for (let row = 0; row * bh <= S; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * bh);
      ctx.lineTo(S, row * bh);
      ctx.stroke();
    }
    grain(ctx, S, S, 12);
    return c;
  }

  /* ---------- 灰瓦凹凸（灰度，线性空间） ---------- */
  function tileGrayBumpCanvas() {
    const S = 256;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, S, S);
    const n = 12, w = S / n;
    for (let i = 0; i < n; i++) {
      const lg = ctx.createLinearGradient(i * w, 0, i * w + w, 0);
      lg.addColorStop(0, '#2e2e2e');
      lg.addColorStop(0.34, '#f0f0f0');
      lg.addColorStop(0.5, '#f8f8f8');
      lg.addColorStop(0.82, '#565656');
      lg.addColorStop(1, '#2e2e2e');
      ctx.fillStyle = lg;
      ctx.fillRect(i * w, 0, w, S);
    }
    return c;
  }


  /* ---------- 灯晕（径向白心渐变，加法混合用） ---------- */
  function glowCanvas() {
    const S = 128;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,238,208,0.78)');
    g.addColorStop(0.42, 'rgba(255,190,120,0.30)');
    g.addColorStop(0.72, 'rgba(255,150,70,0.08)');
    g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return c;
  }

  /* ---------- 殿内底景（从门口望进去） ----------
     太和殿的门是敞着的，从广场望进去能看见宝座与金柱。模型没有内部
     空间（屋身是实心盒），这里画一张"透视底景"贴在门洞上：暗部、
     地平床、宝座、屏风、蟠龙金柱与藻井。远看是"里面有东西"，
     近看是一幅画 —— 比一块纯黑的板子接近实物。 */
  function interiorCanvas() {
    const W = 768, H = 320;
    const c = cv(W, H);
    const ctx = c.getContext('2d');
    /* 一点透视：灭点在画幅中心偏上，远墙是一个矩形 */
    const vx = W / 2, vy = H * 0.54;
    const bw = W * 0.20, bh = H * 0.30;          // 远墙半宽 / 半高
    const L = vx - bw, R = vx + bw, T = vy - bh, B = vy + bh;

    ctx.fillStyle = '#0b0604';
    ctx.fillRect(0, 0, W, H);

    /* 地面：从画幅下缘收向远墙底边 */
    const fg = ctx.createLinearGradient(0, H, 0, B);
    fg.addColorStop(0, '#2a1c10');
    fg.addColorStop(1, '#120b06');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(R, B); ctx.lineTo(L, B);
    ctx.closePath(); ctx.fill();
    /* 金砖缝：向灭点收敛的线 */
    ctx.strokeStyle = 'rgba(150,112,58,0.16)';
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(vx + i * (W / 12), H);
      ctx.lineTo(vx + i * bw * 0.34, B);
      ctx.stroke();
    }

    /* 天花：从画幅上缘收向远墙顶边，中央是藻井 */
    ctx.fillStyle = '#150c07';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(R, T); ctx.lineTo(L, T);
    ctx.closePath(); ctx.fill();
    for (let i = 3; i >= 0; i--) {
      ctx.strokeStyle = `rgba(196,156,74,${0.10 + i * 0.05})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(vx, T + 6, 96 - i * 15, 34 - i * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* 两侧墙：暗红，压得最黑 */
    for (const sgn of [-1, 1]) {
      const ex = sgn < 0 ? 0 : W;
      const ix = sgn < 0 ? L : R;
      ctx.fillStyle = sgn < 0 ? '#1c0d07' : '#180b06';
      ctx.beginPath();
      ctx.moveTo(ex, 0); ctx.lineTo(ix, T); ctx.lineTo(ix, B); ctx.lineTo(ex, H);
      ctx.closePath(); ctx.fill();
    }

    /* 远墙：屏风 + 宝座 */
    ctx.fillStyle = '#2a1109';
    ctx.fillRect(L, T, R - L, B - T);
    ctx.strokeStyle = 'rgba(196,152,70,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(L + 2, T + 2, R - L - 4, B - T - 4);

    /* 屏风 */
    const sw = (R - L) * 0.62, sh = (B - T) * 0.62;
    const sx = vx - sw / 2, sy = B - sh - 6;
    ctx.fillStyle = '#3a1209';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = 'rgba(214,172,86,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 3, sy + 3, sw - 6, sh - 6);

    /* 宝座：须弥座 + 靠背 + 扶手 */
    const tw = sw * 0.34, th = sh * 0.52;
    const tx = vx - tw / 2, ty = B - th - 10;
    const tg = ctx.createLinearGradient(0, ty, 0, ty + th);
    tg.addColorStop(0, '#e8c987');
    tg.addColorStop(0.55, '#bd8f2c');
    tg.addColorStop(1, '#6d4d12');
    ctx.fillStyle = tg;
    ctx.fillRect(tx, ty + th * 0.42, tw, th * 0.58);
    ctx.fillRect(vx - tw * 0.3, ty, tw * 0.6, th * 0.5);
    for (const sgn of [-1, 1]) {
      ctx.fillRect(vx + sgn * tw * 0.44 - 2, ty + th * 0.3, 4, th * 0.3);
    }

    /* 两根蟠龙金柱：立在远墙前，比屏风更靠近观者 */
    for (const sgn of [-1, 1]) {
      const px = vx + sgn * (R - L) * 0.62;
      const py = T - 12, ph = (B - T) + 24;
      const g = ctx.createLinearGradient(px - 7, 0, px + 7, 0);
      g.addColorStop(0, 'rgba(96,62,16,0.75)');
      g.addColorStop(0.45, 'rgba(226,186,92,0.9)');
      g.addColorStop(1, 'rgba(88,56,14,0.75)');
      ctx.fillStyle = g;
      ctx.fillRect(px - 7, py, 14, ph);
      ctx.strokeStyle = 'rgba(250,226,160,0.35)';
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.arc(px, py + 20 + k * (ph / 7), 6, 0.3, Math.PI * 1.4);
        ctx.stroke();
      }
    }

    /* 四边压暗：门口的光比殿内亮，边界不能是硬切 */
    const vg = ctx.createLinearGradient(0, 0, W, 0);
    vg.addColorStop(0, 'rgba(0,0,0,0.9)');
    vg.addColorStop(0.18, 'rgba(0,0,0,0.15)');
    vg.addColorStop(0.82, 'rgba(0,0,0,0.15)');
    vg.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    const vg2 = ctx.createLinearGradient(0, 0, 0, H);
    vg2.addColorStop(0, 'rgba(0,0,0,0.55)');
    vg2.addColorStop(0.4, 'rgba(0,0,0,0)');
    vg2.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg2;
    ctx.fillRect(0, 0, W, H);

    grain(ctx, W, H, 7);
    return c;
  }

  /* ---------- 金砖地面（三大殿室内） ---------- */
  function goldBrickCanvas() {
    const S = 128;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6d6656';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(40,36,28,0.5)';
    for (let y = 0; y < S; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
    for (let x = 0; x < S; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }
    grain(ctx, S, S, 20);
    return c;
  }

  let cache = null;
  GG.getPlaque = function (text) {
    if (plaqueCache[text]) return plaqueCache[text];
    const t = tex(plaqueCanvas(text), 1, 1);
    plaqueCache[text] = t;
    return t;
  };

  GG.getTextures = function () {
    if (cache) return cache;
    const bumpTex = new THREE.CanvasTexture(tileBumpCanvas());
    bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.anisotropy = 4;

    const bumpTexG = new THREE.CanvasTexture(tileBumpCanvas());
    bumpTexG.wrapS = bumpTexG.wrapT = THREE.RepeatWrapping;
    bumpTexG.anisotropy = 4;

    /* 灰瓦凹凸：胡同屋面靠它读出瓦垄，近景不能糊 */
    const bumpGray = new THREE.CanvasTexture(tileGrayBumpCanvas());
    bumpGray.wrapS = bumpGray.wrapT = THREE.RepeatWrapping;
    bumpGray.anisotropy = 8;

    cache = {
      tileBump: bumpTex,
      tileBumpGreen: bumpTexG,
      tileBumpGray: bumpGray,
      tile: tex(tileCanvas(), 1, 1),
      tileGray: tex(tileGrayCanvas(), 1, 1),
      brickGray: tex(brickGrayCanvas(), 1, 1),
      tileGreen: tex(tileGreenCanvas(), 1, 1),
      tileBlue: tex(tileBlueCanvas(), 1, 1),
      stone: tex(stoneCanvas(), 1, 1),
      paving: tex(pavingCanvas(), 1, 1),
      wall: tex(wallCanvas(), 1, 1),
      lattice: tex(latticeCanvas(), 1, 1),
      caihua: tex(caihuaCanvas(), 1, 1),
      caihuaHexi: tex(caihuaHexiCanvas(), 1, 1),
      dougong: tex(dougongCanvas(), 1, 1),
      rafter: tex(rafterCanvas(), 1, 1),
      ground: tex(groundCanvas(), 1, 1),
      grass: tex(grassCanvas(), 1, 1),
      goldBrick: tex(goldBrickCanvas(), 1, 1),
      carvedStone: tex(carvedStoneCanvas(), 1, 1),
      shadowBlob: tex(shadowBlobCanvas(), 1, 1),
      glow: tex(glowCanvas(), 1, 1),
      interior: tex(interiorCanvas(), 1, 1)
    };
    return cache;
  };
})();
