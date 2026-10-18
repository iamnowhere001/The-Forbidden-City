# 紫禁城 · 故宫 3D 交互展示

> 纯静态、零外部依赖、可离线的紫禁城三维交互场景。整座宫城由代码在运行时程序化生成——仓库里没有一张外部模型或贴图素材。

**一句话**：以米为单位的 1:1 紫禁城三维复原展示，覆盖中轴、前朝两翼、东西六宫、御花园、城墙角楼、护城河与景山，支持自由漫游、九组预设机位、建筑词条与连续日照。

后续版本规划见 [ROADMAP.md](./ROADMAP.md)。

---

## 一、项目简介

这是一个面向公众的建筑科普型三维展示，不是游戏。目标很具体：**让人看懂紫禁城的格局，并能点开每一座殿读它的来历。**

三个设计底线决定了技术选型：

| 底线 | 结果 |
| --- | --- |
| 双击 `index.html` 就能跑 | 用经典 `<script>` 而非 ES Module，规避 `file://` 的 CORS 限制 |
| 断网可用、零外部请求 | Three.js 以本地副本放在 `js/vendor/`，不接 CDN |
| 不引入额外依赖 | 轨道控制器自写，不用 `OrbitControls` 等 addon |

场景尺度是真实米制：宫城南北墙间距 960 米、东西 752 米（`WALL_Z = 480`、`WALL_X = 376`），中轴线上午门在 `z = 452`、神武门在 `z = -462`；太和殿按面阔 64 米、通高 35 米建。

---

## 二、核心功能

### 1. 程序化建筑建模

所有建筑都是参数化 `BufferGeometry`，不是导入模型。

- **五种屋顶形制**：庑殿（`hip`）、歇山（`xieshan`）、悬山（`gable`）、攒尖（`pyramid`）、盝顶，另有角楼用的十字歇山。
- **举折曲线 + 翼角起翘**：屋面按 `curv = 1.55` 生成凹曲剖面，四角按 `|u|^11` 抬升，檐口自然上扬。
- **重檐结构**：`double: true` 时屋身分上下两段（0.6 / 0.4 高度），上层宽度收至 0.72，形成真实的重檐层次。
- **完整构件链**：台基（可多层）、汉白玉栏板、踏跺、柱列、斗拱环、椽头、瓦垄、垂脊、走兽、匾额。
- **殿额匾**：20 座主要殿宇显式挂匾，六宫 12 院正殿按词条名自动生成，合计 32 块，Canvas 绘制蓝底金字 + 回纹角。
- **陈设小品**：太平缸、铜鹤、日晷，太和殿广场的品级山 18 座与云龙御路石雕。

### 2. 程序化贴图（Canvas 2D 实时绘制）

`js/textures.js` 在运行时画完所有贴图，再包成 `CanvasTexture`：

琉璃瓦（含独立灰度 bumpMap）、绿琉璃、汉白玉、铺地、朱红宫墙、菱花隔扇、彩画、斗拱、椽头、金砖、御路石雕、水面、草地、云、匾额。

尺寸单位与瓦垄对应关系经过校准：瓦垄 UV 约 `x / 9.6`，即 1.2 米一垄。

### 3. 场景布局

- 中轴建筑群：午门、太和门、三大殿、乾清门、后三宫、御花园、神武门。
- 前朝两翼：体仁阁、弘义阁、文华殿、武英殿。
- 东西六宫共 12 座两进院落（景仁宫、承乾宫、钟粹宫、延禧宫、永和宫、景阳宫 / 永寿宫、翊坤宫、储秀宫、启祥宫、长春宫、咸福宫）。
- 御花园：钦安殿、万春亭、千秋亭、堆秀山与御景亭。
- 城墙、四座角楼、护城河、景山与 18 座远山。
- 松柏用 `InstancedMesh` 散布并做色彩抖动。

当前共 **25 条建筑词条**，24 处挂载到场景实体，点击或点标签即可打开信息卡。

### 4. 渲染管线

