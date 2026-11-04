#!/usr/bin/env node
/* ============================================================
   搜索与内容数据自测
   不依赖 DOM，直接对 js/data/*.js 的纯数据跑断言。
   覆盖 v2.3 T6.2 与 v2.4 的探索清单 / 朝代对比数据：
     taihe / 太和 / thd 命中太和殿；
     分类过滤返回该分类全部条目；
     年代过滤只返回 year 含该字的条目。

   用法：node tools/search-check.js
   ============================================================ */
const path = require('path');

global.window = {};
require(path.resolve(__dirname, '../js/data/info.js'));
const INFO = window.GG.INFO;

/** 与 js/ui.js 的 applyFilter 保持同一规则 */
function match(info, q, cat, era) {
  const textHit = !q
    || info.name.toLowerCase().includes(q)
    || (info.en || '').toLowerCase().includes(q)
    || (info.py || '').includes(q)
    || (info.pyi || '').includes(q);
  const catHit = !cat || info.cat === cat;
  const eraHit = !era || (info.year || '').includes(era);
  return textHit && catHit && eraHit;
}

function run(q, cat, era) {
  return Object.values(INFO).filter((x) => match(x, q, cat, era));
}

let pass = 0;
let fail = 0;

function check(label, cond, detail) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + label);
  } else {
    fail++;
    console.log('  ✗ ' + label + (detail ? '  → ' + detail : ''));
  }
}

console.log('\n拼音检索');
for (const [q, expect] of [['taihe', '太和殿'], ['thd', '太和殿'], ['太和', '太和殿'], ['qqg', '乾清宫'], ['yhy', '御花园']]) {
  const hit = run(q).some((x) => x.name === expect);
  check(`"${q}" 命中 ${expect}`, hit, '未命中');
}

console.log('\n分类过滤');
const CATS = ['前朝', '后寝', '东路', '西路', '城防', '宫外'];
for (const c of CATS) {
  const all = Object.values(INFO).filter((x) => x.cat === c);
  const got = run('', c, '');
  check(`${c}：${got.length} 条全部命中`, got.length === all.length && got.every((x) => x.cat === c),
    `期望 ${all.length}，实际 ${got.length}`);
}
const hou = run('', '后寝', '');
check('后寝过滤不混入其他分类', hou.every((x) => x.cat === '后寝'), '混入 ' + hou.filter((x) => x.cat !== '后寝').map((x) => x.name).join(','));

console.log('\n年代过滤');
const mingAll = Object.values(INFO).filter((x) => (x.year || '').includes('明'));
const mingGot = run('', '', '明');
check(`明：${mingGot.length} 条`, mingGot.length === mingAll.length && mingGot.every((x) => (x.year || '').includes('明')), `期望 ${mingAll.length}，实际 ${mingGot.length}`);
const qingAll = Object.values(INFO).filter((x) => (x.year || '').includes('清'));
const qingGot = run('', '', '清');
check(`清：${qingGot.length} 条`, qingGot.length === qingAll.length && qingGot.every((x) => (x.year || '').includes('清')), `期望 ${qingAll.length}，实际 ${qingGot.length}`);

console.log('\n组合条件');
/* taihe 同时命中太和门与太和殿，这是正确行为；精确到单条用缩写 thd */
const mix = run('thd', '前朝', '明');
check('"thd" + 前朝 + 明 只返回太和殿', mix.length === 1 && mix[0].name === '太和殿',
  mix.map((x) => x.name).join(',') || '空');
const taihe = run('taihe', '前朝', '明');
check('"taihe" + 前朝 + 明 命中太和门与太和殿',
  taihe.length === 2 && taihe.some((x) => x.name === '太和门') && taihe.some((x) => x.name === '太和殿'),
  taihe.map((x) => x.name).join(','));
const none = run('taihe', '后寝', '');
check('"taihe" + 后寝 为空', none.length === 0, none.map((x) => x.name).join(','));

console.log('\n导览路线');
require(path.resolve(__dirname, '../js/data/tour.js'));
const names = new Set(Object.values(INFO).map((v) => v.name));
for (const r of window.GG.TOUR.routes) {
  const miss = r.stops.filter((s) => !names.has(s.target)).map((s) => s.target);
  check(`${r.id}：${r.stops.length} 站全部有词条`, miss.length === 0, '缺：' + miss.join(','));
  check(`${r.id}：有中文与英文字幕`, r.stops.every((s) => s.zh && s.en), '缺字幕');
}

