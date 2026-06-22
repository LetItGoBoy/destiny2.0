// 量化引擎：原局 + 大运 + 流年 全部进占比池逐字算能量
// 模型与对话中验证过的手算一致：
//   Step0a 刑冲合害（原局相邻 + 岁运对全盘无距离）
//   Step1  同柱：全rank同字通根 + 本气(rank0)双向生克（同步初值）
//   Step3  异柱通根（同字）
// 岁运不再以"作用力overlay"方式扰动原局，而是当作完整的柱进池：
//   大运 干0.35/支0.65、流年 干0.45/支0.45（再×藏干权重），约占池 ~20%。
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

// ── 岁运进池起始能量（约占池 ~20%）──
var LUCK_POS = { dy: 4, ln: 5 };                          // 大运/流年的合成柱序
var LUCK_W = { dy: { gan: 0.35, zhi: 0.65 }, ln: { gan: 0.45, zhi: 0.45 } };
var LUCK_LBL = { 4: '大运', 5: '流年' };

// 作用系数
var C_SHENG = 0.25;   // 受生 +
var C_XIE = 0.15;     // 泄气 −
var C_KE = 0.25;      // 受克 −
var C_COST = 0.05;    // 克耗 −
var C_ROOT = 0.30;    // 通根帮扶 +
var ROOT_CROSS_DF = 0.6;
var DELING_X = 1.3;   // 得令加成（月令本气同党）
var SAME_X = 1.0;     // 生扶结构性修正

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

// 刑冲合害：按给定地支配对修正根气（双方都在池中，都改写）
// pairs: [{aPos, aZhi, bPos, bZhi}]
function applyRelations(hidden, pairs) {
  var fac = hidden.map(function () { return 1; });
  function mainOf(pos) { for (var i = 0; i < hidden.length; i++) if (hidden[i].pillar === pos && hidden[i].rank === 0) return i; return -1; }
  function subsOf(pos) { var r = []; for (var i = 0; i < hidden.length; i++) if (hidden[i].pillar === pos && hidden[i].rank > 0) r.push(i); return r; }
  function elOfZhi(z) { return ganWx(LunarUtil.ZHI_HIDE_GAN[z][0]); }
  function mul(i, m) { if (i >= 0) fac[i] *= m; }
  function mulSubs(pos, m) { subsOf(pos).forEach(function (i) { fac[i] *= m; }); }

  pairs.forEach(function (pr) {
    var t = classifyRel(pr.aZhi, pr.bZhi);
    if (!t) return;
    var d = REL_D[t];
    var iaM = mainOf(pr.aPos), ibM = mainOf(pr.bPos);
    var elA = elOfZhi(pr.aZhi), elB = elOfZhi(pr.bZhi);
    if (t === '合') { mul(iaM, 1 - d); mul(ibM, 1 - d); return; }
    var er = elemRel(elA, elB);
    if (er === 'same') {                          // 同五行：库冲/同气刑 → 本气增、库余气散
      mul(iaM, 1 + d); mul(ibM, 1 + d);
      if (t === '冲') { mulSubs(pr.aPos, 1 - 0.5 * d); mulSubs(pr.bPos, 1 - 0.5 * d); }
    } else if (er === 'AkB') {                     // a 克 b
      mul(iaM, 1 - 0.4 * d); mul(ibM, 1 - d);
    } else if (er === 'BkA') {                     // b 克 a
      mul(iaM, 1 - d); mul(ibM, 1 - 0.4 * d);
    } else if (er === 'AsB') {                     // a 生 b
      mul(iaM, 1 - 0.4 * d); mul(ibM, 1 - 0.6 * d);
    } else {                                       // b 生 a
      mul(iaM, 1 - 0.6 * d); mul(ibM, 1 - 0.4 * d);
    }
  });
  for (var k = 0; k < hidden.length; k++) {
    hidden[k].val *= Math.max(REL_FLOOR, Math.min(REL_CEIL, fac[k]));
  }
}

function partyOf(dm, el) {
  var r = base.relation(dm, el);
  return (r === '同我' || r === '生我') ? 'same' : 'diff';
}

