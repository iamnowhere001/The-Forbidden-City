# 架构与扩展

> 适用版本：v2.1。描述“代码怎么组织、改哪里、怎么加东西”，不重复产品说明。
> 数字口径见 `node tools/stats.js`，本文不手写计数。

---

## 一、技术选型

| 层面 | 选型 | 说明 |
| --- | --- | --- |
| 渲染引擎 | Three.js r149（本地副本，594 KB） | 2023 年版本，API 与 r150+ 有差异，升级需整体回归 |
| 语言 | 原生 JavaScript（ES2017+），IIFE + `window.GG` | 无 TypeScript、无打包器 |
| 着色器 | GLSL ES（天空 / 云 / 水面） | `js/sky.js`、`js/water.js` |
| 贴图 | Canvas 2D → `THREE.CanvasTexture` | 全部运行时生成 |
| 样式 | 原生 CSS（自定义属性 + 媒体查询） | 无预处理器、无 UI 框架 |
| 构建 | 无 | 没有 `package.json`、`npm install`、打包步骤 |

**为什么不加构建链**：项目的价值在于“打开即看”。引入打包器会同时抬高部署、调试与二次修改的成本，而当前规模用 IIFE 分层仍然可控。这条约束在 v2.0 加了中英双语与导览之后重新评估过一次，结论不变。

**依赖管理**：只手写 vendoring Three.js 一个文件。新增任何运行时依赖都要先回答“断网还能不能开”。

---

## 二、脚本加载顺序

```
debug → config → i18n → three → sky → water → orbit → renderer → views
      → labels → picking → ui → tour → textures → geo → buildings
      → data/info → data/tour → palace → app
```

后面的模块依赖前面挂在 `window.GG` 上的对象，调换会直接白屏。典型例子：`buildings.js` 的 `MAT.water` 取自 `water.js` 创建的材质单例。

---

## 三、模块职责

| 文件 | 职责 | 对外暴露 |
| --- | --- | --- |
| `debug.js` | 错误浮层、URL 参数解析、`?seed=1` 固定随机数 | `GG.query`、`GG.debug` |
| `config.js` | 颜色、曝光、光照、标签阈值、机位表的唯一来源 | `GG.CONFIG` |
| `i18n.js` | 中英界面文案、分类与字段名翻译 | `GG.i18n`（`t` / `toggle` / `applyStatic`） |
| `sky.js` | 单 pass 天空材质与穹顶 | `GG.createSky(C, sunDir)` |
| `water.js` | 水面单例材质：波纹、菲涅耳、日光高光、雾 | `GG.water`（`create` / `sync` / `tick`） |
| `orbit.js` | 球坐标轨道控制、阻尼、触控、平移 | `GG.Orbit`、`syncFromCamera()` |
| `renderer.js` | 渲染器、相机、环境贴图、光照、雾、`setSun(t)` | `GG.Stage` |
| `views.js` | 从 `GG.CONFIG.views` 生成按钮，管理飞行与落位 | `GG.Views`（`set` / `applyInstant` / `flyTo`） |
| `labels.js` | 标签 DOM、投影、避让、优先级过滤 | `GG.Labels`（`build` / `update` / `invalidate`） |
| `picking.js` | Raycaster 拾取、悬停高亮、地面光圈 | `GG.Picker`（`pickAt` / `setHover`） |
| `ui.js` | 侧栏索引（搜索、已阅打卡）与信息卡 | `GG.UI`（`build` / `show` / `hide` / `refresh` / `markVisited`） |
| `tour.js` | 导览播放器：换站、暂停、字幕 | `GG.Tour`（`start` / `next` / `prev` / `stop`） |
| `textures.js` | 生成并缓存全部贴图 | `GG.getTextures()`、`GG.getPlaque(text)` |
| `geo.js` | 几何生成原语，不碰材质 | `GG.geo.{ roofGeometry, gableGeometry, ridgeGeometry, terraceGeometry, railingGeometry, stairsGeometry, columnRing, dougongRing, fitUV, merge, box, xform, lerp }` |
| `buildings.js` | 几何 + 材质组装成建筑组 | `GG.build.{ createHall, createGateTower, createPavilion, createCorridor, createWall, createBronzeSet, treeGeometries, buildMaterials, MAT }` |
| `data/info.js` | 建筑词条（纯数据） | `GG.INFO` |
| `data/tour.js` | 12 站导览路线与中英字幕 | `GG.TOUR` |
| `palace.js` | 决定“什么建筑放在哪” | `GG.layout(scene)`、`GG.REGISTRY` |
| `app.js` | 编排初始化与主循环，自执行 | 无导出 |

---

## 四、渲染管线

| 环节 | 做法 |
| --- | --- |
| 色彩 | `ColorManagement.legacyMode = false`（r149 必须显式关闭，否则 hex 被当线性值，画面整体发灰） |
| 色调映射 | `ACESFilmicToneMapping`，曝光按机位/时刻预设插值 |
| 环境光 | `PMREMGenerator` 从程序化天空场景烘出环境贴图，材质按 `envMapIntensity` 归一 |
| 天空 | 单 pass 片元着色器：垂直渐变 + 日轮 + 4×4 octave FBM 云 + 地平线灰霾，穹顶每帧跟随相机 |
| 雾 | `FogExp2`，颜色与天空 haze 同步，天地无缝 |
| 阴影 | `PCFShadowMap`，4096×4096，正交相机覆盖 ±760 / ±820 |
| 屋面体积 | 屋顶几何输出顶点色 AO（檐口压暗 36%，垄脊略亮） |
| 水面 | 自写 `ShaderMaterial`：三组余弦波叠加出法线，菲涅耳混天空色与深水色，窄高光做碎金反光，雾按 `FogExp2` 同式手算，随日照联动 |

