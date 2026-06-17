// 量化引擎：原局逐字能量（同柱→异柱→通根 + 得令/生扶修正）+ 岁运逐字改写
// 与对话中验证过的手算模型一致；岁运以生克系数作用于原局每个字，不直接动 P。
var base = require('./base.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;

var SHENG = base.SHENG;
var KE = base.KE;
var WX_CLS = base.WX_CLS;
var ganWx = base.ganWx;

// ── 原局参数 ──
var GAN_BASE = [1.0, 1.0, 1.0, 1.0];        // 年/月/日/时 天干基础分
var ZHI_W = [1.0, 2.0, 1.4, 1.0];           // 地支权重（月令当权、日支贴身）
var HIDE_W = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
var PLBL = ['年', '月', '日', '时'];

// 作用系数
var C_SHENG = 0.25;   // 受生 +
var C_XIE = 0.15;     // 泄气 −
var C_KE = 0.25;      // 受克 −
var C_COST = 0.05;    // 克耗 −
var C_ROOT = 0.30;    // 通根帮扶 +
var ROOT_CROSS_DF = 0.6;
var DELING_X = 1.8;   // 得令加成（月令本气属生扶）
var SAME_X = 1.0;     // 生扶结构性修正

function stemDF(d) { d = Math.abs(d); return d === 1 ? 0.5 : (d === 2 ? 0.2 : 0.1); }

// ── 岁运参数 ──
var LUCK_DF = 0.5;        // 外来作用折扣
var LUCK_CAP = 0.4;       // 单字变化封顶 ±40%
var LUCK_SAME = 0.20;     // 岁运同类帮扶系数
var DY_GAN_F = 0.7, DY_ZHI_F = 1.3;   // 大运 重支
var LN_GAN_F = 0.9, LN_ZHI_F = 0.9;   // 流年 重干（力锐）

function partyOf(dm, el) {
  var r = base.relation(dm, el);
  return (r === '同我' || r === '生我') ? 'same' : 'diff';
}

// 计算原局每个字的终值
// plist: [{ pos, gan, zhi }]，pos 为柱序（年0/月1/日2/时3），日柱 pos===2；缺时柱则少一项
function computeNatal(plist, dayGan) {
  var dm = ganWx(dayGan);
  var i, j;
  var stems = [];
  for (i = 0; i < plist.length; i++) {
    var P = plist[i];
    stems.push({ char: P.gan, el: ganWx(P.gan), val: GAN_BASE[P.pos], pillar: P.pos, isDay: P.pos === 2 });
  }
  var hidden = [];
  for (i = 0; i < plist.length; i++) {
    var Q = plist[i];
    var hg = LunarUtil.ZHI_HIDE_GAN[Q.zhi];
    var ws = HIDE_W[hg.length];
    for (j = 0; j < hg.length; j++) {
      hidden.push({ char: hg[j], el: ganWx(hg[j]), val: ZHI_W[Q.pos] * ws[j], pillar: Q.pos, rank: j });
    }
  }

  // Step1 同柱：地支藏干 → 同柱天干（天干无法克/生地支）
  // 通根只认「同字」：五行相同但干支不同（如戌中辛金 vs 天干庚金）不作通根
  for (var s1 = 0; s1 < stems.length; s1++) {
    var st = stems[s1];
    for (var h = 0; h < hidden.length; h++) {
      if (hidden[h].pillar !== st.pillar) continue;
      var hd = hidden[h];
      if (hd.char === st.char) { st.val += C_ROOT * hd.val; }                   // 同柱通根（同字）
      else if (hd.el === st.el) { /* 同五行异字：非通根，无加成 */ }
      else if (SHENG[hd.el] === st.el) { st.val += C_SHENG * hd.val; hd.val *= (1 - C_XIE); }  // 藏干生天干
      else if (KE[hd.el] === st.el) { st.val += -C_KE * hd.val; hd.val *= (1 - C_COST); }      // 藏干克天干
    }
  }

  // Step2 异柱天干生克（按柱距 df，快照后统一加减）
  var snap = stems.map(function (s) { return s.val; });
  var delta = stems.map(function () { return 0; });
  for (var a = 0; a < stems.length; a++) {
    for (var b = a + 1; b < stems.length; b++) {
      var ea = stems[a].el, eb = stems[b].el, df = stemDF(stems[a].pillar - stems[b].pillar);
      var va = snap[a], vb = snap[b];
      if (ea === eb) continue;
      if (SHENG[ea] === eb) { delta[b] += C_SHENG * va * df; delta[a] += -C_XIE * va * df; }
      else if (SHENG[eb] === ea) { delta[a] += C_SHENG * vb * df; delta[b] += -C_XIE * vb * df; }
      else if (KE[ea] === eb) { delta[b] += -C_KE * va * df; delta[a] += -C_COST * va * df; }
      else if (KE[eb] === ea) { delta[a] += -C_KE * vb * df; delta[b] += -C_COST * vb * df; }
    }
  }
  for (var d2 = 0; d2 < stems.length; d2++) stems[d2].val += delta[d2];

  // Step3 异柱通根（同字才算根，同五行异字不算）
  for (var s3 = 0; s3 < stems.length; s3++) {
    var stm = stems[s3], sum = 0;
    for (var hh = 0; hh < hidden.length; hh++) {
      if (hidden[hh].pillar !== stm.pillar && hidden[hh].char === stm.char) sum += hidden[hh].val;
    }
    if (sum > 0) stm.val += C_ROOT * sum * ROOT_CROSS_DF;
  }

  for (var f1 = 0; f1 < stems.length; f1++) stems[f1].val = Math.max(0.02, stems[f1].val);
  for (var f2 = 0; f2 < hidden.length; f2++) hidden[f2].val = Math.max(0.02, hidden[f2].val);
  return { dm: dm, dayGan: dayGan, stems: stems, hidden: hidden };
}

// 旺衰聚合（含得令、生扶×1.5）
function aggregate(model) {
  var dm = model.dm, same = 0, diff = 0, i;
  var monthMain = null;
  for (i = 0; i < model.hidden.length; i++) {
    if (model.hidden[i].pillar === 1 && model.hidden[i].rank === 0) { monthMain = model.hidden[i]; break; }
  }
  for (i = 0; i < model.stems.length; i++) {
    var s = model.stems[i];
    if (s.isDay) continue;
    if (partyOf(dm, s.el) === 'same') same += s.val; else diff += s.val;
  }
  for (i = 0; i < model.hidden.length; i++) {
    var h = model.hidden[i];
    var party = partyOf(dm, h.el);
    var v = h.val;
    if (h === monthMain && party === 'same') v *= DELING_X;   // 得令
    if (party === 'same') same += v; else diff += v;
  }
  var sameAdj = same * SAME_X;
  var total = sameAdj + diff;
  return { p: total > 0 ? sameAdj / total : 0.5, same: same, diff: diff };
}

// ── 岁运 ──
function buildActors(dyGZ, lnGZ) {
  var actors = [];
  function push(gz, ganF, zhiF) {
    if (!gz || gz.length < 2) return;
    actors.push({ char: gz.charAt(0), el: ganWx(gz.charAt(0)), f: ganF });
    var hg = LunarUtil.ZHI_HIDE_GAN[gz.charAt(1)], ws = HIDE_W[hg.length];
    for (var j = 0; j < hg.length; j++) actors.push({ char: hg[j], el: ganWx(hg[j]), f: zhiF * ws[j] });
  }
  push(dyGZ, DY_GAN_F, DY_ZHI_F);
  push(lnGZ, LN_GAN_F, LN_ZHI_F);
  return actors;
}

// 岁运对单字作用，返回新能量
// 帮扶（同类生扶）只认「同字」：同五行异字（如岁运辛金 vs 命局庚金）不帮扶，亦不生克
function affect(ch, el, v, actors) {
  var d = 0;
  for (var i = 0; i < actors.length; i++) {
    var a = actors[i];
    if (a.char === ch) d += LUCK_SAME * a.f * LUCK_DF;            // 同字帮扶
    else if (a.el === el) { /* 同五行异字：不帮扶、不生克 */ }
    else if (SHENG[a.el] === el) d += C_SHENG * a.f * LUCK_DF;     // 岁运生它
    else if (KE[a.el] === el) d += -C_KE * a.f * LUCK_DF;          // 岁运克它
    else if (SHENG[el] === a.el) d += -C_XIE * v * LUCK_DF;        // 它生岁运·泄
    else if (KE[el] === a.el) d += -C_COST * v * LUCK_DF;          // 它克岁运·耗
  }
  var cap = LUCK_CAP * v;
  if (d > cap) d = cap; if (d < -cap) d = -cap;
  return Math.max(0.02, v + d);
}

function shiShen(dayGan, ch, isDay) {
  return isDay ? '日主' : LunarUtil.SHI_SHEN[dayGan + ch];
}

// 主入口：返回 8 格显示模型（天干 4 + 地支 4）+ 旺衰
// opts: { daYunGZ, liuNianGZ }  传入岁运干支字符串则计算改写
function build(chart, opts) {
  opts = opts || {};
  var dayGan = chart.meta.dayGan;
  // 有效柱（时辰未知时时柱为占位，跳过）
  var plist = [];
  for (var pi = 0; pi < chart.pillars.length; pi++) {
    var pp = chart.pillars[pi];
    if (pp.empty || !pp.gan) continue;
    plist.push({ pos: pi, gan: pp.gan.text, zhi: pp.zhi.text });
  }
  var natal = computeNatal(plist, dayGan);
  var actors = buildActors(opts.daYunGZ, opts.liuNianGZ);
  var hasLuck = actors.length > 0;

  function valAfter(node) { return hasLuck ? affect(node.char, node.el, node.val, actors) : node.val; }

  var ganCells = [];
  for (var i = 0; i < natal.stems.length; i++) {
    var s = natal.stems[i];
    var av = valAfter(s);
    ganCells.push({
      pos: PLBL[s.pillar], char: s.char, cls: WX_CLS[s.el], el: s.el,
      god: shiShen(dayGan, s.char, s.isDay), isDay: s.isDay,
      base: round2(s.val), val: round2(av), delta: round2(av - s.val),
      party: s.isDay ? 'day' : partyOf(natal.dm, s.el)
    });
  }
  var zhiCells = [];
  for (var z = 0; z < plist.length; z++) {
    var pos = plist[z].pos;
    var hs = natal.hidden.filter(function (h) { return h.pillar === pos; });
    if (!hs.length) continue;
    var baseSum = 0, valSum = 0, mainEl = hs[0].el;
    for (var k = 0; k < hs.length; k++) { baseSum += hs[k].val; valSum += valAfter(hs[k]); }
    zhiCells.push({
      pos: PLBL[pos], char: plist[z].zhi, cls: WX_CLS[mainEl], el: mainEl,
      god: LunarUtil.SHI_SHEN[dayGan + hs[0].char],
      base: round2(baseSum), val: round2(valSum), delta: round2(valSum - baseSum),
      party: partyOf(natal.dm, mainEl)
    });
  }

  // 全部藏干的十神单元（供「两种底色」按天干地支所有十神统计）
  var hiddenUnits = [];
  for (var hu = 0; hu < natal.hidden.length; hu++) {
    var hn = natal.hidden[hu];
    hiddenUnits.push({
      god: LunarUtil.SHI_SHEN[dayGan + hn.char],
      base: round2(hn.val),
      val: round2(valAfter(hn)),
      party: partyOf(natal.dm, hn.el)
    });
  }

  // 旺衰（岁运后）
  var aggBase = aggregate(natal);
  var aggNow = aggBase;
  if (hasLuck) {
    var affected = {
      dm: natal.dm, dayGan: dayGan,
      stems: natal.stems.map(function (s) { return { char: s.char, el: s.el, val: valAfter(s), pillar: s.pillar, isDay: s.isDay }; }),
      hidden: natal.hidden.map(function (h) { return { char: h.char, el: h.el, val: valAfter(h), pillar: h.pillar, rank: h.rank }; })
    };
    aggNow = aggregate(affected);
  }

  // 归一化参考值（含上浮空间，便于看到增长）
  var maxRef = 0;
  ganCells.concat(zhiCells).forEach(function (c) { if (c.base > maxRef) maxRef = c.base; if (c.val > maxRef) maxRef = c.val; });
  maxRef = maxRef * 1.05 || 1;

  return {
    ganCells: ganCells,
    zhiCells: zhiCells,
    hiddenUnits: hiddenUnits,
    maxRef: maxRef,
    hasLuck: hasLuck,
    pBase: Math.round(aggBase.p * 100),
    pNow: Math.round(aggNow.p * 100)
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

module.exports = { build: build };
