# 架构与扩展

> 适用版本：v2.4–v2.5（未发版）。描述“代码怎么组织、改哪里、怎么加东西”，不重复产品说明。
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
debug → config → i18n → three → sky → water → weather → orbit → renderer
      → views → labels → picking → ui → tour → textures → geo → buildings → tiantan → city
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
| `water.js` | 水面单例材质：波纹、菲涅耳、日光高光、雾、雨滴涟漪 | `GG.water`（`create` / `sync` / `tick` / `setRain`） |
| `weather.js` | 天候预设：材质色调、雾与云参数、雪 / 雨 / 落叶粒子 | `GG.weather`（`apply` / `tick` / `tint` / `presets`） |
| `orbit.js` | 球坐标轨道控制、阻尼、触控、平移 | `GG.Orbit`、`syncFromCamera()` |
| `renderer.js` | 渲染器、相机、环境贴图、光照、雾、`setSun(t)` | `GG.Stage` |
| `views.js` | 从 `GG.CONFIG.views` 生成按钮，管理飞行与落位 | `GG.Views`（`set` / `applyInstant` / `flyTo`） |
| `labels.js` | 标签 DOM、投影、避让、优先级过滤 | `GG.Labels`（`build` / `update` / `invalidate`） |
| `picking.js` | Raycaster 拾取、悬停高亮、地面光圈 | `GG.Picker`（`pickAt` / `setHover`） |
| `ui.js` | 侧栏索引（搜索 / 分类 / 年代 / 已阅）、信息卡与互链 | `GG.UI`（`build` / `show` / `hide` / `refresh` / `markVisited`） |
| `tour.js` | 导览播放器：多路线切换、换站、暂停、字幕 | `GG.Tour`（`start` / `setRoute` / `next` / `prev` / `stop`） |
| `textures.js` | 生成并缓存全部贴图 | `GG.getTextures()`、`GG.getPlaque(text)` |
| `geo.js` | 几何生成原语，不碰材质 | `GG.geo.{ roofGeometry, gableGeometry, ridgeGeometry, terraceGeometry, railingGeometry, stairsGeometry, columnRing, dougongRing, fitUV, merge, box, xform, mergeGroup, optimizeStatics, mergeWorldStatics, lerp }` |
| `buildings.js` | 几何 + 材质组装成建筑组 | `GG.build.{ createHall, createGateTower, createPavilion, createCorridor, createWall, createBronzeSet, treeGeometries, buildMaterials, groundMaterial, MAT }` |
| `tiantan.js` | 天坛（清乾隆十九年格局）：坛墙、祈谷坛、圜丘坛、皇穹宇、斋宫、神乐署、柏林 | `GG.tiantan.{ build, footprintPath, stats }` |
| `city.js` | 宫城之外的京师：皇城 / 内城 / 外城城墙与城门、先农坛、北海、中南海、胡同院落与夜灯 | `GG.city`（`build(scene, reg)` / `treeSpots` / `stats`） |
| `data/info.js` | 建筑词条（纯数据） | `GG.INFO` |
| `data/tour.js` | 12 站导览路线与中英字幕 | `GG.TOUR` |
| `palace.js` | 总平面布置，内部按区域拆成五段函数 | `GG.layout(scene)`、`GG.REGISTRY` |
| `app.js` | 编排初始化与主循环，自执行 | 无导出 |

### 京师范围（`city.js`）

| 层 | 范围（x / z，米） | 内容 |
| --- | --- | --- |
| 宫城 | ±376 / ±480 | 午门—神武门、东西华门 |
| 皇城 | ±1120 / +800 … -1700 | 大清门、天安门、地安门、东安门、西安门；景山、北海、中南海 |
| 内城 | ±3300 / +1650 … -2400 | 九门；正阳门带箭楼与瓮城 |
| 外城 | ±3900 / +1650 … +4400 | 永定门、左安门、右安门、广渠门、广安门；天坛、先农坛 |

- `city.js` **不消耗 `Math.random`**：胡同布局用独立 LCG，树位写进 `GG.city.treeSpots`，
  由 `scatterLayer` 在既有 scatter 之后并入。否则 `?seed=1` 下宫城内的树会整体漂移。
- **地标进城靠 `register` 回调**：`GG.city.build(scene, reg)` 的第二个参数由
  `palace.js` 注入，城门（`key: 'zhengyangmen'` 这类字符串键）与坛庙 / 三海
  （`mark(group, 'tiantan')`）经它挂进 `REG`，因此可点击、有标签、能打开信息卡。
  四合院是实例化体块，不进索引。
- **四合院分两层**：近景（宫城周边 1150 m 与前门大街两侧）是完整院落，含院墙压顶、
  门楼、影壁、厢房、倒座，墙身与屋顶各一个 `InstancedMesh`；远景是 78 m 的
  "连排"（三间共墙、屋脊参差），同样两个 `InstancedMesh` 承载。两层分开是因为
  26 m 与 78 m 的排布尺度不能混在一个循环里，否则边界会出现"半间房"的缺口。
