# AGENTS.md

> 面向接手本项目的 AI 编码代理。先读 [README.md](./README.md)、[docs/architecture.md](docs/architecture.md)、[docs/dev-tooling.md](docs/dev-tooling.md)。
> 本文件只写“是什么、改哪里、怎么验、哪里会炸”。事实以当前 HEAD（`3a9a8e2`，2026-11-03）为准；所有计数先跑脚本，不要手抄旧文档。

## 一、项目是什么

紫禁城 / 故宫 3D 交互展示。米制尺度、示意性复原，宫城、皇城、内城、外城、天坛与四合院全部在运行时用代码生成，仓库里没有外部模型或贴图素材。

| 是 | 不是 |
| --- | --- |
| 桌面 Chrome 优先的离线建筑科普展示 | 移动端产品、测绘级复原 |
| 打开 `index.html` 即运行 | 需要 `npm install` / 构建链的项目 |
| 原生 JS + 本地 Three.js r149 | TypeScript、ES Module、打包器 |

当前内容量（`node tools/stats.js`，2026-11-03）：98 条词条，97 条挂载到场景实体（`御花园` 为区域词条），77 块匾额（65 显式 + 六宫 12 自动），12099 行 JS。最新 tag 为 `v2.3`；HEAD 已包含 2026-10-19 至 10-21 的五轮未发布内容（京师、三大殿细节、天坛等），见 [CHANGELOG.md](./CHANGELOG.md)。

## 二、运行与版本

```bash
# 方式一：直接打开（推荐）
open index.html

# 方式二：本地静态服务器
python3 -m http.server 8931 --protocol HTTP/1.1
# 访问 http://localhost:8931
```

- `--protocol HTTP/1.1` 不能省：Python 默认 HTTP/1.0，Chrome 复用连接时会被单方面关闭，页面卡在加载层而服务端日志全是 200。
- 直接运行不需要 Node / Python；`tools/` 下的统计、断言、截图脚本才需要 `node` 或 `python3`。
- 新模块禁用 ES Module 与 `fetch`：`file://` 下会因 CORS 失效。继续用 IIFE 挂 `window.GG`。
- 新增任何运行时依赖前先回答“断网还能不能打开”。

## 三、目录与模块职责

```text
index.html               页面骨架与脚本加载顺序
css/style.css            唯一样式文件（CSS 变量 + 分区注释 + 媒体查询）
js/vendor/three.min.js   Three.js r149 本地副本，不要改
js/debug.js              错误浮层、URL 参数、?seed=1 固定随机数
js/config.js             GG.CONFIG：颜色、光照、雾、标签阈值、机位表、屋顶参数
js/i18n.js               中英界面文案、分类/字段翻译、localStorage 语言记忆
js/sky.js                单 pass 天空穹顶
js/water.js              水面 ShaderMaterial 单例
js/weather.js            天候预设与雪/雨/落叶粒子
js/orbit.js              自实现轨道控制器（阻尼、触控、平移）
js/renderer.js           Stage：renderer、camera、光照、雾、环境贴图、setSun
js/views.js              从 CONFIG.views 生成按钮与相机飞行
js/labels.js             标签 DOM、投影、避让、优先级
js/picking.js            Raycaster 拾取、悬停高亮、地面光圈
js/ui.js                 侧栏索引、搜索、已阅、信息卡与互链
js/tour.js               导览播放器（多路线、暂停、字幕）
js/textures.js           全部 Canvas 程序化贴图缓存、匾额贴图
js/geo.js                几何原语与静态合批，不碰材质
js/buildings.js          殿/门/楼/亭/廊/墙工厂与材质单例 MAT
js/tiantan.js            天坛坛域、坛墙、祈谷坛、圜丘、皇穹宇、斋宫、柏林
js/city.js               皇城/内城/外城、城门、三海、先农坛、胡同四合院
js/data/info.js          建筑词条纯数据 GG.INFO
js/data/tour.js          导览路线纯数据 GG.TOUR
js/palace.js             总平面布置，内部五段函数；GG.layout 与 GG.REGISTRY
js/app.js                初始化编排、交互绑定、主循环，自执行
docs/                    架构、天坛、内容规范、开发工具、无障碍
tools/                   统计、断言、截图、探针
```

## 四、加载顺序与全局对象

`index.html` 的加载顺序是硬约束，后加载模块依赖前面挂在 `window.GG` 上的对象，调换会直接白屏：

