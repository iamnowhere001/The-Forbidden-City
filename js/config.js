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
      pixelRatioCap: 2.0,
      /* 动态分辨率：帧率低于 downFps 逐级降渲染倍率，稳定在 upFps 以上再逐级升回。
         软渲染（截图回归）同样生效，只是 SwiftShader 下降档也救不回来，属预期。
         基准机是 M4，45/57 的阈值定得太保守，轻微抖动就掉档；放到 40/58。 */
      drs: { scales: [1, 0.92, 0.84], downFps: 40, upFps: 58, needGood: 2 },
      shadowMapSize: 8192,
      /* 视锥上界即远景覆盖；实际值按视距在 minExtent…right 之间自适应 */
      shadowCamera: {
        left: -760, right: 760, top: 820, bottom: -820,
        near: 120, far: 2400,
        minExtent: 150, minDistance: 300
      },
      shadowBias: -0.0004,
      shadowNormalBias: 0.05,
      /* 阴影锚点：阴影视锥跟随注视点平移，同样大的阴影图覆盖可视区域，
         远景建筑才有影；偏移超过 anchorEps 米才重定向 */
      shadowDistance: 760,
      shadowAnchorEps: 60
    },

    camera: {
      fov: 45,
      near: 0.8,
      far: 30000,
      start: [0, 2800, 5000]
    },

    fog: {
      color: 0xc3cdd8,
      density: 0.000085
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

    /* ---------- 昼夜：t = 0/1 深夜，0.25 日出，0.5 正午，0.75 日落 ---------- */
    day: {
      sunrise: 0.25,
      sunset: 0.75,
      nightFall: 0.16,          // 太阳高度系数 k 低于此值开始入夜
      skyTop: 0x070c1a,
      skyBottom: 0x121a2c,
      haze: 0x0f141e,
      ambient: 0x1b2436,
      ambientI: 0.11,
      hemiSky: 0x1b2740,
      hemiGround: 0x0b0e13,
      hemiI: 0.13,
      moon: 0xd6e2ff,
      moonI: 0.28,
      exposure: 0.74,
      /* 窗纸与宫灯：夜间自发光，白天归零 */
      windowGlow: 0xffb35c,
      windowEmissive: 0.85,
      lanternGlow: 0xffa23c,
      lanternEmissive: 1.0
    },

    timePresets: { dawn: 0.27, noon: 0.5, dusk: 0.73, night: 0.0 },

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
      updateEvery: 2,
      /* 标注分组跳转的循环顺序，空串 = 全部；按钮 / 键位 / URL 都从这里推导 */
      groups: ['', '前朝', '后寝', '东路', '西路', '城防', '宫外']
    },

    /* ---------- 轨道控制器 ---------- */
    orbit: {
      target: [0, 10, 40],
      phi: 1.0,
      radius: 2400,
      damp: 0.12,
      minR: 26,
      maxR: 11000,
      minPhi: 0.08,
      maxPhi: 1.47,
      panBounds: { x: 4400, z: 4900, yMin: -10, yMax: 260 },
      /* init 时的临时机位：在飞向全景之前先把镜头放到远处 */
      boot: { target: [0, 6, 300], radius: 8200, phi: 0.9 }
    },

    /* ---------- 拾取高亮与地面光圈 ---------- */
    highlight: { emissive: 0x6a4a12, intensity: 0.5 },
    ring: { color: 0xe8c15a, inner: 0.86, outer: 1.0, radiusFactor: 1.15 },

    /* ---------- 屋顶形制（米制，参数含义见 geo.js） ---------- */
    roof: {
      curv: 1.55,        // 举折曲率：越大屋面越凹
      liftRatio: 0.042,  // 翼角起翘 = min(hw, hd) * ratio（0.024 时几乎看不出翘角）
      hipTopFactor: 0.76 // 庑殿推山：topX = hw - hd * factor
    },

    /* ---------- 第一人称漫游 ----------
       碰撞是粗粒度的：注册建筑的包围盒 + 四面宫墙 AABB + 宫城内边界。
       城外胡同是实例化体块，没有逐院碰撞，所以漫游范围只在宫城以内。 */
    fps: {
      eye: 1.7,                 // 人眼高度（米），不做台阶 / 斜坡
      bodyRadius: 0.62,
      walk: 6.2,
      run: 11.5,
      lookSpeed: 0.0022,
      maxPitch: 1.25,
      plaqueEvery: 8,          // 准星拾取节流：每 N 帧一次
      exitDistance: 90,        // 退出时注视点前移距离，供 orbit 反算球坐标
      bounds: { minX: -374, maxX: 374, minZ: -478, maxZ: 478 },
      /* 四面宫墙按整墙阻挡（城门洞不做通行判定），格式 [minX, minZ, maxX, maxZ] */
      walls: [
        [-376, 478.7, 376, 481.3],
        [-376, -481.3, 376, -478.7],
        [374.7, -480, 377.3, 480],
        [-377.3, -480, -374.7, 480]
      ],
      /* 出生点按当前 orbit.target 的 XZ 就近选，撞上建筑就顺延下一个 */
      spawns: [
        { p: [0, 0, 430], yaw: 0 },
        { p: [0, 0, 250], yaw: 0 },
        { p: [0, 0, -160], yaw: Math.PI },
        { p: [-42, 0, -330], yaw: 0 },
        { p: [42, 0, -330], yaw: 0 },
        { p: [-140, 0, -110], yaw: 0 },
        { p: [140, 0, -110], yaw: 0 }
      ]
    },

    /* ---------- 机位表（单一数据源：按钮、键位、URL 都从这里生成） ----------
       p = 相机位置 [x,y,z]，t = 注视点。
       hidden: 不生成按钮，但仍可用 ?view=xxx 直达。
       键位说明：8/9 沿用 v0.9 的约定（东南角是后加的机位，键位排在俯瞰之后），
       与按钮显示顺序不一致，属有意保留。 */
    views: [
      { id: 'capital', label: '京师', labelEn: 'Capital', name: '京师', key: '0', p: [3600, 1500, 5200], t: [0, 0, 400] },
      { id: 'overview', label: '全景', labelEn: 'Overview', name: '全景', key: '1', p: [0, 1300, 2600], t: [0, 0, 200] },
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