> `PCFSoftShadowMap` 在 SwiftShader 软渲染下不出影，为保证截图回归可用，当前统一用 `PCFShadowMap`。真机与软渲染分环境切换已记入 ROADMAP（v2.2）。

---

## 五、硬约束

1. **坐标**：`X` 向东、`Z` 向南、`Y` 向上，单位米，中轴在 `x = 0`。北是 `−Z`，所以视角朝北时罗盘角为 0。
2. **建筑进索引靠 `userData`**：`isBuilding = true` 才会被 `GG.layout` 收进 `REGISTRY`；`info` 决定标签与信息卡；`labelY` 决定标签高度。三者缺一，建筑只是“模型”，不是“可交互对象”。
3. **机位只有一份**：`GG.CONFIG.views`。按钮、键盘、`?view=` 都从它推导，不在 `app.js` 或 `index.html` 另写一套。
4. **材质走单例**：新材质挂到 `buildMaterials()` 的 `MAT` 里复用，不要在每座建筑里 `new MeshStandardMaterial`。自定义着色器材质自成一个模块（参照 `js/water.js`），同样只建一份。
5. **不用 ES Module**：`file://` 下会因 CORS 失效。新模块继续 IIFE 挂 `window.GG`。
6. **可调参数进配置**：颜色、曝光、光照强度、标签阈值、机位都放 `GG.CONFIG`。

---

## 六、扩展指南

### 加一座殿

`js/palace.js` 的 `GG.layout` 内部有 `HALL()` 辅助函数，自动处理定位、注册与索引：

```js
HALL({
  x: 0, z: -520,              // 平面位置（米）
  w: 34, d: 20, h: 11,        // 面阔 / 进深 / 檐柱高
  roofH: 8,                   // 屋顶高
  style: 'xieshan',           // hip | xieshan | gable | pyramid
  tiers: 1, tierH: 1.4,       // 台基层数与单层高
  double: false,              // true = 重檐
  eave: 2.2,                  // 出檐
  plaque: '体元殿',            // 匾额文字，省略则无匾
  info: {
    name: '体元殿',
    en: 'Hall of Primordial Origin',
    cat: '西路',
    year: '清',
    form: '单檐歇山顶',
    scale: '面阔五间（示意）',
    status: '原状陈列',         // 可选
    desc: '……',
    note: '……'                 // 可选，出现则信息卡多一层「史料与考据」
  }
});
```

`info` 的字段规范见 [content-guide.md](content-guide.md)。`form` / `desc` 必填，`scale` 不确定时标“示意”而不是省略。

**屋顶形制**：`createHall` 实际支持 4 种——`hip`（庑殿）、`xieshan`（歇山）、`gable`（悬山）、`pyramid`（攒尖）。角楼的十字歇山不是 style 参数，而是用两个 `roofGeometry` 正交拼合手工建的；盝顶尚未实现，词条里不要写。

若用底层的 `GG.build.createHall(cfg)`，需要自己定位、`scene.add(group)`，并经 `palace.js` 内部的 `add()` 注册，否则建筑不会被索引与拾取。

**新增后要同步的**：跑 `node tools/stats.js`，把 README 的“当前状态”表更新；若挂了新匾额，确认 `content-guide.md` 的校核规则仍然成立。

### 加一个机位

只改 `js/config.js` 的 `GG.CONFIG.views`：

```js
{ id: 'myView', label: '东南望', labelEn: 'Southeast', name: '东南望', key: 'q',
  p: [180, 60, 240], t: [0, 20, 120] }     // p = 相机位置，t = 注视点
```

- 带 `key` 的条目自动绑定同名按键。数字键 `1`–`9` 已被占用，新机位请用字母或留给后续重排。
- 带 `hidden: true` 的条目不生成按钮，只保留 `?view=` 直链（`detail` 机位就是这么处理的）。
- 按钮文案、悬停标题、键盘映射、URL 落位全部从这份表推导，不用改 `app.js` 或 `index.html`。

### 加一张贴图

```js
// js/textures.js
function myCanvas() {
  const c = cv(512, 512);          // 内置画布工厂
  const ctx = c.getContext('2d');
  /* ...绘制... */
  grain(ctx, 512, 512, 0.05, 0.1); // 内置颗粒噪点，避免死平
  return c;
}

// 在 GG.getTextures 的 cache 对象里加一行
cache = {
  /* ... */
  myTex: tex(myCanvas(), 1, 1)     // tex() 会设好重复与各向异性
};
```

使用时通过 `GG.getTextures().myTex` 取。缓存是单例，不要重复生成。

**不要加纵向渐变**：沿坡面会重复成条带。瓦面质感优先用 bumpMap 与顶点色 AO 表达。

### 加一条导览线

`js/data/tour.js` 是纯数据。每条路线由站点数组组成，机位复用 `Views.spotFor()` 的取景算法，不要另写一套坐标。多路线切换本身尚未实现，属于 v2.3 的 T6.1。

---

## 七、代码约定

- 缩进 2 空格，语句结尾加分号。
- 新界面文案必须双语：静态节点写 `data-zh` / `data-en`（标题类再加 `data-title-zh` / `data-title-en`），JS 里用 `GG.i18n.t(zh, en)`。新增控件补 `aria-label` / `aria-pressed`，并同步 `docs/accessibility.md`。
- 屋顶参数慎改：`GG.CONFIG.roof` 里的 `curv 1.55`、翼角 `lift = min(hw,hd) × 0.024`、庑殿推山系数 `0.76` 是长期调出来的结果，改动必须附前后截图。
- 同类小构件优先 `GG.geo.merge()` 或 `InstancedMesh`，控制 draw call。
- 改了渲染相关代码，按 [dev-tooling.md](dev-tooling.md) 跑一遍截图回归。