| 环节 | 做法 |
| --- | --- |
| 色彩 | `ColorManagement.legacyMode = false`（r149 必须显式关闭，否则 hex 被当线性值，画面整体发灰） |
| 色调映射 | `ACESFilmicToneMapping`，曝光 `0.82 + k × 0.06` |
| 环境光 | `PMREMGenerator` 从程序化天空场景烘出环境贴图，材质按 `envMapIntensity` 归一（未显式设置的压到 0.22） |
| 天空 | 单 pass 片元着色器：垂直渐变 + 日轮 + 4×4 octave FBM 云 + 地平线灰霾，穹顶每帧跟随相机 |
| 雾 | `FogExp2`，密度 `0.00026`，颜色与天空 haze 同步，天地无缝 |
| 阴影 | `PCFShadowMap`，4096×4096，正交相机覆盖 ±760 / ±820 |
| 屋面体积 | 屋顶几何输出顶点色 AO（檐口压暗 36%，垄脊略亮） |

> `PCFSoftShadowMap` 在软件渲染（SwiftShader）下不出影，为保证兼容选用 `PCFShadowMap`。

### 5. 交互能力

- **自写轨道控制器**：球坐标 + 阻尼插值 + 双指捏合 + 右键平移，`minR 26 / maxR 1700`。
- **拾取高亮**：`Raycaster` 命中建筑组，懒克隆材质改 `emissive`，避免重编译 shader。
- **DOM 标签系统**：世界坐标投影 → 矩形避让 → 优先级 + 距离双过滤，选中项永远置顶。
- **九组机位**：全景、中轴、太和殿广场、太和殿、后三宫、御花园、神武门、东南角、俯瞰，切换走二次贝塞尔抬升的弧线飞行（1.6 秒）。
- **连续日照**：一根滑块从晨到暮，同步插值太阳方位角、色温、强度、天空色、雾色与曝光。
- **信息卡**：聚焦、上一座、下一座，形成浏览闭环。
- **辅助**：侧栏建筑索引、自动旋转、分阶段加载文案与进度条。

### 6. 兼容与调试

- 响应式断点：≤1080px 收起侧栏，≤720px 信息卡改为底部抽屉、视角按钮下移。
- URL 参数直链与调参（见「使用示例」）。
- 页面顶部内置运行时错误浮层，异常信息不会被浏览器吞掉。

---

## 三、技术栈

| 层面 | 选型 | 说明 |
| --- | --- | --- |
| 渲染引擎 | **Three.js r149**（本地副本，594 KB） | 2023 年版本；API 与 r150+ 有差异，升级需回归 |
| 语言 | 原生 JavaScript（ES2017+），IIFE + `window.GG` 命名空间 | 无 TypeScript、无打包器 |
| 着色器 | GLSL ES（天空 / 云） | 内联于 `app.js` 的 `ShaderMaterial` |
| 贴图 | Canvas 2D → `THREE.CanvasTexture` | 全部运行时生成 |
| 样式 | 原生 CSS（自定义属性 + 媒体查询） | 无预处理器、无 UI 框架 |
| 构建 | **无** | 没有 `package.json`、`npm install`、`vite` |
| 运行环境 | 现代浏览器（WebGL 1.0+） | Chrome / Edge / Safari 15+ / Firefox |
| 依赖管理 | 手工 vendoring | 依赖只有 Three.js 一个 |

**为什么不加构建链**：这个项目的价值在于"打开即看"。引入打包器会让部署、调试、二次修改的成本都上升，而当前 4 千行代码用 IIFE 分层已经足够清晰。若后续要做多语言或路线系统，再评估是否引入轻量构建。

**运行开销参考**：首屏需在内存里生成全部贴图与几何，桌面 Chrome 通常 1–2 秒完成（视设备而定）；显存开销以 4096×4096 阴影贴图与各张贴图 mipmap 为主。

---

## 四、安装与运行

### 环境要求

- 任意现代浏览器，**开启硬件加速**（WebGL 必需）。
- 无需 Node.js、Python 或任何包管理器——项目没有依赖安装步骤。

### 方式一：直接打开（推荐给普通浏览）

```bash
open index.html          # macOS
# 或在文件管理器中双击 index.html
```

已在 Chrome 下验证 `file://` 协议可正常运行。若你的浏览器对本地文件限制较严（如部分 Firefox 配置），改用方式二。

### 方式二：本地静态服务器

```bash
cd "/Users/yongxu/Documents/code/2026-10-18 game"
python3 -m http.server 8931
```

浏览器访问 <http://localhost:8931>。

也可以用任意静态服务器，例如：

```bash
npx serve . -l 8931
```

### 方式三：截图回归（开发用）

`tools/shot.sh` 会自己起服务器、逐机位出图，默认带上 `?seed=1` 固定随机数：