```text
head:  debug → config → i18n
body:  three.min.js → sky → water → weather → orbit → renderer
       → views → labels → picking → ui → tour → textures → geo
       → buildings → tiantan → city → data/info → data/tour
       → palace → app
```

典型依赖：`buildings.js` 的 `MAT.water` 来自 `GG.water.create()`；`geo.js` / `buildings.js` 依赖 `GG.getTextures()`；`palace.js` 依赖 `GG.INFO`、`GG.build`、`GG.geo`、`GG.city`、`GG.tiantan`。

模块统一写成：

```js
(function () {
  const GG = (window.GG = window.GG || {});
  // ... 只挂 GG 命名空间，不污染 window
})();
```

外部调试入口：`GG.CONFIG`、`GG.build.MAT`、`GG.getTextures()`、`GG.geo`、`GG.water`、`GG.city`、`GG.tiantan`、`GG.REGISTRY`；`app.js` 在布局完成后挂 `window.__dbg`（`stage` / `orbit` / `registry` / `picker` / `labels` / `views` / `ui` / `GG` / `THREE`）。`window.__mark` / `window.__cap` 只在 `?seed=1` 下存在，用于定位随机数消耗。

## 五、坐标与内容约定

1. **坐标**：`X` 向东，`Z` 向南，`Y` 向上，单位米，中轴在 `x = 0`。北是 `-Z`。
2. **建筑进索引的三件套**：`userData.isBuilding = true` 且 `userData.info.name` 非空，再由 `palace.js` 的 `add()` 收进 `REG`；`userData.labelY` 决定标签高度，`pickRadius` 可选。缺一项，建筑只是“模型”，不是可交互对象。
3. **不要注册没有名字的亭、廊、值房**：会变成“点得到、打开是空卡”的幽灵条目，也会拖慢射线检测。
4. **拾取取最外层**：`Picker.pickAt` 从命中点向上爬到最外层 `isBuilding` 祖先。城门楼的正楼自己带 `isBuilding`，不能在第一个命中祖先停下。
5. **机位只有一份**：`GG.CONFIG.views`。按钮、键盘、`?view=` 全部从它推导，不要在 `app.js` 或 `index.html` 另写一套。
6. **形制分档**：和玺彩画 `MAT.caihuaHexi` 与 `cfg.hexi`；旋子 `MAT.caihua`。宫墙用 `createWall({ crenel: false, doubleCap: true })`；垛口只给内城/外城防御墙（`crenel: true`）。写反整圈宫墙会变成城墙。
7. **屋顶只支持四种**：`hip` / `xieshan` / `gable` / `pyramid`。角楼的十字歇山是两个 `roofGeometry` 正交拼合，不是 `style`；盝顶未实现，词条里不要写。
8. **时间轴**：`t = 0 / 1` 深夜，`0.25` 日出，`0.5` 正午，`0.75` 日落。这是 v2.2 之后的语义，旧基线不可直接比。

## 六、新增建筑构件的挂载位置

### 宫城建筑

在 `js/palace.js` 的 `GG.layout` 内，放进五段函数之一：`frontCourt()` → `palaces()` → `defenses()` → `environs()` → `scatterLayer()`。当前顺序不可调整，否则 `?seed=1` 的随机数流变化，截图基线全部失效。

```js
// 只在 GG.layout 内部可用；HALL 是局部辅助函数
HALL({
  x: 0, z: -520,
  w: 34, d: 20, h: 11, roofH: 8,
  style: 'xieshan',       // hip | xieshan | gable | pyramid
  tiers: 1, tierH: 1.4,
  double: false,
  eave: 2.2,
  plaque: '体元殿',
  info: {
    name: '体元殿',
    en: 'Hall of Primordial Origin',
    py: 'tiyuandian', pyi: 'tyd',
    cat: '西路', year: '清',
    form: '单檐歇山顶',
    desc: '……',
    note: '……',           // 可选
    rel: ['shoukanggong']  // 可选，key 必须存在
  }
});
```

`HALL()` 会调用 `GG.build.createHall()`，再走 `add()`：设置 `position` / `rotation.y`、把带词条的组推进 `REG`、`scene.add()`。不要在 `return REG` 前临时追加；新建筑放进对应分段函数，才能进入后续两遍静态合并。

### 自定义 Group / 城门 / 坛庙

