#!/usr/bin/env node
/* ============================================================
   事实统计 —— 文档里凡是"多少条词条 / 多少处挂载 / 多少块匾额"
   的数字，一律从这里取，不再手写。

   用法：
     node tools/stats.js              # 表格输出，可直接贴进文档
     node tools/stats.js --json       # 机器可读
     node tools/stats.js --plaques    # 列出全部显式匾额

   口径：
     词条总数     js/data/info.js 的键数
     挂载          palace.js 里 INFO.<key> 的引用去重数
     已阅分母     挂载数（侧栏按 info.name 去重，同名角楼只算一次）
     显式匾额     palace.js 里 plaque 字面量 + 三元分支展开
     自动匾额     六宫 12 院由院落名生成，每院一块
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 1. 词条 ---------- */
global.window = {};
require(path.join(ROOT, 'js/data/info.js'));
const INFO = window.GG.INFO;
const infoKeys = Object.keys(INFO);

/* ---------- 2. 挂载 ---------- */
const palaceSrc = read('js/palace.js');
const citySrc = read('js/city.js');
const tiantanSrc = read('js/tiantan.js');
const usedKeys = new Set(
  [...palaceSrc.matchAll(/INFO\.([A-Za-z0-9_]+)/g)].map((m) => m[1])
);
/* 京师（城门 / 坛庙 / 三海）的词条是字符串键：城门写在 NC_GATES 之类的
   表里，地标由 mark(group, 'key') 挂载。不扫这两处会把 22 条误报成未挂载。
   天坛在 js/tiantan.js 里用 marks.push(group, 'key', ...) 暂存，一并计入。 */
for (const re of [/key:\s*'([A-Za-z0-9_]+)'/g, /mark\([^,]+,\s*'([A-Za-z0-9_]+)'/g]) {
  for (const m of citySrc.matchAll(re)) {
    if (m[1] in INFO) usedKeys.add(m[1]);
  }
}
for (const m of tiantanSrc.matchAll(/marks\.push\([^,]+,\s*'([A-Za-z0-9_]+)'/g)) {
  if (m[1] in INFO) usedKeys.add(m[1]);
}
const unmounted = infoKeys.filter((k) => !usedKeys.has(k));
const dangling = [...usedKeys].filter((k) => !(k in INFO));

/* ---------- 3. 匾额 ---------- */
/*
   六宫 12 院：eastSix / westSix 各 6 项，正殿匾额由 cfg.info.name
   生成（palace.js 的 courtyard 内），因此自动匾额固定为 12。
*/
const AUTO_PLAQUES = 12;
const explicitPlaques = [];
let autoDefs = 0;

for (const line of palaceSrc.split('\n')) {
  const m = line.match(/plaque\s*:\s*(.+)$/);
  if (!m) continue;
  const expr = m[1];
  if (/^\(cfg\./.test(expr)) { autoDefs++; continue; }
  const lits = [...expr.matchAll(/'([^']*)'/g)]
    .map((x) => x[1])
    .filter((s) => s.length > 0);
  if (lits.length) explicitPlaques.push(...lits);
}

/* ---------- 4. 分类与字段覆盖 ---------- */
const byCat = {};
for (const k of infoKeys) {
  const c = INFO[k].cat || '未分类';
  byCat[c] = (byCat[c] || 0) + 1;
}
const fields = ['form', 'scale', 'status', 'note'];
const coverage = {};
for (const f of fields) coverage[f] = infoKeys.filter((k) => INFO[k][f]).length;

/* ---------- 5. 代码规模 ---------- */
function countLines(dir, out = { total: 0, files: [] }) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name);
    const abs = path.join(ROOT, rel);
    if (fs.statSync(abs).isDirectory()) {
      if (name === 'vendor') continue;
      countLines(rel, out);
    } else if (name.endsWith('.js')) {
      const src = fs.readFileSync(abs, 'utf8');
      const n = src.split('\n').length - (src.endsWith('\n') ? 1 : 0);
      out.total += n;
      out.files.push([rel, n]);
    }
  }
  return out;
}
const js = countLines('js');
js.files.sort((a, b) => b[1] - a[1]);

/* ---------- 输出 ---------- */
const data = {
  entries: infoKeys.length,
  mounted: usedKeys.size,
  readDenominator: usedKeys.size,
  unmounted,
  dangling,
  plaques: {
    explicit: explicitPlaques.length,
    auto: autoDefs ? AUTO_PLAQUES : 0,
    total: explicitPlaques.length + (autoDefs ? AUTO_PLAQUES : 0)
  },
  byCat,
  coverage,
  code: { totalLines: js.total, largest: js.files.slice(0, 3) }
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(data, null, 2));
} else if (process.argv.includes('--plaques')) {
  explicitPlaques.forEach((p, i) => console.log(`${String(i + 1).padStart(2)}. ${p}`));
  console.log(`\n显式 ${explicitPlaques.length} + 自动 ${data.plaques.auto} = ${data.plaques.total}`);
} else {
  const catLine = Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join(' / ');
  const covLine = fields.map((f) => `${f} ${coverage[f]}`).join(' / ');
  console.log(`
| 项 | 数量 |
| --- | --- |
| 词条总数 | ${data.entries} |
| 挂载到场景实体 | ${data.mounted}${unmounted.length ? `（未挂载：${unmounted.join('、')}）` : ''} |
| 已阅分母 | ${data.readDenominator} |
| 显式匾额 | ${data.plaques.explicit} |
| 自动匾额（六宫） | ${data.plaques.auto} |
| 匾额合计 | ${data.plaques.total} |
| 分类分布 | ${catLine} |
| 字段覆盖 | ${covLine} |
| JS 总行数 | ${data.code.totalLines} |
| 最大文件 | ${data.code.largest.map(([f, n]) => `${f} ${n}`).join(' / ')} |

生成命令：node tools/stats.js
`);
  if (dangling.length) {
    console.error(`警告：palace.js 引用了 INFO 中不存在的键：${dangling.join(', ')}`);
    process.exitCode = 1;
  }
}
