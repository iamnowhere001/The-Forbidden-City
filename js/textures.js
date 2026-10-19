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
    t.anisotropy = 8;
    return t;
  }

  /* ---------- 黄琉璃瓦（筒瓦垄） ---------- */
  function tileCanvas() {
    const S = 256;
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
      lg.addColorStop(0.0, 'rgba(104,72,12,0.26)');  // 垄沟
      lg.addColorStop(0.18, 'rgba(160,120,30,0.06)');
      lg.addColorStop(0.36, 'rgba(255,244,196,0.40)');// 高光
      lg.addColorStop(0.52, 'rgba(238,204,110,0.12)');
      lg.addColorStop(0.74, 'rgba(150,104,26,0.10)');
      lg.addColorStop(1.0, 'rgba(86,58,10,0.26)');
      ctx.fillStyle = lg;
      ctx.fillRect(x, 0, w, S);
    }
    // 琉璃釉面细微斑驳
    for (let i = 0; i < 260; i++) {
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
    const S = 256;
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
    const S = 256;
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

  /* ---------- 隔扇门窗（菱花格心） ---------- */
  function latticeCanvas() {
    const S = 256;
    const c = cv(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8a2c17';
    ctx.fillRect(0, 0, S, S);
    // 每扇门一个单元
    const unit = 128;
    for (let ux = 0; ux < S; ux += unit) {
      // 边框
      ctx.strokeStyle = '#a13a1d';
      ctx.lineWidth = 8;
      ctx.strokeRect(ux + 4, 4, unit - 8, S - 8);
      // 格心区域（菱花：暖红底 + 金线）
      const gx = ux + 14, gy = 18, gw = unit - 28, gh = S * 0.62;
      ctx.fillStyle = '#6d2313';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = 'rgba(214,168,74,0.8)';
      ctx.lineWidth = 2;
      const step = 12;
      for (let d = -gh; d < gw + gh; d += step) {
        ctx.beginPath(); ctx.moveTo(gx + d, gy); ctx.lineTo(gx + d - gh, gy + gh); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(gx + d, gy); ctx.lineTo(gx + d + gh, gy + gh); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(224,182,92,0.95)';
      ctx.lineWidth = 4;
      ctx.strokeRect(gx, gy, gw, gh);
      // 裙板
      ctx.fillStyle = '#9c3720';
      ctx.fillRect(gx, gy + gh + 12, gw, S - (gy + gh) - 26);
      ctx.strokeStyle = 'rgba(226,186,96,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(gx + 6, gy + gh + 18, gw - 12, S - (gy + gh) - 38);
    }
    grain(ctx, S, S, 10);
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
    ctx.fillStyle = '#1a120c';
    ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 16) {
      ctx.fillStyle = x % 32 === 0 ? 'rgba(96,48,30,0.55)' : 'rgba(28,52,46,0.55)';
      ctx.fillRect(x + 2, 0, 12, S);
    }
    // 檐下阴影：上深下浅
    const sg = ctx.createLinearGradient(0, 0, 0, S);
    sg.addColorStop(0, 'rgba(0,0,0,0.75)');
    sg.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    sg.addColorStop(1, 'rgba(0,0,0,0.12)');
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

    cache = {
      tileBump: bumpTex,
      tileBumpGreen: bumpTexG,
      tile: tex(tileCanvas(), 1, 1),
      tileGreen: tex(tileGreenCanvas(), 1, 1),
      stone: tex(stoneCanvas(), 1, 1),
      paving: tex(pavingCanvas(), 1, 1),
      wall: tex(wallCanvas(), 1, 1),
      lattice: tex(latticeCanvas(), 1, 1),
      caihua: tex(caihuaCanvas(), 1, 1),
      dougong: tex(dougongCanvas(), 1, 1),
      rafter: tex(rafterCanvas(), 1, 1),
      ground: tex(groundCanvas(), 1, 1),
      grass: tex(grassCanvas(), 1, 1),
      goldBrick: tex(goldBrickCanvas(), 1, 1),
      carvedStone: tex(carvedStoneCanvas(), 1, 1),
      shadowBlob: tex(shadowBlobCanvas(), 1, 1)
    };
    return cache;
  };
})();