- 没有导出的注册函数。要么在 `palace.js` 内调用 `add(scene, g, cfg)`，要么按 `add()` 的约定手工设置 `userData.isBuilding`、`userData.info`、`userData.labelY`，再 `REG.push(g)` 并 `scene.add(g)`。
- 城门、坛庙、三海走 `GG.city.build(scene, mark)`。第二个参数由 `palace.js` 注入；`city.js` 内部用 `mark(group, 'infoKey', labelY, radius)` 挂进 `REG`。
- 天坛在 `tiantan.js` 内先 `marks.push(group, 'infoKey', labelY, radius)`，再由 `GG.tiantan.build` 统一 flush。
- 四合院、连排、街巷是实例化/合并体块，不进索引。

### 树木与小件

- 城内树位写进 `GG.city.treeSpots`，由 `palace.js` 的 `scatterLayer()` 统一并进 `InstancedMesh`。
- `city.js` 与 `tiantan.js` 不消耗 `Math.random`：前者用独立 LCG，后者用整数哈希。新增内容也必须遵守，否则 `?seed=1` 下宫城树木会整体漂移。

## 七、几何、变换与静态合并

### `xform` 是几何变换的统一入口

```js
GG.geo.xform(geo, { x, y, z, rx, ry, rz, sx, sy, sz })
GG.geo.box(w, h, d, opts)   // 内部就是 xform(BoxGeometry, opts)
```

`xform` 会 `clone()` 输入几何再烘入矩阵，不改原几何。所有构件拼装、树木、栏杆柱、屋面瓦件都走它。不要对共享几何直接 `scale` / `rotate` / `applyMatrix4`，否则会改到所有引用者，也绕开统一合并管线。

### 合并管线

`app.js` 在 `GG.layout` 完成后按顺序执行：

```text
optimizeStatics(scene)      // 每个 Group 内部按材质 × 投影 × 受影 合并
mergeWorldStatics(scene)    // 不属于建筑的世界静态块跨组合并
bakeDawnEnvs()
```

约束：

- `mergeGroup` 只合直属子 Mesh，不递归；`InstancedMesh`、`ShaderMaterial`、`userData.noMerge` 不参与。
- `mergeWorldStatics` 跳过所有 `isBuilding` 祖先下的 Mesh，只合不透明、非材质数组的 `MeshStandardMaterial`，并按材质 × 投影 × 受影 × 是否有 `color` / `uv` 属性分桶；`InstancedMesh` / `ShaderMaterial` / `Points` 不参与。
- 新增静态内容要在 layout 内创建，才能进入两遍合并；在 merge 之后再加静态 Mesh 会绕过合批，直接抬高 draw call。
- 同类小构件优先 `GG.geo.merge()` 或 `InstancedMesh`，不要为每座建筑新建材质。

### 贴图与 UV

- 贴图单例：`GG.getTextures()`；匾额：`GG.getPlaque(text)`。新贴图加进 `textures.js` 的 `cache`，不要重复生成。
- 大盒子 / 墙面用 `GG.geo.fitUV()`；多实例共享一张贴图时，把平铺密度写进几何 UV，用 `GG.geo.uvScale()`。
- 不要加纵向渐变贴图：沿坡面会重复成条带。瓦面质感优先 bumpMap + 顶点色 AO。

## 八、材质与配置

- 材质单例在 `js/buildings.js` 的 `buildMaterials()` 里，暴露为 `GG.build.MAT`。新材质加进同一个 `MAT` 对象复用，不要在每座建筑里 `new MeshStandardMaterial`。
- 水面、天空是自定义 ShaderMaterial，各自单独成模块（`js/water.js`、`js/sky.js`），只建一份。
- 颜色、曝光、光照、雾、标签阈值、机位、屋顶参数都进 `GG.CONFIG`，不要在业务代码里散落常量。
- 屋顶参数是长期调出来的：`GG.CONFIG.roof` 当前为 `curv: 1.55`、`liftRatio: 0.042`、`hipTopFactor: 0.76`。改任何一项都必须附前后截图。
- Three.js r149 与 r150+ 有 API 差异；`renderer.js` 已显式设置 `ColorManagement.legacyMode = false`，不要删。

## 九、性能预算

性能目标：M4 真机 60fps。**60fps 是交接口径，仓库内没有正式帧率基线**（ROADMAP B16 明说未记录），需在真机 Chrome 用 `?stats=1` 当场复测，当前标为待确认。

运行时实测（2026-11-03，Apple M4 / ANGLE Metal，`tools/probe.sh`）：

| 口径 | draw call | 三角形 | 其他 |
| --- | --- | --- | --- |
| 探针默认 `view=capital` | 3146 | 场景总三角形 3,532,659 | 3311 mesh / 15 InstancedMesh（48,330 实例）/ 103 texture |
| `view=overview` | 2731 | 单帧渲染 3,331,134 | 同一场景，视锥裁剪后 |
| README 状态表 | 3146 | 3.53 M | 与 `capital` 实测一致 |