- 胡同地面按未遮挡的连续区间铺成条带，合并成一个 mesh；街巷由此"画"出来。
- 城外地坪是一张带两个孔的大平面（宫城方孔、天坛外坛轮廓孔），孔里分别铺宫城与天坛地坪，
  三张平面互不重叠。天坛外坛 1703 × 1657 米，只差 17 cm 就会被城市地坪在 3 km 外抢掉，
  详见 `docs/tiantan.md`。
- **天坛已拆到 `tiantan.js`**（v2.5）：`city.js` 只在 `build` 里调一次
  `GG.tiantan.build(scene, mark, treeSpots)`，并把外坛轮廓当孔挖进城市地坪。
  坛内柏林由天坛自己铺，不消耗 `Math.random`，直接写进 `GG.city.treeSpots`。

---

## 四、渲染管线

| 环节 | 做法 |
| --- | --- |
| 色彩 | `ColorManagement.legacyMode = false`（r149 必须显式关闭，否则 hex 被当线性值，画面整体发灰） |
| 色调映射 | `ACESFilmicToneMapping`，曝光按机位/时刻预设插值 |
| 环境光 | `PMREMGenerator` 从程序化天空场景烘出环境贴图，材质按 `envMapIntensity` 归一 |
| 天空 | 单 pass 片元着色器：垂直渐变 + 日轮 + 4×4 octave FBM 云 + 地平线灰霾，穹顶每帧跟随相机 |
| 雾 | `FogExp2`，颜色与天空 haze 同步，天地无缝 |
| 阴影 | 真机 `PCFSoftShadowMap`，软渲染自动退回 `PCFShadowMap`；8192×8192，正交视锥按视距在 ±95 … ±760 之间自适应（近景精度提高八倍），跨档才重设投影并重绘 |
| 静态合批 | 两遍：`optimizeStatics` 在**每个 Group 内部**按材质合并（保留建筑层级供拾取）；`mergeWorldStatics` 把**不属于任何建筑**的静态块（城墙、地坪、坛墙）按材质烘进世界坐标跨组合并 |
| 夜景 | 星场与月轮在天空着色器内完成；平行光夜间切到月光方向；晨 / 午 / 暮 / 夜四档 PMREM 环境贴图按 `dayT` 与 `night` 切换 |
| 自发光 | 窗纸（`MAT.lattice` 用自身贴图作 `emissiveMap`）与宫灯（16 座 `InstancedMesh`）强度由 `setSun` 按夜晚系数驱动；宫灯另叠一圈加法混合的 `Points` 灯晕 |
| 天候 | `GG.weather` 改材质颜色与 `tint`，`setSun` 读取后叠加到天空、雾、云与日照；粒子独立 LCG |
| 屋面体积 | 屋顶几何输出顶点色 AO（檐口压暗 36%，垄脊略亮） |
| 水面 | 自写 `ShaderMaterial`：三组余弦波 + 一层不随距离衰减的低频涌浪出法线，近景补 60 米内高频细纹，雨天加格点涟漪；反射色按反射向量仰角在天顶 / 地平之间插值，菲涅耳反射率封顶 0.6（不封顶时掠射角下水 100% 反射天空，整片湖像塑料板）；多尺度噪声调制日光碎金，夜间叠月光带 |
| 岸线 | 湖面之外另建两层：贴岸的半透明浅滩带（两条缩放岸线夹出的环，不依赖法线方向）+ 沿曲线的条石驳岸与压面石 |

> **阴影模式为什么按环境切换**：`PCFSoftShadowMap` 在 SwiftShader / llvmpipe 下不出影，截图回归会得到“没有阴影”的假基线。检测到软件渲染时退回 `PCFShadowMap`，真机仍用软阴影；`?shadow=hard|soft` 可强制覆盖。
>
> **时间轴**：`t = 0 / 1` 深夜，`0.25` 日出，`0.5` 正午，`0.75` 日落。v2.1 及以前 `0` 与 `1` 都是日出 / 日落，v2.2 为了夜景才改成现在这样。

---

## 五、硬约束

1. **坐标**：`X` 向东、`Z` 向南、`Y` 向上，单位米，中轴在 `x = 0`。北是 `−Z`，所以视角朝北时罗盘角为 0。
2. **建筑进索引靠 `userData`**：`isBuilding = true` **且 `info.name` 非空** 才会被 `GG.layout` 收进 `REGISTRY`；`info` 决定标签与信息卡；`labelY` 决定标签高度。三者缺一，建筑只是"模型"，不是"可交互对象"。没有名字的亭、廊、值房不进索引——否则会出现"点得到、打开是空卡"的幽灵条目。
3. **拾取取最外层**：`Picker.pickAt` 从命中点向上爬到**最外层** `isBuilding` 祖先。城门楼的正楼是 `createHall` 造的子 Group，自己带 `isBuilding`；若在第一个 `isBuilding` 停下，点午门会选中里面的正楼，光圈跑到半空、标签对不上。
4. **机位只有一份**：`GG.CONFIG.views`。按钮、键盘、`?view=` 都从它推导，不在 `app.js` 或 `index.html` 另写一套。
5. **材质走单例**：新材质挂到 `buildMaterials()` 的 `MAT` 里复用，不要在每座建筑里 `new MeshStandardMaterial`。自定义着色器材质自成一个模块（参照 `js/water.js`），同样只建一份。
6. **不用 ES Module**：`file://` 下会因 CORS 失效。新模块继续 IIFE 挂 `window.GG`。
7. **可调参数进配置**：颜色、曝光、光照强度、标签阈值、机位都放 `GG.CONFIG`。
8. **形制按等级分档**，不要一处一套写法：

