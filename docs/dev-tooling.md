# 开发工具与截图回归

> 适用版本：v2.4。只讲“怎么验”，不讲架构与产品。
> 架构见 [architecture.md](architecture.md)。

---

## 一、截图回归是什么

这个项目没有单元测试，渲染改动的客观依据只有一条：**同一批机位、同一随机种子，改动前后逐像素比对**。

工具链两个脚本：

| 脚本 | 作用 |
| --- | --- |
| `tools/shot.sh` | 自起静态服务器，用无头 Chrome 逐机位出图 |
| `tools/diff.py` | 比对两个目录的同名 PNG，输出 RMSE 与差异图 |

---

## 二、基本流程

```bash
# 1. 给当前代码出图（务必带 seed，脚本默认已加）
tools/shot.sh tools/after/head

# 2. 与基线比
tools/diff.py tools/baseline/v2.1 tools/after/head --map /tmp/diffmap

# 3. 看差异图，确认只出现在预期位置
open /tmp/diffmap
```

**判据**：数值不是唯一标准。预期内的改动（例如只改了水面）应当表现为“差异集中在固定区域”；如果差异散布全图，先怀疑随机种子或加载未完成。

---

## 三、`shot.sh`

```bash
tools/shot.sh [输出目录] [名称:查询串] ...
```

不带参数时输出十机位到 `tools/shots/`：

```
capital overview axis taihe close inner garden shenwu top corner
```

自定机位与查询串：

```bash
tools/shot.sh tools/after/v2.2 "corner_dusk:view=corner&time=dusk"
tools/shot.sh out "corner:view=corner&still=1#1500"     # # 后为该张的虚拟时间预算（ms）
ROOT=/path/to/old-copy tools/shot.sh tools/baseline/v2.0  # 给旧代码目录截图
```

### 夜景与天候出图

`?time` 现在是 0/1 深夜、0.25 日出、0.5 正午、0.75 日落。夜景区间是 `t < 0.25` 与 `t > 0.75`，用 `time=night` 直接取 `t=0`。

```bash
# 夜景：星空、月轮、宫灯、窗纸
tools/shot.sh tools/after/night \
  "overview:view=overview&time=night" \
  "axis:view=axis&time=night" \
  "garden:view=garden&time=night"

# 三套天候（各出九机位，或只出三张代表机位）
tools/shot.sh tools/after/snow "axis:view=axis&weather=snow" "overview:view=overview&weather=snow"
tools/shot.sh tools/after/rain "axis:view=axis&weather=rain"
tools/shot.sh tools/after/autumn "axis:view=axis&weather=autumn"
```

天候粒子在 `still=1` 下位置固定，但不影响 `seed=1` 的确定性：粒子随机数走独立 LCG，不消耗 `Math.random`，所以同一 `seed` 下几何与贴图仍可复现。

### 阴影模式

`shot.sh` 不需要额外参数：页面检测到 SwiftShader 会自动用 `PCFShadowMap`（硬边），否则用 `PCFSoftShadowMap`。若要在真机上复现截图效果，加 `?shadow=hard`。

### 京师视野扩大后（v2.4）

场景从 1.5 km 扩到 8 km，SwiftShader 下一帧要几秒，九机位跑不完。本机切 Metal 后端：

```bash
ANGLE=metal NOSANDBOX=1 tools/shot.sh tools/after/head "overview:view=overview&still=1"
```

- `ANGLE=metal` 用 GPU 后端，出图快十倍以上；**不能和 SwiftShader 基线跨后端对比**。
- `NOSANDBOX=1` 只在 WorkBuddy 沙箱里需要；普通终端可以不加。
- `capital` 已加入默认机位；`overview` 现在取皇城 + 内城。
- 截图 URL 会自动带 `nofade=1`，加载层直接隐藏（0.9s CSS 淡出不跟虚拟时间）。

### 可调环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `ROOT` | 脚本上一级目录 | 页面根目录，给旧快照截图时用 |
| `CHROME` | 自动探测 | macOS 常见路径 + Chromium + Edge |
| `SIZE` | `1600,1000` | 视口尺寸 |
| `BUDGET` | `6000` | 单张虚拟时间预算（ms） |
| `WATCHDOG` | `170` | 单张墙钟超时（秒） |
| `MIN_BYTES` | `100000` | 小于此体积判为加载页 |
| `STILL` | `0` | `1` 时额外冻结相机与云层 |
| `SEED` | `1` | `1` 时追加 `?seed=1` |
| `CHECK` | `1` | `1` 时先 `--dump-dom` 预检 JS 错误 |
| `REUSE` | `0` | `1` 时复用已运行的服务器 |
| `ANGLE` | `swiftshader` | 渲染后端；`metal` 走本机 GPU |
| `NOSANDBOX` | `0` | `1` 时给 Chrome 加 `--no-sandbox` |

