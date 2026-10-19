# 开发工具与截图回归

> 适用版本：v2.1。只讲“怎么验”，不讲架构与产品。
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

不带参数时输出九机位到 `tools/shots/`：

```
overview axis taihe close inner garden shenwu top corner
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

## 七、事实统计

文档里的词条数、挂载数、匾额数一律由脚本生成：

```bash
node tools/stats.js            # markdown 表格，可直接贴进 README
node tools/stats.js --json     # 机器可读
node tools/stats.js --plaques  # 列出全部显式匾额
```

改了 `info.js` 或 `palace.js` 的建筑挂载后跑一次，再同步 README 的“当前状态”表。这是防止文档数字再次漂移的唯一手段。