```bash
tools/shot.sh tools/after/v1.0          # 输出到指定目录
tools/diff.py tools/baseline/v0.9 tools/after/v1.0
```

`shot.sh` 自动探测 Chrome 路径（本机可能装在 `/Applications/Chrome.app`）。手动跑单张时注意：

1. **不能加 `--disable-gpu`**，否则 WebGL 上下文创建失败，页面只会停在"起 基"。
2. 必须带 `--use-angle=swiftshader --enable-unsafe-swiftshader`。
3. 软件渲染下出图较慢，用 `--virtual-time-budget` 给足时间；脚本里已有看门狗。

**为什么必须固定种子**：贴图和树木散布都用 `Math.random()`，同一版本连拍两次，全分辨率 RMSE 也有 3%~4%。加 `?seed=1` 后降到 0.01%，才看得出真实回归。

```bash
"/Applications/Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1600,1000 --virtual-time-budget=20000 \
  --screenshot=/tmp/palace.png \
  "http://127.0.0.1:8931/?view=overview&seed=1"
```

---

## 五、目录结构

```text
2026-10-18 game/
├── index.html              # 页面骨架、DOM 界面、脚本加载顺序
├── README.md               # 本文件
├── ROADMAP.md              # 迭代计划（阶段、里程碑、风险）
├── css/
│   └── style.css           # 全部界面样式（暗色宫墙调 + 响应式）
├── js/
│   ├── vendor/
│   │   └── three.min.js    # Three.js r149 本地副本（594 KB）
│   ├── debug.js            # 错误浮层 + URL 参数 + 可复现随机种子
│   ├── config.js           # 全局配置：颜色、光照、标签阈值、机位表
│   ├── sky.js              # 天空穹顶着色器
│   ├── orbit.js            # 轨道控制器
│   ├── renderer.js         # 渲染舞台：渲染器、相机、光照、雾、日照插值
│   ├── views.js            # 机位表 → 按钮 / 飞行 / 直链落位
│   ├── labels.js           # DOM 标签：投影、避让、过滤
│   ├── picking.js          # 拾取、悬停高亮、地面光圈
│   ├── ui.js               # 侧栏索引 + 信息卡
│   ├── textures.js         # 程序化贴图工厂，Canvas → CanvasTexture
│   ├── geo.js              # 参数化几何：屋顶、垂脊、台基、栏板、踏跺、柱列、斗拱
│   ├── buildings.js        # 建筑装配：殿堂、城门楼、亭、连廊、墙、树、铜陈设
│   ├── palace.js           # 总平面布置 + 建筑词条数据 INFO
│   └── app.js              # 主编排：初始化、事件、URL 参数、主循环
├── tools/
│   ├── shot.sh             # 九机位截图（无头 Chrome + 固定种子）
│   └── diff.py             # 截图回归比对
└── .workbuddy/
    └── memory/             # 开发日志（参数、踩过的坑、验证方法）
```

### 模块职责与对外接口

| 文件 | 职责 | 对外暴露 |
| --- | --- | --- |
| `debug.js` | 尽早安装错误浮层；解析 URL 参数；`?seed=1` 固定随机数 | `GG.query`、`GG.debug` |
| `config.js` | 所有可调参数的单一来源 | `GG.CONFIG` |
| `sky.js` | 单 pass 天空材质与穹顶 | `GG.createSky(C, sunDir)` |
| `orbit.js` | 球坐标轨道控制、阻尼、触控、平移 | `GG.Orbit`、`syncFromCamera()` |
| `renderer.js` | 渲染器、相机、环境贴图、光照、雾、`setSun(t)` | `GG.Stage` |
| `views.js` | 从 `GG.CONFIG.views` 生成按钮，管理飞行与落位 | `GG.Views`（`set` / `applyInstant` / `flyTo`） |
| `labels.js` | 标签 DOM、投影、避让 | `GG.Labels`（`build` / `update` / `invalidate`） |
| `picking.js` | Raycaster 拾取、高亮、光圈 | `GG.Picker`（`pickAt` / `setHover`） |
| `ui.js` | 侧栏索引与信息卡 | `GG.UI`（`build` / `show` / `hide`） |
| `textures.js` | 生成并缓存全部贴图 | `GG.getTextures()`、`GG.getPlaque(text)` |
| `geo.js` | 几何生成原语，不碰材质 | `GG.geo.{ roofGeometry, gableGeometry, ridgeGeometry, terraceGeometry, railingGeometry, stairsGeometry, columnRing, dougongRing, fitUV, merge, box, xform, lerp }` |
| `buildings.js` | 把几何 + 材质组装成建筑组 | `GG.build.{ createHall, createGateTower, createPavilion, createCorridor, createWall, createBronzeSet, treeGeometries, buildMaterials, MAT }` |
| `palace.js` | 决定"什么建筑放在哪" | `GG.layout(scene)`、`GG.INFO`、`GG.REGISTRY` |
| `app.js` | 编排初始化与主循环，自执行 | 无导出 |