- 交接口径的 `2830 draw call / 2.97 M 三角形` 与当前 HEAD 实测不一致；draw call 与三角形随 `?view=`、窗口尺寸和视锥裁剪变化，比较时必须固定同一机位和窗口。该口径来自哪个机位待确认。
- 新增内容不得让同机位指标明显恶化。用 `tools/probe.sh stats` 或 `?stats=1` 做前后对照；出现数百 draw call 或数十万三角形的回退，必须在提交说明里给出理由并复测。
- 优先手段：共享 `MAT`、`GG.geo.merge()`、`InstancedMesh`、把静态块放进 layout 让两遍合并吸收。不要新增逐帧 `new Geometry` / `new Material` / 临时向量。
- 动态分辨率在 `GG.CONFIG.quality.drs`：低于 40fps 逐级降到 0.92 / 0.84，稳定到 58fps 以上再升回。它只救轻微掉帧，不能掩盖结构性的 draw call 增长。
- 已知无 LOD：远景始终全精度渲染，远景新增几何会直接计入三角形预算。

## 十、验证方式

### 先跑数据脚本

```bash
node tools/stats.js            # 词条 / 挂载 / 匾额 / 代码行数
node tools/stats.js --json     # 机器可读
node tools/stats.js --plaques  # 列出全部显式匾额
node tools/search-check.js     # 23 条搜索、分类、年代、导览、rel 断言
```

- 改 `js/data/info.js` 或 `palace.js` 的建筑挂载后，跑 `stats.js`；同步 README 状态表，不要手写数字。
- 改拼音、分类、导览站点或 `rel` 后，跑 `search-check.js`。失败会非零退出。
- `stats.js` 靠正则扫 `palace.js` / `city.js` / `tiantan.js` 的 `INFO.<key>`、`key: 'x'`、`mark(group, 'x')`、`marks.push(..., 'x')`。新增挂载写法后要同步脚本，否则会静默漏计。

### 运行时探针

```bash
tools/probe.sh pick     # 逐建筑投影 + 真实拾取路径，报告未命中
tools/probe.sh layers   # 实例化图层：数量、三角形、包围盒、可见性
tools/probe.sh stats    # mesh / 实例 / 三角形 / draw call / geo / tex
tools/probe.sh water    # 水面 ShaderMaterial 与 uniform 自检
tools/probe.sh city     # GG.city.stats：四合院、连排、胡同数量
tools/probe.sh fps      # 无头 rAF 帧率；虚拟时钟下不可信，只取 calls/tris
```

探针固定以 `../index.html?nofade=1&seed=1&still=1&view=capital` 载入 iframe；可用 `q=` 透传查询串，例如 `tools/probe.sh stats 'q=view%3Doverview'`。

### 截图回归

```bash
tools/shot.sh tools/after/head
python3 -m venv /tmp/venv-pillow
/tmp/venv-pillow/bin/pip install pillow
/tmp/venv-pillow/bin/python tools/diff.py tools/baseline/v2.1 tools/after/head --map /tmp/diffmap
open /tmp/diffmap
```

- 默认十机位：`capital overview axis taihe close inner garden shenwu top corner`，自动带 `?seed=1&nofade=1`。
- 重机位 `corner` 加 `still=1` 和 `#1500`：`tools/shot.sh out "corner:view=corner&still=1#1500"`。
- 本机快速回归：`ANGLE=metal tools/shot.sh ...`。Metal 与 SwiftShader 基线不能跨后端逐像素比。
- 当前基线只有 `tools/baseline/v0.9`、`v1.2`、`v2.1`；没有完整的 v2.2+ 基线。不要拿 v2.1 直接判 v2.3/天坛改动“通过”。
- `diff.py` 不设自动阈值。纯重构应 ≤0.01% RMSE；预期内改动应表现为差异集中在固定区域。

### 真机与控制台

```text
http://localhost:8931/?stats=1          # 看 fps / draw / tri / geo / tex / res / shdw
http://localhost:8931/?seed=1&still=1   # 固定种子 + 冻结动画，适合对照
http://localhost:8931/?nofade=1         # 隐藏加载层，截图专用
```