### 脚本已经处理的事

1. **自起服务器并带 `--protocol HTTP/1.1`**。python 默认 HTTP/1.0，Chrome 复用连接会被抢断，一半脚本报 `ERR_CONNECTION_RESET`，截出来是加载页，而服务端日志全是 200。
2. **`--dump-dom` 预检**。页面有 JS 错误时提前退出，不浪费一轮出图。
3. **体积闸门**。加载页固定约 22 KB，正常场景图 1.6–2.1 MB，小于 100 KB 直接判失败。
4. **串行执行**。同一时刻只允许一个无头 Chrome，共用 profile 会互相打架。
5. **看门狗**。Chrome 偶尔不退出，单张超时后强杀并记为失败。

---

## 四、必须知道的坑

| 坑 | 现象 | 原因与对策 |
| --- | --- | --- |
| 不加 `--seed=1` | 同一版本连拍两次 RMSE 也有 3%–4% | 贴图与树木散布用 `Math.random()`；固定种子后降到 0.01% |
| 加 `--disable-gpu` | 页面停在“起 基” | WebGL 上下文创建失败。软渲染要的是 `--use-angle=swiftshader --enable-unsafe-swiftshader` |
| `corner` 机位出不来 | 100 s 超时也不出图 | 满屏几何，动画开着等不到稳定帧。加 `still=1` 并把预算降到 `#1500`，看门狗给到 300 s |
| 多个 Chrome 并行 | 产出 22 KB 假图 | profile 冲突。串行跑，或每张换 `--user-data-dir` |
| 服务器用 HTTP/1.0 | 页面卡在加载层 | 见上，必须 `--protocol HTTP/1.1` |

`?still=1` 冻结的是：相机、导览推进、昼夜流转、云层与水面动画。它是截图确定性的基础，不是“暂停按钮”。

---

## 五、`diff.py`

```bash
python3 -m venv /tmp/venv-pillow
/tmp/venv-pillow/bin/pip install pillow
/tmp/venv-pillow/bin/python tools/diff.py tools/baseline/v2.1 tools/after/head --map /tmp/diffmap
```

pillow 不进项目依赖，用临时虚拟环境即可。

| 参数 | 作用 |
| --- | --- |
| 位置参数 1 | 基线目录 |
| 位置参数 2 | 待测目录 |
| `--map DIR` | 输出差异放大 8 倍的图，用于定位 |

输出为每张图的 RMSE（全分辨率，0–100%）。经验判据：

| 改动类型 | 预期 RMSE |
| --- | --- |
| 纯重构、无视觉变化 | ≤ 0.01% |
| 只改局部（水面、某个界面元素） | 差异集中在固定区域，diff map 可解释 |
| 改了光照、雾、色调映射 | 全图变化，必须逐张人眼确认 |

**diff.py 不设自动阈值**。这是有意的：阈值会让“看起来变了但数值很小”的回归溜过去，也会把“预期内的大改”误判为失败。数值只用来排序，结论靠差异图。

---

## 六、基线规范

- 目录命名与 tag 一致：`tools/baseline/<tag>/`。
- 文件命名与机位 id 一致：`overview.png`、`corner.png`……
- 每个基线必须**九张齐全**才可用于回归。缺图的基线只能做单机位对照。
- 截图必须带 `?seed=1`；给旧代码截图时通过 `ROOT=` 指向对应快照目录。

### 当前基线状态

| 基线 | 张数 | 状态 |
| --- | --- | --- |
| `v0.9` | 9 | 完整 |
| `v1.2` | 9 | 完整 |
| `v2.0` | — | 未归档。当时只出了 2 张（`axis` / `taihe`），不足以做回归，已移出仓库；需要时按下面的 `worktree` 方式从 tag 重建 |
| `v2.1` | 7 | 缺 `overview` / `close`；作为 v2.2 的对比基准时缺两张 |
| `v2.2` | 0 | **待生成**。v2.2 改了时间轴与阴影模式，v2.1 的图与新代码不再可比 |

