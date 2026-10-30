/* ============================================================
   渲染舞台
   负责 WebGLRenderer、场景、相机、光照、天空、雾与日照插值。
   不关心建筑怎么摆，也不关心 UI。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});
  const V3 = THREE.Vector3;
  const DEG = Math.PI / 180;

  /* 开启色彩管理：hex 颜色按 sRGB 解释、内部转线性。
     否则 r149 默认 legacy 模式会把所有颜色当线性值，画面整体发灰发白。 */
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  function Stage(canvas) {
    const C = GG.CONFIG;
    const col = C.colors;

    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, C.quality.pixelRatioCap));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    /* 阴影按需重绘：阴影视锥与太阳方向都不随相机变化，静止观察时
       每帧重渲一遍全场景投影是纯浪费。autoUpdate 关掉后，只有
       setSun（太阳移动）/ setShadowAnchor（锚点移动）时置 needsUpdate。 */
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    /* 阴影模式按运行环境选：
       软渲染（SwiftShader / llvmpipe）下 PCFSoftShadowMap 不出影，
       截图回归会得到"没有阴影"的假基线，所以自动退回硬边 PCF。
       真机默认用软阴影；?shadow=hard|soft 可强制覆盖。 */
    const gl = renderer.getContext();
    const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuName = dbgInfo ? String(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftware = /swiftshader|llvmpipe|software rasterizer/i.test(gpuName);
    const shadowPref = GG.query.get('shadow');
    const useSoft = shadowPref === 'soft' || (shadowPref !== 'hard' && !isSoftware);
    renderer.shadowMap.type = useSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    GG.debug.shadow = useSoft ? 'soft' : 'hard';
    GG.debug.gpu = gpuName;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(C.fog.color, C.fog.density);

    /* 程序化环境贴图：晨 / 午 / 暮 / 夜四档，按 dayT 切换。
       原来只有昼 / 夜两档，入夜瞬间反射整体跳变；加档后黄昏与黎明
       的材质反射跟上天空（v2.2 取舍项的收尾）。
       注意：每次 PMREM 烘焙会消耗 4 次 Math.random（THREE 的 uuid）。
       昼 / 夜两张在构造器里烘，调用次数与 v2.3 一致，保证 ?seed=1
       的随机流在布局期逐位不变（树与散布的位置才不漂移）；
       晨 / 暮两张在布局完成后由 bakeDawnEnvs 补烘（此后无随机依赖）。 */
    function makeEnv(top, bot, gnd) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const es = new THREE.Scene();
        es.add(new THREE.Mesh(
          new THREE.SphereGeometry(100, 48, 28),
          new THREE.ShaderMaterial({
            uniforms: {
              top: { value: new THREE.Color(top) },
              bot: { value: new THREE.Color(bot) },
              gnd: { value: new THREE.Color(gnd) }
            },
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform vec3 gnd; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(bot, top, pow(h, 0.55)) : mix(bot, gnd, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }',
            side: THREE.BackSide
          })
        ));
        const tex = pmrem.fromScene(es, 0.03).texture;
        pmrem.dispose();
        return tex;
      } catch (e) { return null; }
    }
    const _ct = new THREE.Color();
    const envDay = makeEnv(col.envSky.top, col.envSky.bottom, col.envSky.ground);
    const envNight = makeEnv(0x0d1524, 0x18202f, 0x07090d);
    /* 晨 / 暮初始先指回昼档；bakeDawnEnvs 后替换为各自的暖 / 冷色 */
    const ENV_LIST = [envDay, envDay, envDay, envNight];
    if (envDay) scene.environment = envDay;
    let envIdx = 1;
    this.bakeDawnEnvs = function () {
      if (!envDay) return 0;
      const morning = makeEnv(
        _ct.copy(col.skyTopLow).lerp(col.skyTopHigh, 0.12).getHex(),
        _ct.copy(col.skyBottomLow).lerp(col.skyBottomHigh, 0.14).getHex(),
        0x5d5a50
      );
      const evening = makeEnv(
        _ct.copy(col.skyTopLow).lerp(col.skyTopHigh, 0.08).getHex(),
        _ct.copy(col.skyBottomLow).lerp(col.skyBottomHigh, 0.08).getHex(),
        0x4a4640
      );
      if (morning) ENV_LIST[0] = morning;
      if (evening) ENV_LIST[2] = evening;
      return (morning ? 1 : 0) + (evening ? 1 : 0);
    };

    const camera = new THREE.PerspectiveCamera(
      C.camera.fov, window.innerWidth / window.innerHeight, C.camera.near, C.camera.far
    );
    camera.position.set(C.camera.start[0], C.camera.start[1], C.camera.start[2]);

    /* 天空：渐变 + 日轮 + 程序化云 + 地平线灰霾（单 pass，无额外几何） */
    const sunDirV = new V3(0.3, 0.9, 0.4);
    const sky = GG.createSky(C, sunDirV);
    scene.add(sky.mesh);

    /* 光照 */
    const amb = new THREE.AmbientLight(0xe6edf5, 0.22);
    scene.add(amb);
    const hemi = new THREE.HemisphereLight(0xdfeaf4, 0x8d8570, 0.42);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4de, 2.4);
    sun.position.set(200, 660, 260);
    sun.castShadow = true;
    sun.shadow.mapSize.set(C.quality.shadowMapSize, C.quality.shadowMapSize);
    const sc = sun.shadow.camera;
    const SC = C.quality.shadowCamera;
    sc.left = SC.left; sc.right = SC.right; sc.top = SC.top; sc.bottom = SC.bottom;
    sc.near = SC.near; sc.far = SC.far;
    sc.updateProjectionMatrix();
    sun.shadow.bias = C.quality.shadowBias;
    sun.shadow.normalBias = C.quality.shadowNormalBias;
    scene.add(sun);
    scene.add(sun.target);

    /* 阴影视锥随视距缩放：8192 的阴影图铺满 ±760 m 时，
       一个像素约 0.19 m，屋脊与斗拱的投影边缘是糊的。
       镜头拉近到 60 m 视距时把视锥收到 ±90 m，精度提高八倍，
       近景的檐下阴影、栏杆投影才立得住；拉远再放开。
       只在跨过一档时重设投影并重绘阴影，不逐帧抖。 */
    this._shadowExt = 0;
    this._shadowDist = C.quality.shadowDistance;
    this.fitShadowFrustum = (viewDist) => {
      /* 1.35 倍视距：留出低太阳角下远景高楼的投影落点，
         视锥收得太紧会把 150 m 外的影子切掉 */
      const ext = Math.max(SC.minExtent, Math.min(SC.right, viewDist * 1.35));
      if (this._shadowExt && Math.abs(ext - this._shadowExt) < this._shadowExt * 0.2) return;
      this._shadowExt = ext;
      const ratio = SC.top / SC.right;
      const cam = sun.shadow.camera;
      cam.left = -ext;
      cam.right = ext;
      cam.top = ext * ratio;
      cam.bottom = -ext * ratio;
      const sd = Math.max(SC.minDistance, ext * 2.1);
      this._shadowDist = sd;
      cam.near = Math.max(12, sd - ext * 2.4);
      cam.far = sd + ext * 3.4;
      cam.updateProjectionMatrix();
      sun.position.copy(this._shadowAnchor).addScaledVector(lightDirV, sd);
      renderer.shadowMap.needsUpdate = true;
    };

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sun = sun;
    this.ambient = amb;
    this.hemi = hemi;
    this.skyMat = sky.material;
    this.skyDome = sky.mesh;
    /* 阴影锚点（注视点）与动态分辨率状态 */
    this._shadowAnchor = new V3(0, 4, 10);
    this._resBase = Math.min(window.devicePixelRatio || 1, C.quality.pixelRatioCap);
    this._resF = 1;

    /* 色彩常量预先建成 Color，避免每帧 new */
    const cSunLow = new THREE.Color(col.sunLow);
    const cSunHigh = new THREE.Color(col.sunHigh);
    const cSkyTopLow = new THREE.Color(col.skyTopLow);
    const cSkyTopHigh = new THREE.Color(col.skyTopHigh);
    const cSkyBotLow = new THREE.Color(col.skyBottomLow);
    const cSkyBotHigh = new THREE.Color(col.skyBottomHigh);
    const cAmbLow = new THREE.Color(col.ambientLow);
    const cAmbHigh = new THREE.Color(col.ambientHigh);
    const cFogTint = new THREE.Color(col.fogTint);
    const cHazeWhite = new THREE.Color(col.hazeWhite);
    /* 夜间常量 */
    const cNightTop = new THREE.Color(C.day.skyTop);
    const cNightBot = new THREE.Color(C.day.skyBottom);
    const cNightHaze = new THREE.Color(C.day.haze);
    const cNightAmb = new THREE.Color(C.day.ambient);
    const cNightHemi = new THREE.Color(C.day.hemiSky);
    const cMoon = new THREE.Color(C.day.moon);
    const moonDirV = new V3(-0.3, 0.5, -0.8);
    const lightDirV = new V3(0, 1, 0);
    const _c1 = new THREE.Color();
    const _c2 = new THREE.Color();
    const smoothstep = (x) => {
      const v = Math.max(0, Math.min(1, x));
      return v * v * (3 - 2 * v);
    };

    /** t: 0 / 1 = 深夜，0.25 = 日出，0.5 = 正午，0.75 = 日落 */
    this.setSun = (t) => {
      const S = C.sun;
      const D = C.day;
      t = Math.max(0, Math.min(1, t));

      /* 白天进度：0 = 日出，1 = 日落；两端之外是夜 */
      const dayT = (t - D.sunrise) / (D.sunset - D.sunrise);
      const k = Math.sin(Math.max(0, Math.min(1, dayT)) * Math.PI);
      const night = Math.max(0, Math.min(1, (D.nightFall - k) / D.nightFall));

      const el = ((k * S.elevationGain + S.elevationBase) - night * 34) * DEG;
      const az = (S.azimuthStart + Math.max(0, Math.min(1, dayT)) * S.azimuthSweep) * DEG;
      sunDirV.set(
        Math.sin(az) * Math.cos(el),
        Math.sin(el),
        Math.cos(az) * Math.cos(el)
      ).normalize();

      /* 月亮：日落后从东南方升起，与太阳方位大致相对 */
      const moonEl = (16 + night * 38) * DEG;
      const moonAz = az + Math.PI * 0.86;
      moonDirV.set(
        Math.sin(moonAz) * Math.cos(moonEl),
        Math.sin(moonEl),
        Math.cos(moonAz) * Math.cos(moonEl)
      ).normalize();

      /* 平行光夜间切到月亮方向，用 night 加权避免日落瞬间跳变。
         阴影视锥以阴影锚点（注视点）为中心，锚点由主循环 setShadowAnchor
         维护——同样大的阴影图始终对准当前在看的地方。 */
      lightDirV.copy(sunDirV).lerp(moonDirV, smoothstep(night)).normalize();
      sun.target.position.copy(this._shadowAnchor);
      sun.position.copy(this._shadowAnchor).addScaledVector(lightDirV, this._shadowDist);
      renderer.shadowMap.needsUpdate = true;

      /* 天候：雪 / 雨 / 秋色的雾、云、日照与天空偏移 */
      const wx = GG.weather ? GG.weather.tint : null;
      const wxTop = wx && wx.skyTop;
      const wxBot = wx && wx.skyBottom;
      const wxFog = wx && wx.fogColor;
      const wxMul = wx ? wx.sunMul : 1;

      _c1.copy(cSunLow).lerp(cSunHigh, k);
      sun.color.copy(_c1).lerp(cMoon, night * 0.9);
      sun.intensity = ((S.intensityBase + k * S.intensityGain) * wxMul * (1 - night * 0.94) *
        (GG.debug.sunMul || 1)) + D.moonI * night;

      const dayAmb = S.ambientBase + (1 - k) * S.ambientFall;
      amb.intensity = dayAmb * (1 - night) + D.ambientI * night;
      amb.color.copy(_c2.copy(cAmbLow).lerp(cAmbHigh, k)).lerp(cNightAmb, night);

      const dayHemi = S.hemiBase + (1 - k) * S.hemiFall;
      hemi.intensity = dayHemi * (1 - night) + D.hemiI * night;
      hemi.color.copy(_c1.copy(cSkyBotLow).lerp(cSkyBotHigh, k)).lerp(cNightHemi, night);

      const u = sky.material.uniforms;
      u.top.value.copy(_c1.copy(cSkyTopLow).lerp(cSkyTopHigh, k));
      if (wxTop) u.top.value.lerp(wxTop, 0.62 * (1 - night));
      u.top.value.lerp(cNightTop, night);

      u.bottom.value.copy(_c2.copy(cSkyBotLow).lerp(cSkyBotHigh, k));
      if (wxBot) u.bottom.value.lerp(wxBot, 0.62 * (1 - night));
      u.bottom.value.lerp(cNightBot, night);

      u.sunDir.value.copy(sunDirV);
      u.sunColor.value.copy(sun.color);
      u.moonDir.value.copy(moonDirV);
      u.moonColor.value.copy(cMoon);
      u.uNight.value = night;
      u.cloudAmt.value = (S.cloudBase + k * S.cloudGain) *
        (wx ? wx.cloudMul : 1) * (1 - night * 0.45);

      scene.fog.color
        .copy(_c2.copy(cSkyBotLow).lerp(cSkyBotHigh, k))
        .lerp(cFogTint, col.fogTintAmount);
      if (wxFog) scene.fog.color.lerp(wxFog, 0.7 * (1 - night));
      scene.fog.color.lerp(cNightHaze, night);
      scene.fog.density = C.fog.density * (wx ? wx.fogMul : 1);
      u.haze.value.copy(scene.fog.color).lerp(cHazeWhite, col.hazeAmount * (1 - night));

      /* 水面：太阳方向、日色、天空上下色与雾色随时刻联动 */
      if (GG.water) {
        GG.water.sync(
          lightDirV, sun.color, u.bottom.value, u.top.value,
          scene.fog.color, scene.fog.density, night
        );
      }

      const dayExp = C.exposure.base + k * C.exposure.sunGain;
      renderer.toneMappingExposure =
        (dayExp * (1 - night) + D.exposure * night) * (GG.debug.exposure || 1);

      /* 环境贴图四档：深夜走 night，晨 / 暮按 dayT 切，白天走 day。
         （超过一档才换 texture；换 texture 不重编译材质） */
      let wantEnv = envIdx;
      if (night > 0.5) wantEnv = 3;
      else if (dayT < 0.14) wantEnv = 0;
      else if (dayT > 0.86) wantEnv = 2;
      else wantEnv = 1;
      if (wantEnv !== envIdx && ENV_LIST[wantEnv]) {
        scene.environment = ENV_LIST[wantEnv];
        envIdx = wantEnv;
      }

      /* 窗纸与宫灯：夜间自发光，白天归零。latticeDim 是次要殿宇，
         亮度压到 55%，整片宫城的窗光因此有了等级（B14） */
      const M = GG.build && GG.build.MAT;
      if (M) {
        if (M.lattice) M.lattice.emissiveIntensity = night * D.windowEmissive;
        if (M.latticeDim) M.latticeDim.emissiveIntensity = night * D.windowEmissive * 0.55;
        if (M.lantern) M.lantern.emissiveIntensity = night * D.lanternEmissive;
        /* 宫灯的灯晕：加法混合的点精灵，夜里才浮出来 */
        if (M.lanternGlow) M.lanternGlow.opacity = night * 0.62;
        /* 皇城外的万家灯火：只在夜里浮出来，白天全透明 */
        if (M.cityLamp) M.cityLamp.opacity = night * 0.85;
      }
    };
  }

  /** 每帧：云飘移、穹顶跟随相机、水面波纹推进 */
  Stage.prototype.tick = function (dt) {
    if (this.skyMat) {
      this.skyMat.uniforms.uTime.value += dt;
      if (this.skyDome) this.skyDome.position.copy(this.camera.position);
    }
    if (GG.water) GG.water.tick(dt);
  };

  /**
   * 阴影锚点：主循环每帧调用。只有位移超过 shadowAnchorEps 才重定向
   * 阴影视锥并标记 needsUpdate——原地转动视角不重绘阴影。
   */
  Stage.prototype.setShadowAnchor = function (x, y, z) {
    const eps = GG.CONFIG.quality.shadowAnchorEps;
    const a = this._shadowAnchor;
    const dx = x - a.x, dy = y - a.y, dz = z - a.z;
    if (dx * dx + dy * dy + dz * dz < eps * eps) return;
    a.set(x, y, z);
    if (this.sun) this.sun.target.position.copy(a);
    this.renderer.shadowMap.needsUpdate = true;
  };

  /** 每帧：按相机到注视点的距离调阴影精度（跨档才生效） */
  Stage.prototype.updateShadowFit = function () {
    if (!this.fitShadowFrustum) return;
    this.fitShadowFrustum(this.camera.position.distanceTo(this._shadowAnchor));
  };

  /** 动态分辨率：档位切换才重设 drawing buffer */
  Stage.prototype.setResolutionScale = function (f) {
    if (this._resF === f) return;
    this._resF = f;
    this.renderer.setPixelRatio(this._resBase * f);
  };

  Stage.prototype.resolutionScale = function () { return this._resF; };

  /**
   * 布局完成后统一压低未显式设置的材质的环境反射强度。
   * 否则 envMapIntensity 默认 1.0 会把地面 / 假山 / 铺装整片打白。
   */
  Stage.prototype.normalizeEnvIntensity = function (value) {
    const v = value == null ? 0.22 : value;
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (m && m.isMeshStandardMaterial && m.envMapIntensity === 1) m.envMapIntensity = v;
      }
    });
  };

  Stage.prototype.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    /* 窗口尺寸变化后重放当前分辨率倍率（setSize 会按 pixelRatio 重建缓冲） */
    this.renderer.setPixelRatio(this._resBase * this._resF);
  };

  Stage.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };

  GG.Stage = Stage;
})();