// 占比/能量主算
// plist: [{ pos, gan, zhi }]（原局，pos：年0/月1/日2/时3，日柱 pos===2）
// opts.luck: [{ gz:'甲子', kind:'dy'|'ln' }]  岁运进池
function computeNatal(plist, dayGan, opts) {
  opts = opts || {};
  var dm = ganWx(dayGan);
  var i, j;
  var stems = [];
  var hidden = [];

  // —— 原局入池 ——
  for (i = 0; i < plist.length; i++) {
    var P = plist[i];
    stems.push({ char: P.gan, el: ganWx(P.gan), val: GAN_BASE[P.pos], pillar: P.pos, isDay: P.pos === 2, kind: 'natal' });
  }
  for (i = 0; i < plist.length; i++) {
    var Q = plist[i];
    var hg = LunarUtil.ZHI_HIDE_GAN[Q.zhi];
    var ws = HIDE_W[hg.length];
    for (j = 0; j < hg.length; j++) {
      hidden.push({ char: hg[j], el: ganWx(hg[j]), val: ZHI_W[Q.pos] * ws[j], pillar: Q.pos, rank: j, kind: 'natal' });
    }
  }

  // —— 岁运入池（完整柱：干 + 支藏干）——
  var luck = opts.luck || [];
  var luckBranches = [];
  for (i = 0; i < luck.length; i++) {
    var L = luck[i];
    if (!L.gz || L.gz.length < 2) continue;
    var gc = L.gz.charAt(0), zc = L.gz.charAt(1);
    var w = LUCK_W[L.kind], pos = LUCK_POS[L.kind];
    stems.push({ char: gc, el: ganWx(gc), val: w.gan, pillar: pos, isDay: false, kind: L.kind });
    var lhg = LunarUtil.ZHI_HIDE_GAN[zc], lws = HIDE_W[lhg.length];
    for (j = 0; j < lhg.length; j++) {
      hidden.push({ char: lhg[j], el: ganWx(lhg[j]), val: w.zhi * lws[j], pillar: pos, rank: j, kind: L.kind });
    }
    luckBranches.push({ pos: pos, zhi: zc });
  }

  // Step0a 刑冲合害：原局相邻 + 岁运对全盘地支无距离 + 岁运彼此
  var pairs = [];
  for (i = 0; i < plist.length - 1; i++) {
    pairs.push({ aPos: plist[i].pos, aZhi: plist[i].zhi, bPos: plist[i + 1].pos, bZhi: plist[i + 1].zhi });
  }
  for (i = 0; i < luckBranches.length; i++) {
    for (j = 0; j < plist.length; j++) {
      pairs.push({ aPos: plist[j].pos, aZhi: plist[j].zhi, bPos: luckBranches[i].pos, bZhi: luckBranches[i].zhi });
    }
  }
  for (i = 0; i < luckBranches.length; i++) {
    for (j = i + 1; j < luckBranches.length; j++) {
      pairs.push({ aPos: luckBranches[i].pos, aZhi: luckBranches[i].zhi, bPos: luckBranches[j].pos, bZhi: luckBranches[j].zhi });
    }
  }
  applyRelations(hidden, pairs);

  // Step1 同柱：通根认全部藏干（同字，含中气/余气），生克只限本气（rank=0）；
  //        天干与本气双方都用「同步初值」计算，避免先后顺序偏差。
  for (var s1 = 0; s1 < stems.length; s1++) {
    var st = stems[s1];
    var stv0 = st.val;          // 固定天干初值
    var dSt = 0, multSt = 1;
    for (var h = 0; h < hidden.length; h++) {
      if (hidden[h].pillar !== st.pillar) continue;
      var hd = hidden[h];
      var hdv = hd.val;
      if (hd.char === st.char) {                                                                  // 同柱通根（同字，全rank）
        dSt += C_ROOT * hdv;
      } else if (hd.rank === 0) {                                                                  // 仅本气参与生克
        if (hd.el === st.el) { /* 同五行异字：无互动 */ }
        else if (SHENG[hd.el] === st.el) { dSt += C_SHENG * hdv; hd.val = hdv * (1 - C_XIE); }    // 支生干
        else if (KE[hd.el] === st.el) { dSt -= C_KE * hdv; hd.val = hdv * (1 - C_COST); }         // 截脚：支克干
        else if (SHENG[st.el] === hd.el) { hd.val = hdv + C_SHENG * stv0; multSt *= (1 - C_XIE); } // 干生支
        else if (KE[st.el] === hd.el) { hd.val = hdv - C_KE * stv0; multSt *= (1 - C_COST); }      // 盖头：干克支
      }
    }
    st.val = stv0 * multSt + dSt;
  }

  // Step3 异柱通根（同字才算根，同五行异字不算；跨原局/岁运通用）
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

// 旺衰聚合（含得令；same=印比，diff=食财官杀）—— 第③批将由占比决策树替换
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
    var hh = model.hidden[i];
    var party = partyOf(dm, hh.el);
    var v = hh.val;
    if (hh === monthMain && party === 'same') v *= DELING_X;   // 得令
    if (party === 'same') same += v; else diff += v;
  }
  var sameAdj = same * SAME_X;
  var total = sameAdj + diff;
  return { p: total > 0 ? sameAdj / total : 0.5, same: same, diff: diff };
}

