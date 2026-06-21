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
var DELING_X = 1.3;   // 得令加成（叠在旺相休囚死的「旺×1.4」之上）
var SAME_X = 1.0;     // 生扶结构性修正

// ── 旺相休囚死（月令/大运地支 季节加权）──
var WANG = 1.3, XIANG = 1.1, XIU = 0.9, QIU = 0.8, SI = 0.65;
var DY_SEASON_W = 0.5;   // 大运地支季节力度（约半个月令）

// 由某地支本气五行，得五行旺相休囚死乘数表
function seasonRaw(zhi) {
  var M = ganWx(LunarUtil.ZHI_HIDE_GAN[zhi][0]);
  var t = {};
  ['木', '火', '土', '金', '水'].forEach(function (E) {
    if (E === M) t[E] = WANG;              // 旺：与令同
    else if (SHENG[M] === E) t[E] = XIANG; // 相：令所生
    else if (SHENG[E] === M) t[E] = XIU;   // 休：生令者
    else if (KE[E] === M) t[E] = QIU;      // 囚：克令者
    else t[E] = SI;                        // 死：令所克
  });
  return t;
}

// 月令满力 ⊗ 大运地支半力（zhis[0]=月令，zhis[1..]=大运地支）
function combinedSeason(zhis) {
  var t = seasonRaw(zhis[0]);
  for (var k = 1; k < zhis.length; k++) {
    if (!zhis[k]) continue;
    var dy = seasonRaw(zhis[k]);
    ['木', '火', '土', '金', '水'].forEach(function (E) {
      t[E] *= 1 + (dy[E] - 1) * DY_SEASON_W;
    });
  }
  return t;
}

// ── 刑冲合害（先合，再刑冲害；只作用于地支根气）──
var LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
var LIU_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
var LIU_HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
var ZI_XING = { 辰: 1, 午: 1, 酉: 1, 亥: 1 };
var XING_PAIR = { 子卯: 1, 卯子: 1, 寅巳: 1, 巳寅: 1, 丑戌: 1, 戌丑: 1, 戌未: 1, 未戌: 1 };
var REL_D = { 刑: 0.30, 冲: 0.25, 合: 0.15, 害: 0.12 };
var REL_FLOOR = 0.3, REL_CEIL = 1.8;   // 累计倍率封顶

// 一对地支的关系归类（先合 → 刑 → 冲 → 害）
function classifyRel(a, b) {
  if (a === b && ZI_XING[a]) return '刑';
  if (LIU_HE[a] === b) return '合';
  if (XING_PAIR[a + b]) return '刑';
  if (LIU_CHONG[a] === b) return '冲';
  if (LIU_HAI[a] === b) return '害';
  return null;
}

// 两本气五行关系
function elemRel(eA, eB) {
  if (eA === eB) return 'same';
  if (KE[eA] === eB) return 'AkB';
  if (KE[eB] === eA) return 'BkA';
  if (SHENG[eA] === eB) return 'AsB';
  return 'BsA';
}