console.log('\n数据完整性');
const noPy = Object.entries(INFO).filter(([, v]) => !v.py || !v.pyi);
check('所有词条都有 py / pyi', noPy.length === 0, noPy.map(([k]) => k).join(','));
const keys = new Set(Object.keys(INFO));
const dangling = [];
Object.entries(INFO).forEach(([k, v]) => (v.rel || []).forEach((r) => {
  if (!keys.has(r)) dangling.push(k + '→' + r);
}));
check('rel 引用全部存在', dangling.length === 0, dangling.join(','));

console.log('\n探索清单（v2.4 T7.1）');
require(path.resolve(__dirname, '../js/data/quests.js'));
require(path.resolve(__dirname, '../js/quests.js'));
const QUESTS = window.GG.QUESTS;
const progress = window.GG.Quests.progress;
const groupIds = QUESTS.groups.map((g) => g.id);
check('组 id 不重复', new Set(groupIds).size === groupIds.length, groupIds.join(','));
check('三组条目数为 10 / 12 / 5',
  QUESTS.groups.map((g) => g.items.length).join('/') === '10/12/5',
  QUESTS.groups.map((g) => g.items.length).join('/'));
const missingItems = [];
const seenItems = new Set();
const dupItems = [];
for (const g of QUESTS.groups) {
  for (const k of g.items) {
    if (!keys.has(k)) missingItems.push(g.id + '→' + k);
    if (seenItems.has(k)) dupItems.push(k);
    seenItems.add(k);
  }
}
check('清单条目全部有词条', missingItems.length === 0, missingItems.join(','));
check('清单条目跨组不重复', dupItems.length === 0, dupItems.join(','));
const noGroupText = QUESTS.groups.filter((g) =>
  ['title', 'short', 'hint', 'done'].some((f) => !g[f] || !g[f].zh || !g[f].en));
check('每组标题 / 简称 / 引导语 / 完成语双语齐全', noGroupText.length === 0,
  noGroupText.map((g) => g.id).join(','));
const g0 = QUESTS.groups[0];
check('清单进度：空集合未完成', !progress(g0, () => false).complete && progress(g0, () => false).done === 0);
check('清单进度：全集合完成且计数正确',
  progress(g0, () => true).complete && progress(g0, () => true).done === g0.items.length);
const one = new Set([INFO[g0.items[0]].name]);
check('清单进度：部分完成不误报',
  progress(g0, (n) => one.has(n)).done === 1 && !progress(g0, (n) => one.has(n)).complete);

console.log('\n朝代对比（v2.4 T7.2）');
require(path.resolve(__dirname, '../js/data/eras.js'));
const ERAS = window.GG.ERAS;
const eraIds = ERAS.eras.map((e) => e.id);
check('initial 指向存在的朝代', eraIds.includes(ERAS.initial), ERAS.initial);
check('朝代 id 不重复且为 ming / qing',
  new Set(eraIds).size === 2 && eraIds.includes('ming') && eraIds.includes('qing'), eraIds.join(','));
check('免责声明含「示意对比，非史实复原动画」',
  ERAS.disclaimer.zh.includes('示意对比，非史实复原动画') && !!ERAS.disclaimer.en);
const badChanges = [];
const changeNames = new Set();
const dupChangeNames = [];
for (const c of ERAS.changes) {
  const info = INFO[c.key];
  if (!info) { badChanges.push(c.key + '→无词条'); continue; }
  if (changeNames.has(info.name)) dupChangeNames.push(info.name);
  changeNames.add(info.name);
  for (const f of ['era', 'ming', 'qing', 'source']) {
    if (!c[f] || !c[f].zh || !c[f].en) badChanges.push(c.key + '→' + f + ' 缺双语');
  }
  if (!/依据/.test(c.source.zh || '') || !/Basis/.test(c.source.en || '')) {
    badChanges.push(c.key + '→依据说明缺失');
  }
}
check('差异条目全部有词条、年代、双语说明与依据', badChanges.length === 0, badChanges.join(','));
check('差异条目按词条名不重复（信息卡注记才不会串）', dupChangeNames.length === 0, dupChangeNames.join(','));
check('每条差异都有明代与清代两种说明',
  ERAS.changes.every((c) => c.ming.zh !== c.qing.zh));

console.log(`\n结果：${pass} 通过，${fail} 失败\n`);
process.exitCode = fail ? 1 : 0;