function shiShen(dayGan, ch, isDay) {
  return isDay ? '日主' : LunarUtil.SHI_SHEN[dayGan + ch];
}

// 主入口：返回 8 格显示模型（原局天干 + 地支）+ 旺衰
// opts: { daYunGZ, liuNianGZ }  传入岁运干支字符串则并入占比池
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

  // 岁运进池
  var luck = [];
  if (opts.daYunGZ && opts.daYunGZ.length >= 2) luck.push({ gz: opts.daYunGZ, kind: 'dy' });
  if (opts.liuNianGZ && opts.liuNianGZ.length >= 2) luck.push({ gz: opts.liuNianGZ, kind: 'ln' });
  var hasLuck = luck.length > 0;

  var natalBase = computeNatal(plist, dayGan, {});
  var natalNow = hasLuck ? computeNatal(plist, dayGan, { luck: luck }) : natalBase;

  // 显示格仍取原局字（岁运字进池算能量、暂不单独成格 —— 第④批显示层处理）
  // natalNow.stems 前 plist.length 项即原局，与 natalBase.stems 一一对应
  var ganCells = [];
  for (var i = 0; i < plist.length; i++) {
    var s = natalNow.stems[i], sb = natalBase.stems[i];
    ganCells.push({
      pos: PLBL[s.pillar], char: s.char, cls: WX_CLS[s.el], el: s.el,
      god: shiShen(dayGan, s.char, s.isDay), isDay: s.isDay,
      base: round2(sb.val), val: round2(s.val), delta: round2(s.val - sb.val),
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

  // 全部原局藏干的十神单元（供「两种底色」按天干地支所有十神统计）
  var hiddenUnits = [];
  var natalHidLen = natalBase.hidden.length;
  for (var hu = 0; hu < natalHidLen; hu++) {
    var hn = natalNow.hidden[hu], hbn = natalBase.hidden[hu];
    hiddenUnits.push({
      god: LunarUtil.SHI_SHEN[dayGan + hn.char],
      el: hn.el,
      base: round2(hbn.val),
      val: round2(hn.val),
      party: partyOf(natalNow.dm, hn.el)
    });
  }

  // 旺衰：本命 / 岁运后（全池）
  var aggBase = aggregate(natalBase);
  var aggNow = hasLuck ? aggregate(natalNow) : aggBase;

  // 全池五行占比（原局 + 岁运，含日元）—— 决策树输入
  var poolNow = poolPct(natalNow);
  var poolBase = poolPct(natalBase);

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
    pNow: Math.round(aggNow.p * 100),
    pool: poolNow,
    poolBase: poolBase
  };
}

// 全池五行占比（百分数 map）
function poolPct(model) {
  var WX = ['木', '火', '土', '金', '水'], sum = {}, tot = 0;
  WX.forEach(function (e) { sum[e] = 0; });
  model.stems.forEach(function (s) { sum[s.el] += s.val; tot += s.val; });
  model.hidden.forEach(function (h) { sum[h.el] += h.val; tot += h.val; });
  var p = {};
  WX.forEach(function (e) { p[e] = tot > 0 ? sum[e] / tot * 100 : 0; });
  return p;
}

function round2(n) { return Math.round(n * 100) / 100; }

module.exports = { build: build };