// 刑冲合害修正地支根气：原局相邻 + 流年地支与四支全相邻（无距离）
function applyRelations(hidden, plist, lnZhi) {
  var fac = hidden.map(function () { return 1; });
  function mainOf(pos) { for (var i = 0; i < hidden.length; i++) if (hidden[i].pillar === pos && hidden[i].rank === 0) return i; return -1; }
  function subsOf(pos) { var r = []; for (var i = 0; i < hidden.length; i++) if (hidden[i].pillar === pos && hidden[i].rank > 0) r.push(i); return r; }
  function elOfZhi(z) { return ganWx(LunarUtil.ZHI_HIDE_GAN[z][0]); }

  // a：原局柱 {pos, zhi}；b：对手 {zhi, isOrig, pos}（流年 isOrig=false，不改 b）
  function applyPair(a, b) {
    var t = classifyRel(a.zhi, b.zhi);
    if (!t) return;
    var d = REL_D[t];
    var iaM = mainOf(a.pos), ibM = b.isOrig ? mainOf(b.pos) : -1;
    var elA = elOfZhi(a.zhi), elB = elOfZhi(b.zhi);
    function mul(i, m) { if (i >= 0) fac[i] *= m; }
    function mulSubs(pos, m) { subsOf(pos).forEach(function (i) { fac[i] *= m; }); }
    if (t === '合') { mul(iaM, 1 - d); if (b.isOrig) mul(ibM, 1 - d); return; }
    var er = elemRel(elA, elB);
    if (er === 'same') {                       // 同五行：库冲/同气刑 → 本气增、库余气散
      mul(iaM, 1 + d); if (b.isOrig) mul(ibM, 1 + d);
      if (t === '冲') { mulSubs(a.pos, 1 - 0.5 * d); if (b.isOrig) mulSubs(b.pos, 1 - 0.5 * d); }
    } else if (er === 'AkB') {                  // a 克 b
      mul(iaM, 1 - 0.4 * d); if (b.isOrig) mul(ibM, 1 - d);
    } else if (er === 'BkA') {                  // b 克 a
      mul(iaM, 1 - d); if (b.isOrig) mul(ibM, 1 - 0.4 * d);
    } else if (er === 'AsB') {                  // a 生 b
      mul(iaM, 1 - 0.4 * d); if (b.isOrig) mul(ibM, 1 - 0.6 * d);
    } else {                                    // b 生 a
      mul(iaM, 1 - 0.6 * d); if (b.isOrig) mul(ibM, 1 - 0.4 * d);
    }
  }

  for (var i = 0; i < plist.length - 1; i++) {
    applyPair({ pos: plist[i].pos, zhi: plist[i].zhi },
              { pos: plist[i + 1].pos, zhi: plist[i + 1].zhi, isOrig: true });
  }
  if (lnZhi) {
    for (var j = 0; j < plist.length; j++) {
      applyPair({ pos: plist[j].pos, zhi: plist[j].zhi }, { zhi: lnZhi, isOrig: false });
    }
  }
  for (var k = 0; k < hidden.length; k++) {
    hidden[k].val *= Math.max(REL_FLOOR, Math.min(REL_CEIL, fac[k]));
  }
}

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
// opts: { seasonZhis:[月令(,大运地支)], lnZhi:流年地支 } —— 岁运结构层
function computeNatal(plist, dayGan, opts) {
  opts = opts || {};
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

  // Step0a 刑冲合害（先合，再刑冲害；原局相邻 + 流年无距离）改写地支根气
  applyRelations(hidden, plist, opts.lnZhi || null);
  // Step0b 旺相休囚死（月令 ⊗ 大运地支）作用于天干、地支、日元
  var monthZhi = null;
  for (i = 0; i < plist.length; i++) if (plist[i].pos === 1) monthZhi = plist[i].zhi;
  var seasonZhis = (opts.seasonZhis && opts.seasonZhis.length) ? opts.seasonZhis : [monthZhi || (plist[0] && plist[0].zhi)];
  var season = combinedSeason(seasonZhis);
  for (i = 0; i < stems.length; i++) stems[i].val *= season[stems[i].el];
  for (i = 0; i < hidden.length; i++) hidden[i].val *= season[hidden[i].el];

  // Step1 同柱：天干↔地支藏干（双向：支生干/截脚 + 干生支/盖头）
  // 通根只认「同字」：五行相同但干支不同（如戌中辛金 vs 天干庚金）不作通根
  for (var s1 = 0; s1 < stems.length; s1++) {
    var st = stems[s1];
    for (var h = 0; h < hidden.length; h++) {
      if (hidden[h].pillar !== st.pillar) continue;
      var hd = hidden[h];
      if (hd.char === st.char) { st.val += C_ROOT * hd.val; }                                    // 同柱通根（同字）
      else if (hd.el === st.el) { /* 同五行异字：无互动 */ }
      else if (SHENG[hd.el] === st.el) { st.val += C_SHENG * hd.val; hd.val *= (1 - C_XIE); }   // 支生干
      else if (KE[hd.el] === st.el) { st.val -= C_KE * hd.val; hd.val *= (1 - C_COST); }        // 截脚：支克干
      else if (SHENG[st.el] === hd.el) { hd.val += C_SHENG * st.val; st.val *= (1 - C_XIE); }   // 干生支
      else if (KE[st.el] === hd.el) { hd.val -= C_KE * st.val; st.val *= (1 - C_COST); }        // 盖头：干克支
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
// 先让大运、流年各自「同柱作用」：地支藏干 → 本柱天干（天干不对地支），
// 得到天干的有效强度；再以天干(isStem)与地支藏干(非isStem)两类身份进入原局。
function buildActors(dyGZ, lnGZ) {
  var actors = [];
  function push(gz, ganF, zhiF) {
    if (!gz || gz.length < 2) return;
    var gc = gz.charAt(0), ge = ganWx(gc);
    var hg = LunarUtil.ZHI_HIDE_GAN[gz.charAt(1)], ws = HIDE_W[hg.length];
    var hiddens = [];
    for (var j = 0; j < hg.length; j++) {
      hiddens.push({ char: hg[j], el: ganWx(hg[j]), f: zhiF * ws[j] });
    }
    // 同柱：地支藏干 → 天干（通根只认同字；天干不反作用于地支）
    var ganEff = ganF;
    for (var k = 0; k < hiddens.length; k++) {
      var hd = hiddens[k];
      if (hd.char === gc) { ganEff += C_ROOT * hd.f; }                                   // 同字通根
      else if (hd.el === ge) { /* 同五行异字：跳过 */ }
      else if (SHENG[hd.el] === ge) { ganEff += C_SHENG * hd.f; hd.f *= (1 - C_XIE); }   // 藏干生天干
      else if (KE[hd.el] === ge) { ganEff += -C_KE * hd.f; hd.f *= (1 - C_COST); }       // 藏干克天干
    }
    ganEff = Math.max(0.02, ganEff);
    // 只把岁运天干作为 overlay actor：大运地支已进旺衰、流年地支已进刑冲合害
    actors.push({ char: gc, el: ge, f: ganEff, isStem: true });
  }
  push(dyGZ, DY_GAN_F, DY_ZHI_F);
  push(lnGZ, LN_GAN_F, LN_ZHI_F);
  return actors;
}

// 岁运对原局某天干作用，返回新能量
// 天干(isStem)：与原局天干双向生克帮扶（同字帮扶 / 同五行异字跳过 / 生克泄耗）
// 地支藏干(非isStem)：只能同字通根原局天干，不斜向生克（天干地支互不斜作用）
function affect(ch, el, v, actors) {
  var d = 0;
  for (var i = 0; i < actors.length; i++) {
    var a = actors[i];
    if (a.isStem) {
      if (a.char === ch) d += LUCK_SAME * a.f * LUCK_DF;            // 同字帮扶
      else if (a.el === el) { /* 同五行异字：不帮扶、不生克 */ }
      else if (SHENG[a.el] === el) d += C_SHENG * a.f * LUCK_DF;     // 岁运天干生它
      else if (KE[a.el] === el) d += -C_KE * a.f * LUCK_DF;          // 岁运天干克它
      else if (SHENG[el] === a.el) d += -C_XIE * v * LUCK_DF;        // 它生岁运天干·泄
      else if (KE[el] === a.el) d += -C_COST * v * LUCK_DF;          // 它克岁运天干·耗
    } else {
      if (a.char === ch) d += LUCK_SAME * a.f * LUCK_DF;            // 地支藏干同字通根
      // 非同字：地支不斜向生克，跳过
    }
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
  // 月令地支（旺衰基准）
  var monthZhi = null;
  for (var mz = 0; mz < plist.length; mz++) if (plist[mz].pos === 1) monthZhi = plist[mz].zhi;
  if (!monthZhi && plist.length) monthZhi = plist[0].zhi;
  // 岁运地支：大运管旺衰叠加，流年管刑冲合害
  var dyZhi = (opts.daYunGZ && opts.daYunGZ.length >= 2) ? opts.daYunGZ.charAt(1) : null;
  var lnZhi = (opts.liuNianGZ && opts.liuNianGZ.length >= 2) ? opts.liuNianGZ.charAt(1) : null;

  // 本命：仅月令旺衰 + 原局相邻刑冲合害
  var natalBase = computeNatal(plist, dayGan, { seasonZhis: [monthZhi] });
  // 岁运后：大运地支叠加旺衰 + 流年地支刑冲合害（无距离）
  var hasStruct = !!(dyZhi || lnZhi);
  var natalNow = hasStruct
    ? computeNatal(plist, dayGan, { seasonZhis: dyZhi ? [monthZhi, dyZhi] : [monthZhi], lnZhi: lnZhi })
    : natalBase;

  // 天干 overlay：大运/流年天干 生克帮扶原局天干（带 cap）
  var actors = buildActors(opts.daYunGZ, opts.liuNianGZ);
  var hasLuck = actors.length > 0;
  function valAfter(node) { return hasLuck ? affect(node.char, node.el, node.val, actors) : node.val; }

  var ganCells = [];
  for (var i = 0; i < natalNow.stems.length; i++) {
    var s = natalNow.stems[i], sb = natalBase.stems[i];
    var av = valAfter(s);
    ganCells.push({
      pos: PLBL[s.pillar], char: s.char, cls: WX_CLS[s.el], el: s.el,
      god: shiShen(dayGan, s.char, s.isDay), isDay: s.isDay,
      base: round2(sb.val), val: round2(av), delta: round2(av - sb.val),
      party: s.isDay ? 'day' : partyOf(natalNow.dm, s.el)
    });
  }
  var zhiCells = [];
  for (var z = 0; z < plist.length; z++) {
    var pos = plist[z].pos;
    var hs = natalNow.hidden.filter(function (h) { return h.pillar === pos; });
    var hb = natalBase.hidden.filter(function (h) { return h.pillar === pos; });
    if (!hs.length) continue;
    var nowSum = 0, baseSum = 0, mainEl = hs[0].el;
    for (var k = 0; k < hs.length; k++) nowSum += hs[k].val;
    for (var kb = 0; kb < hb.length; kb++) baseSum += hb[kb].val;
    zhiCells.push({
      pos: PLBL[pos], char: plist[z].zhi, cls: WX_CLS[mainEl], el: mainEl,
      god: LunarUtil.SHI_SHEN[dayGan + hs[0].char],
      base: round2(baseSum), val: round2(nowSum), delta: round2(nowSum - baseSum),
      party: partyOf(natalNow.dm, mainEl)
    });
  }

  // 全部藏干的十神单元（供「两种底色」按天干地支所有十神统计）
  var hiddenUnits = [];
  for (var hu = 0; hu < natalNow.hidden.length; hu++) {
    var hn = natalNow.hidden[hu], hbn = natalBase.hidden[hu];
    hiddenUnits.push({
      god: LunarUtil.SHI_SHEN[dayGan + hn.char],
      el: hn.el,
      base: round2(hbn.val),
      val: round2(hn.val),
      party: partyOf(natalNow.dm, hn.el)
    });
  }

  // 旺衰：本命 / 岁运后
  var aggBase = aggregate(natalBase);
  var aggNow = aggBase;
  if (hasStruct || hasLuck) {
    var affected = {
      dm: natalNow.dm, dayGan: dayGan,
      stems: natalNow.stems.map(function (s) { return { char: s.char, el: s.el, val: valAfter(s), pillar: s.pillar, isDay: s.isDay }; }),
      hidden: natalNow.hidden.map(function (h) { return { char: h.char, el: h.el, val: h.val, pillar: h.pillar, rank: h.rank }; })
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