- `window.__dbg` 在布局完成后可用；`__dbg.stage.renderer.info` 可读 `render.calls` / `render.triangles`。
- `GG.errors` 收集脚本异常与 `unhandledrejection`；页面顶部出现红色错误浮层时先修它，不要只看加载层。
- 控制台无报错、`tools/probe.sh pick` 无未命中、`search-check.js` 全绿，是改内容后的最低门槛。

## 十一、易踩的坑

| 坑 | 现象 / 对策 |
| --- | --- |
| 调换脚本顺序 | 白屏。后加载模块依赖前面的 `window.GG`，尤其 `MAT.water`。 |
| 截图不加 `?seed=1` | 同版本连拍 RMSE 也有 3%–4%；贴图与树木用 `Math.random()`。 |
| 截图加 `--disable-gpu` | WebGL 上下文创建失败，页面停在加载层。软渲染用 `--use-angle=swiftshader --enable-unsafe-swiftshader`。 |
| 服务器用 HTTP/1.0 | 页面卡加载层，服务端全是 200。必须 `--protocol HTTP/1.1`。 |
| 多个 Chrome 并行截图 | profile 冲突，产出约 22 KB 假图。串行跑。 |
| `corner` 截图超时 | 满屏几何，动画等不到稳定帧。加 `still=1`、`#1500`、看门狗 300 s。 |
| 调整五段布局顺序 | `?seed=1` 随机流变化，全部截图基线失效。 |
| 在 `city.js` / `tiantan.js` 用 `Math.random` | 宫城树木与散布整体漂移。用独立 LCG / 整数哈希。 |
| 注册没名字的建筑 | 幽灵条目：点得到、打开空卡。必须 `isBuilding + info.name`。 |
| 每座建筑新建材质 | draw call 与 shader 编译暴涨。走 `GG.build.MAT`。 |
| 改了屋顶参数不附截图 | `curv` / `liftRatio` / `hipTopFactor` 是长期调参结果，回归很难靠肉眼复现。 |
| 在 merge 之后加静态 Mesh | 绕过合批，draw call 直接上涨。静态内容放进 layout。 |
| 把 `?still=1` 当暂停按钮 | 它冻结相机、导览、昼夜、云、水面与天候粒子，是截图确定性工具。 |
| 手改 README 数字 | 文档已漂移；先跑 `tools/stats.js` / `tools/probe.sh` 再改。 |

## 十二、代码风格

- 2 空格缩进，语句结尾加分号；`const` / `let`，不用 `var`。
- 注释写“为什么”，不写“是什么”。现状注释已大量解释取舍，改动时保留有用的“为什么”。
- **删除死代码，避免冗余**：改完顺手清掉不再引用的函数、变量、CSS 与注释；不要留“以后可能用”的分支。
- 单一数据源：机位进 `CONFIG.views`，配置进 `CONFIG`，词条进 `info.js`，路线进 `tour.js`，材质进 `MAT`，贴图进 `getTextures()`。不要在第二个地方复制一份。
- 新界面文案必须双语：静态节点写 `data-zh` / `data-en`（标题类再加 `data-title-zh` / `data-title-en`），JS 用 `GG.i18n.t(zh, en)`；新增控件补 `aria-label` / `aria-pressed`，并同步 `docs/accessibility.md`。
- 不引入 UI 框架、CSS 预处理器、构建链或第二份 Three.js；优先用现有 `GG.geo` / `GG.build` / `MAT` / `InstancedMesh`。
- 改渲染相关代码，按 [docs/dev-tooling.md](docs/dev-tooling.md) 跑截图回归；改内容数据，跑 `search-check.js` 与 `stats.js`。

## 十三、待确认

以下为仍未闭合的口径；已校准项见 README 与 docs/architecture.md。

- **60fps**：交接口径，仓库没有正式帧率记录（ROADMAP B16）；需真机 `?stats=1` 复测。
- **2830 draw call / 2.97 M 三角形**：与当前 HEAD 实测（`capital` 3146 / 3.53 M，`overview` 2731 / 3.33 M）不符；来源机位待确认。
- **截图基线**：`tools/baseline` 只有 v0.9 / v1.2 / v2.1；v2.2 未归档，v2.3+ 没有完整基线。
- **版本号**：最新 tag 是 v2.3；HEAD 含未发布五轮内容。`docs/architecture.md` 标“v2.4–v2.5（未发版）”，与 README 的 v2.3 状态并存，以 CHANGELOG 未发布条目为准。

CHANGELOG 的历史条目仍保留当时的 1928 / 8364 / 577 与 1600+ 行，是版本记录，不是现状；引用现状以 README、`tools/probe.sh city` 与 `node tools/stats.js` 为准。