### 三条硬约束

1. **脚本顺序不可乱**：`debug → config → three → sky → orbit → renderer → views → labels → picking → ui → textures → geo → buildings → palace → app`。后面的模块依赖前面挂在 `window.GG` 上的对象，调换会直接白屏。
2. **建筑组靠 `userData` 进入索引**：`isBuilding = true` 才会被 `GG.layout` 收进 `REGISTRY`；`info` 决定标签与信息卡；`labelY` 决定标签高度。三者缺一，建筑就是"模型"而不是"可交互对象"。
3. **坐标系**：`X` 向东为正，`Z` 向南为正，`Y` 向上，单位米。中轴在 `x = 0`。

---

## 六、使用示例

### 1. 交互速查

| 操作 | 鼠标 / 触控 | 键盘 | 界面 |
| --- | --- | --- | --- |
| 旋转 | 左键拖拽 / 单指拖动 | — | — |
| 缩放 | 滚轮 / 双指捏合 | — | — |
| 平移 | 右键或 Shift + 拖拽 | — | — |
| 切换机位 | — | `1`–`9` | 右侧按钮组 |
| 查看建筑 | 点击建筑或标签 | — | 左侧索引项 |
| 复位 | — | `R` | 「复位」 |
| 自动旋转 | — | `Space` | 「旋转」 |
| 关闭信息卡 | — | `Esc` | 卡片右上角 × |
| 显示全部标签 | — | — | 「标注」 |
| 日照时刻 | — | — | 底部滑块 |

九组机位与键位对应：`1` 全景、`2` 中轴、`3` 广场、`4` 太和殿、`5` 后三宫、`6` 御花园、`7` 神武门、`8` 俯瞰、`9` 东南角。

### 2. URL 参数

所有参数可组合，适合做外部链接与调试对照。

| 参数 | 取值 | 作用 |
| --- | --- | --- |
| `view` | `overview` / `axis` / `taihe` / `close` / `detail` / `inner` / `garden` / `shenwu` / `top` / `corner` | 直达机位，跳过飞行动画（`detail` 无按钮，仅直链可用） |
| `select` | 建筑中文名，如 `太和殿` | 到达后自动打开该建筑信息卡（需与 `view` 同用） |
| `time` | `dawn` / `noon` / `dusk` / `0`–`1` | 初始日照时刻 |
| `pos` | `x,y,z` | 直接指定相机位置 |
| `tgt` | `x,y,z` | 指定相机注视点（配合 `pos`） |
| `exposure` | 浮点数，如 `0.9` | 曝光倍率，覆盖默认值 |
| `sunmul` | 浮点数，如 `1.2` | 太阳强度倍率 |
| `seed` | `1` | 固定 `Math.random` 种子，截图回归用 |
| `still` | `1` | 冻结相机、云层与水面动画，单版本自查用 |

示例：

```text
http://localhost:8931/?view=close&select=太和殿&time=dusk
http://localhost:8931/?pos=0,80,300&tgt=0,30,150&exposure=1.1
```

### 3. 代码示例：加一座殿