| 项 | 高等级（三大殿 / 中轴门楼） | 次等级 | 实现位置 |
| --- | --- | --- | --- |
| 彩画 | 和玺（金龙枋心 + 圭线光）`MAT.caihuaHexi` | 旋子 `MAT.caihua` | `createHall` 的 `cfg.hexi`，名单在 `palace.js` 的 `HEXI` |
| 檐角走兽 | 仙人 + 7 只 | 重檐 5 / 单檐 3 | `ridgeGeometry` 的 `beasts` |
| 墙顶 | 黄琉璃 `MAT.tileCapYellow` | 坛庙用绿 `MAT.tileCapGreen` | `createWall` 的 `capMat`，默认黄 |
| 门窗 | 三交六椀菱花（全楼统一） | 同左，夜间自发光压到 55% | `latticeCanvas` / `MAT.latticeDim` |

**宫城城墙与内城 / 外城城墙是两种东西**：宫城是平滑红墙 + 黄琉璃瓦双道压顶（`createWall({ crenel: false, doubleCap: true })`），不设垛口；垛口只属于内城、外城那种防御性城墙（`crenel: true`）。写反了整圈宫墙会变成城墙。

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
    py: 'tiyuandian', pyi: 'tyd',  // 拼音全拼与首字母，搜索用
    cat: '西路',
    year: '清',
    form: '单檐歇山顶',
    scale: '面阔五间（示意）',
    status: '原状陈列',         // 可选
    desc: '……',
    note: '……',                 // 可选，出现则信息卡多一层「史料与考据」
    rel: ['shoukanggong']       // 可选，相关词条的 info key
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

`js/data/tour.js` 是纯数据，结构是 `GG.TOUR.routes[]`：

```js
{
  id: 'inner',                                  // 唯一标识，也用于 tab 的 data-route
  title: { zh: '六宫导览', en: 'The Six Palaces' },
  short: { zh: '六宫', en: 'Palaces' },          // tab 上的短文案
  stops: [{ target: '景仁宫', dwell: 9000, zh: '…', en: '…' }]
}
```

- `target` 必须与 `info.name` 完全一致。**区域词条（如「御花园」）没有挂到场景实体，写进路线会被静默跳过**——用园内具体的亭子代替。
- 机位复用 `Views.spotFor()` 的取景算法，不要另写坐标。
- 新增路线后 `node tools/search-check.js` 会校验站点是否有对应词条、字幕是否齐全。
- tab 按钮由 `Tour._buildRoutes()` 从数据生成，不用改 `index.html`。

### 加一条词条关联

`info.js` 的 `rel` 是 info key 数组：

```js
taihedian: {
  py: 'taihedian', pyi: 'thd',
  rel: ['taihemen', 'zhonghedian', 'baohedian'],
  name: '太和殿', …
}
```

`ui.js` 渲染信息卡时把它们转成中文名按钮。**引用必须存在**，`tools/search-check.js` 会拦悬空 key。

`py` 是拼音全拼（无空格、小写），`pyi` 是首字母串。两者都手写，新增词条时不要漏——搜索的拼音命中完全依赖它们。

### 布局代码的分段

`GG.layout` 内部是五段函数，按原顺序调用：

```
frontCourt() → palaces() → defenses() → environs() → scatterLayer()
```

跨段的量只有 `GARDEN_Z`、`HILL`、`hillY`，在 layout 顶部用 `let` 声明、由分段函数赋值。**不要调整调用顺序**：对象创建顺序一变，`?seed=1` 的随机数流就变了，截图基线全部失效。新增建筑时放进对应段函数即可，不要在 `return REG` 前临时追加。

---

## 七、代码约定

- 缩进 2 空格，语句结尾加分号。
- 新界面文案必须双语：静态节点写 `data-zh` / `data-en`（标题类再加 `data-title-zh` / `data-title-en`），JS 里用 `GG.i18n.t(zh, en)`。新增控件补 `aria-label` / `aria-pressed`，并同步 `docs/accessibility.md`。
- 屋顶参数慎改：`GG.CONFIG.roof` 里的 `curv 1.55`、翼角 `liftRatio 0.042`（`lift = min(hw,hd) × liftRatio`）、庑殿推山系数 `0.76` 是长期调出来的结果，改动必须附前后截图。
- 同类小构件优先 `GG.geo.merge()` 或 `InstancedMesh`，控制 draw call。
- 改了渲染相关代码，按 [dev-tooling.md](dev-tooling.md) 跑一遍截图回归。