> **重要**：v2.2 把 `t` 的语义从“日出到日落”改成“深夜到深夜”，同一 `?time=0.5` 仍是正午，但 `time=0.9` 从“接近日落”变成“入夜”。跨 v2.1 / v2.2 对比截图时必须显式写 `time=noon`，不要用默认值碰运气。
>
> 另外 v2.2 新增宫灯与窗纸自发光，即使 `time=noon`（强度为 0）也新增了 16 组实例几何，与 v2.1 的差异不可能只落在“预期位置”。v2.2 的基线应重新生成，不与 v2.1 逐像素对比。

v2.1 的七张来自 2026-10-19 的回归出图（`tools/shots/post/`），单独截 `overview` 与 `close` 时无头 Chrome 在软件渲染阶段被系统终止，未完成。**如果只为 v2.2 建立回归基准，不必补这两张**：v2.2 的时间轴、阴影与几何都变了，应当直接生成 `tools/baseline/v2.2` 九张。

```bash
tools/shot.sh tools/baseline/v2.2
```

单版基线约 15 MB。仓库只保留“最近一个完整基线 + 两个历史基线”，更早的按需从 tag 重新生成，不长期堆积。

### 从旧 tag 重建基线

```bash
git worktree add /tmp/palace-v2.0 v2.0
ROOT=/tmp/palace-v2.0 tools/shot.sh tools/baseline/v2.0
git worktree remove /tmp/palace-v2.0
```

用 `worktree` 而不是 `checkout`，避免把当前未提交的改动带走。

---

## 七、事实统计与纯函数自测

文档里的词条数、挂载数、匾额数一律由脚本生成：

```bash
node tools/stats.js            # markdown 表格，可直接贴进 README
node tools/stats.js --json     # 机器可读
node tools/stats.js --plaques  # 列出全部显式匾额
```

改了 `info.js` 或 `palace.js` 的建筑挂载后跑一次，再同步 README 的“当前状态”表。这是防止文档数字再次漂移的唯一手段。

搜索与导览的数据规则用另一个脚本兜底：

```bash
node tools/search-check.js
```

23 条断言，覆盖：

- 拼音命中（`taihe` / `thd` / 中文）
- 分类过滤六个分类的条数
- 年代过滤（明 58 / 清 24）
- 关键词 + 分类 + 年代的组合条件
- 两条导览线的站点是否都有对应词条、字幕是否齐全
- `py` / `pyi` 是否补齐、`rel` 引用是否悬空

改 `info.js` 的拼音或 `tour.js` 的站点后必跑。失败会以非零码退出，可以挂进提交前检查。

---

## 八、运行时探针

截图只能证明“画面变了”，证明不了“点得到”。`tools/probe.html` 把主页面装进同源 iframe，
等 `window.__dbg` 就绪后在**页面内部**跑断言，结果写进 DOM，由 `--dump-dom` 读回：

```bash
tools/probe.sh pick     # 逐个建筑近距离投影 + 拾取，报告未命中项
tools/probe.sh layers   # 实例化图层：谁在渲染、数量、包围盒
tools/probe.sh stats    # mesh / 实例 / 三角形 / draw call 总量
tools/probe.sh water    # 水面材质自检：新版着色器是否加载、uniform 是否被写入
tools/probe.sh city     # GG.city.stats：四合院与街巷规模
```

`pick` 用的是页面自己的 `picker.pickAt`，与真实点击同一条路径；相机被搬到每个建筑
斜上方 3.2 倍半径处，避免远景射线被前景挡住造成的假阴性。

**为什么不用 headless 的 rAF 测帧率**：虚拟时钟下 `requestAnimationFrame` 与
`performance.now()` 对不上，采样不出有效数字。帧率只能在真机窗口里用 `?stats=1` 读。

**探针必须在结束时掐掉 iframe 的 rAF**。`--virtual-time-budget` 只在页面空闲时才推进
虚拟时钟，而主循环每帧吃掉 16 ms 虚拟时间；场景变重之后一帧要几十毫秒，预算迟迟用不完，
`--dump-dom` 就一直不返回（表现为探针"卡死"、看门狗报警）。`probe.html` 的 `finally`
里把 `requestAnimationFrame` 换成立即返回的空函数，时钟立刻走完，一次探针从 100 s 降到 3 s。

`window.__dbg` 由 `app.js` 在布局完成后挂出（`stage` / `orbit` / `registry` / `picker` /
`labels` / `views` / `ui` / `GG` / `THREE`），只在调试时使用，不参与渲染。

---