在 `js/palace.js` 的 `GG.layout` 内部，用 `HALL()` 是最省事的方式——它会自动处理定位、注册与索引：

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
    en: 'Hall of Primal Origin',
    cat: '西路',
    year: '清',
    desc: '……'
  }
});
```

若用底层的 `GG.build.createHall(cfg)`，需要自己定位、`scene.add(group)`，并经 `palace.js` 内部的 `add()` 注册，否则建筑不会被索引与拾取。

### 4. 代码示例：加一个机位

机位定义在 `js/app.js` 的 `VIEWS` 对象里，形如：

```js
const VIEWS = {
  // p = 相机位置 [x,y,z]，t = 注视点 [x,y,z]
  myView: { p: [180, 60, 240], t: [0, 20, 120], name: '东南望' }
};
```

三处需要同步，缺一处就会出现"按钮点了没反应"或"键位错位"：

1. `js/app.js` → `VIEWS` 增加条目；
2. `js/app.js` → 键盘映射 `map` 增加数字键；
3. `index.html` → `<nav id="views">` 增加带 `data-view="myView"` 的按钮。

### 5. 代码示例：加一张贴图

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

使用时通过 `GG.getTextures().myTex` 取，缓存是单例，不要重复生成。

---

## 七、贡献指南

### 仓库状态

当前目录**尚未初始化 Git**。建议先补上版本控制，否则改动没有回退点：

```bash
cd "/Users/yongxu/Documents/code/2026-10-18 game"
git init
printf '.DS_Store\nnode_modules/\n*.log\n' > .gitignore
git add . && git commit -m "chore: 初始化仓库，导入 v0.9 基线"
```

### 分支与提交

- 分支：`main` 保持可运行，功能走 `feat/xxx`，修复走 `fix/xxx`。
- 提交信息用 Conventional Commits：`feat: 增加体元殿`、`fix: 修正垂脊曲线控制点`、`perf: 合并静态小构件`、`docs:`、`refactor:`。

### 代码约定

- **缩进 2 空格**，语句结尾加分号，与现有风格保持一致。
- **不用 ES Module**，新模块继续用 IIFE 挂 `window.GG`，否则 `file://` 下会失效。
- **不新增外部运行时依赖**。确有必要时，先在 issue 里说明体积与离线影响。
- **材质走单例**：新材质挂到 `buildMaterials()` 的 `MAT` 里复用，不要在每个建筑里 `new MeshStandardMaterial`。
- **几何用完即弃但要合并**：同类小构件优先 `GG.geo.merge()` 或 `InstancedMesh`，控制 draw call。
- **屋顶参数慎改**：`GG.CONFIG.roof` 里的 `curv 1.55`、翼角 `lift = min(hw,hd) × 0.024`、庑殿推山系数 `0.76` 是长期调出来的结果。改动必须附前后截图对比。
- **可调参数进配置**：颜色、曝光、光照强度、标签阈值、机位都放 `GG.CONFIG`，不要在模块里硬编码。
- **改了渲染相关代码就跑一遍回归**：`tools/shot.sh tools/after/xxx` + `tools/diff.py tools/baseline/v0.9 tools/after/xxx`。
- **贴图不要加纵向渐变**：沿坡面会重复成条带。瓦面质感优先用 bumpMap 与顶点色 AO 表达。

### 改动自查清单

提交前逐项确认：

- [ ] Chrome 桌面端能正常加载，控制台无报错。
- [ ] 九组机位切换正常，飞行结束无抖动。
- [ ] 新增建筑可被点击、可被索引、标签高度正确。
- [ ] 1080px 与 720px 两个断点布局无溢出。
- [ ] 移动端单指旋转、双指缩放可用。
- [ ] 帧率无明显下降（桌面目标 60 fps）。
- [ ] 附上改动前后的截图。

### 已知限制

| 限制 | 影响 | 备注 |
| --- | --- | --- |
| 建筑布局集中在一个 925 行函数 | 改一处要通读上下文 | 计划按区域拆函数（阶段二） |
| 截图回归依赖 SwiftShader | 与真机渲染有细微差异 | 只能验证"没变"，不能验证真机观感 |
| 无单元测试 | 逻辑回归靠截图 | 渲染路径已覆盖，纯函数未覆盖 |
| 无 LOD | 远景仍按全精度渲染 | 移动端帧率受限的主因之一 |
| Three.js r149 | 较旧，`outputEncoding` 等 API 已在新版废弃 | 升级需整体回归 |
| 词条文案部分共用模板 | 六宫 12 院描述雷同 | 阶段三逐座改写 |

---

## 八、版权与致谢

- 渲染引擎：[Three.js](https://threejs.org/) r149，MIT License，版权归 Three.js Authors。
- 建筑名称、年代与简介参考公开史料整理，用于科普示意，**不是测绘级复原**，形制细节存在简化。
- 本项目尚未添加 `LICENSE` 文件，默认保留所有权利。若计划开源，建议补一份 MIT 许可证并在仓库中声明。
