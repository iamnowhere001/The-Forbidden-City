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
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(C.fog.color, C.fog.density);

    /* 程序化环境贴图：让琉璃瓦 / 石材有真实反射 */
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const es = new THREE.Scene();
      const envSky = new THREE.Mesh(
        new THREE.SphereGeometry(100, 24, 16),
        new THREE.ShaderMaterial({
          uniforms: {
            top: { value: new THREE.Color(col.envSky.top) },
            bot: { value: new THREE.Color(col.envSky.bottom) },
            gnd: { value: new THREE.Color(col.envSky.ground) }
          },
          vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform vec3 gnd; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(bot, top, pow(h, 0.55)) : mix(bot, gnd, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }',
          side: THREE.BackSide
        })
      );
      es.add(envSky);
      scene.environment = pmrem.fromScene(es, 0.03).texture;
      pmrem.dispose();
    } catch (e) { /* 环境贴图失败不影响主流程 */ }

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
    const _c1 = new THREE.Color();
    const _c2 = new THREE.Color();

    /** t: 0 = 日出，0.5 = 正午，1 = 日落 */
    this.setSun = (t) => {
      const S = C.sun;
      t = Math.max(0, Math.min(1, t));
      const k = Math.sin(t * Math.PI);            // 太阳高度系数
      const el = (k * S.elevationGain + S.elevationBase) * DEG;
      const az = (S.azimuthStart + t * S.azimuthSweep) * DEG;
      sunDirV.set(
        Math.sin(az) * Math.cos(el),
        Math.sin(el),
        Math.cos(az) * Math.cos(el)
      ).normalize();

      sun.position.set(sunDirV.x * S.distance[0], sunDirV.y * S.distance[1], sunDirV.z * S.distance[2]);
      sun.color.copy(_c1.copy(cSunLow).lerp(cSunHigh, k));
      sun.intensity = (S.intensityBase + k * S.intensityGain) * (GG.debug.sunMul || 1);

      amb.intensity = S.ambientBase + (1 - k) * S.ambientFall;
      amb.color.copy(_c2.copy(cAmbLow).lerp(cAmbHigh, k));
      hemi.intensity = S.hemiBase + (1 - k) * S.hemiFall;
      hemi.color.copy(_c1.copy(cSkyBotLow).lerp(cSkyBotHigh, k));

      const u = sky.material.uniforms;
      u.top.value.copy(_c1.copy(cSkyTopLow).lerp(cSkyTopHigh, k));
      u.bottom.value.copy(_c2.copy(cSkyBotLow).lerp(cSkyBotHigh, k));
      u.sunDir.value.copy(sunDirV);
      u.sunColor.value.copy(_c1.copy(cSunLow).lerp(cSunHigh, k));
      u.cloudAmt.value = S.cloudBase + k * S.cloudGain;

      scene.fog.color
        .copy(_c2.copy(cSkyBotLow).lerp(cSkyBotHigh, k))
        .lerp(cFogTint, col.fogTintAmount);
      u.haze.value.copy(scene.fog.color).lerp(cHazeWhite, col.hazeAmount);

      /* 水面：太阳方向、日色、天空色与雾色随时刻联动 */
      if (GG.water) {
        GG.water.sync(sunDirV, sun.color, u.bottom.value, scene.fog.color, C.fog.density);
      }

      renderer.toneMappingExposure =
        (C.exposure.base + k * C.exposure.sunGain) * (GG.debug.exposure || 1);
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
