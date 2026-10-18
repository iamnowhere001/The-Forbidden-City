/* ============================================================
   全局配置
   颜色、光照、雾、标签阈值、机位表、屋顶曲率集中在这里。
   改场景基调只需要动这个文件，不必翻 app.js。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  GG.CONFIG = {
    /* ---------- 渲染质量（低端机降级时改这里） ---------- */
    quality: {
      pixelRatioCap: 1.9,
      shadowMapSize: 4096,
      shadowCamera: { left: -760, right: 760, top: 820, bottom: -820, near: 120, far: 2400 },
      shadowBias: -0.0004,
      shadowNormalBias: 0.05
    },

    camera: {
      fov: 45,
      near: 0.8,
      far: 8000,
      start: [0, 1400, 1900]
    },

    fog: {
      color: 0xc3cdd8,
      density: 0.00026
    },

    /* ---------- 曝光：base + k * gain，k 为太阳高度系数 ---------- */
    exposure: { base: 0.82, sunGain: 0.06 },

    /* ---------- 日照：t = 0 日出，0.5 正午，1 日落 ---------- */
    sun: {
      elevationBase: 5,
      elevationGain: 62,
      azimuthStart: -78,
      azimuthSweep: 156,
      distance: [700, 760, 700],
      intensityBase: 1.0,
      intensityGain: 0.9,
      ambientBase: 0.18,
      ambientFall: 0.12,
      hemiBase: 0.30,
      hemiFall: 0.14,
      cloudBase: 0.72,
      cloudGain: 0.2,
      defaultT: 0.5
    },

    timePresets: { dawn: 0.14, noon: 0.5, dusk: 0.88 },

    /* ---------- 天空与雾的配色 ---------- */
    colors: {
      sunLow: 0xff9a4e,
      sunHigh: 0xfffaf0,
      skyTopLow: 0x38496c,
      skyTopHigh: 0x4274ad,
      skyBottomLow: 0xe0a687,
      skyBottomHigh: 0xd2e2ef,
      ambientLow: 0xd8bda6,
      ambientHigh: 0xcddced,
      fogTint: 0xb9c4d1,
      fogTintAmount: 0.55,
      hazeWhite: 0xffffff,
      hazeAmount: 0.08,
      /* 着色器初始值，setSun 会在首帧覆盖 */
      skyInitial: { top: 0x2f6fbe, bottom: 0xd8e6f2, haze: 0xc3cdd8, sun: 0xfff4de },
      /* 程序化环境贴图的三段色 */
      envSky: { top: 0x6fa8d8, bottom: 0xe8e2d2, ground: 0x8f8878 }
    },

    /* ---------- 标签阈值（远距离过滤 / 避让 / 缩放） ---------- */
    label: {
      defaultY: 20,
      priorityCenterX: 2,
      farLimitBase: 340,
      farLimitFactor: 0.82,
      farLimitPrio2Factor: 0.55,
      maxDistance: 1500,
      scaleRef: 260,
      scaleMin: 0.62,
      scaleMax: 1.05,
      opacityBase: 1.25,
      opacityRange: 900,
      opacityMin: 0.35,
      opacityMax: 0.92,
      rectTopPad: 6,
      updateEvery: 2
    },

    /* ---------- 轨道控制器 ---------- */
    orbit: {
      target: [0, 10, 40],
      phi: 1.0,
      radius: 900,
      damp: 0.12,
      minR: 26,
      maxR: 1700,
      minPhi: 0.08,
      maxPhi: 1.47,
      panBounds: { x: 460, z: 560, yMin: -10, yMax: 140 },
      /* init 时的临时机位：在飞向全景之前先把镜头放到远处 */
      boot: { target: [0, 6, 40], radius: 2200, phi: 0.95 }
    },

    /* ---------- 拾取高亮与地面光圈 ---------- */
    highlight: { emissive: 0x6a4a12, intensity: 0.5 },
    ring: { color: 0xe8c15a, inner: 0.86, outer: 1.0, radiusFactor: 1.15 },

    /* ---------- 屋顶形制（米制，参数含义见 geo.js） ---------- */
    roof: {
      curv: 1.55,        // 举折曲率：越大屋面越凹
      liftRatio: 0.024,  // 翼角起翘 = min(hw, hd) * ratio
      hipTopFactor: 0.76 // 庑殿推山：topX = hw - hd * factor
    },

    /* ---------- 机位表（单一数据源：按钮、键位、URL 都从这里生成） ----------
       p = 相机位置 [x,y,z]，t = 注视点。
       hidden: 不生成按钮，但仍可用 ?view=xxx 直达。
       键位说明：8/9 沿用 v0.9 的约定（东南角是后加的机位，键位排在俯瞰之后），
       与按钮显示顺序不一致，属有意保留。 */
    views: [
      { id: 'overview', label: '全景', labelEn: 'Overview', name: '全景', key: '1', p: [0, 520, 950], t: [0, 4, 10] },
      { id: 'axis', label: '中轴', labelEn: 'Axis', name: '中轴', key: '2', p: [0, 88, 596], t: [0, 44, 120] },
      { id: 'taihe', label: '广场', labelEn: 'Square', name: '太和殿广场', key: '3', p: [0, 78, 452], t: [0, 18, 150] },
      { id: 'close', label: '太和殿', labelEn: 'Hall', name: '太和殿', key: '4', p: [0, 48, 254], t: [0, 30, 148] },
      { id: 'detail', label: '细部', labelEn: 'Detail', name: '细部', p: [26, 26, 214], t: [0, 22, 152], hidden: true },
      { id: 'inner', label: '后三宫', labelEn: 'Inner Court', name: '后三宫', key: '5', p: [0, 96, -78], t: [0, 14, -242] },
      { id: 'garden', label: '御花园', labelEn: 'Garden', name: '御花园', key: '6', p: [0, 62, -276], t: [0, 10, -414] },
      { id: 'shenwu', label: '神武门', labelEn: 'North Gate', name: '神武门', key: '7', p: [150, 74, -252], t: [-6, 24, -452] },
      { id: 'corner', label: '东南角', labelEn: 'Corner', name: '东南角', key: '9', p: [556, 300, 622], t: [-30, 14, 116] },
      { id: 'top', label: '俯瞰', labelEn: 'Top', name: '俯瞰', key: '8', p: [0, 980, 150], t: [0, 0, 16] }
    ]
  };
})();
