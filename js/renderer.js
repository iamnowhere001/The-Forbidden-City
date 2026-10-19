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

    /* 程序化环境贴图：昼 / 夜两套，日落后切换。
       PMREM 只在初始化时烘两次；切换只是换 texture，不重编译材质。 */
    function makeEnv(top, bot, gnd) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const es = new THREE.Scene();
        es.add(new THREE.Mesh(
          new THREE.SphereGeometry(100, 24, 16),
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
    const envDay = makeEnv(col.envSky.top, col.envSky.bottom, col.envSky.ground);
    const envNight = makeEnv(0x0d1524, 0x18202f, 0x07090d);
    if (envDay) scene.environment = envDay;
    let envNightOn = false;

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

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sun = sun;
    this.ambient = amb;
    this.hemi = hemi;
    this.skyMat = sky.material;
    this.skyDome = sky.mesh;

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

      /* 平行光夜间切到月亮方向，用 night 加权避免日落瞬间跳变 */
      lightDirV.copy(sunDirV).lerp(moonDirV, smoothstep(night)).normalize();
      sun.position.set(
        lightDirV.x * S.distance[0],
        lightDirV.y * S.distance[1],
        lightDirV.z * S.distance[2]
      );

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

      /* 水面：太阳方向、日色、天空色与雾色随时刻联动 */
      if (GG.water) {
        GG.water.sync(lightDirV, sun.color, u.bottom.value, scene.fog.color, scene.fog.density);
      }

      const dayExp = C.exposure.base + k * C.exposure.sunGain;
      renderer.toneMappingExposure =
        (dayExp * (1 - night) + D.exposure * night) * (GG.debug.exposure || 1);

      /* 环境贴图：入夜与天亮各切一次，避免夜间材质反射白天天空 */
      const wantNight = night > 0.55;
      if (envNight && wantNight !== envNightOn) {
        scene.environment = wantNight ? envNight : envDay;
        envNightOn = wantNight;
      }

      /* 窗纸与宫灯：夜间自发光，白天归零 */
      const M = GG.build && GG.build.MAT;
      if (M) {
        if (M.lattice) M.lattice.emissiveIntensity = night * D.windowEmissive;
        if (M.lantern) M.lantern.emissiveIntensity = night * D.lanternEmissive;
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
  };

  Stage.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };

  GG.Stage = Stage;
})();
