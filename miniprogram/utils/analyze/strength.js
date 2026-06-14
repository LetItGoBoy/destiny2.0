// 旺衰派：量化日主强弱，定喜用神
// 方法：得令（月令本气）+ 得地（地支有根）+ 党羽加权比（同党=印比，异党=财官食伤）
var base = require('./base.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;

function pct(n) {
  return Math.round(n * 100);
}

function analyze(ctx, t) {
  var dayGan = ctx.dayGan;
  var dm = t.dm;
  var p = t.total > 0 ? t.same / t.total : 0.5;

  // 得令：月支本气十神属印比
  var monthMain = LunarUtil.ZHI_HIDE_GAN[ctx.zhis[1]][0];
  var monthGod = LunarUtil.SHI_SHEN[dayGan + monthMain];
  var deLing = base.GOD_GROUP[monthGod] === '比劫' || base.GOD_GROUP[monthGod] === '印星';

  // 得地：通根
  var roots = base.findRoots(ctx.zhis, dayGan);

  // 印/比劫是否透干（年/月/时）
  var yinTou = false;
  var biTou = false;
  var idx = [0, 1, 3];
  for (var i = 0; i < idx.length; i++) {
    var grp = base.GOD_GROUP[LunarUtil.SHI_SHEN[dayGan + ctx.gans[idx[i]]]];
    if (grp === '印星') yinTou = true;
    if (grp === '比劫') biTou = true;
  }

  // 官杀/财星是否显现（透干或地支本气）——专旺格要求克破我者不现，财来坏印者不现
  var guanShaSeen = false;
  var caiSeen = false;
  var gi = [0, 1, 3];
  var seenGrp = function (g) {
    var grp = base.GOD_GROUP[LunarUtil.SHI_SHEN[dayGan + g]];
    if (grp === '官杀') guanShaSeen = true;
    if (grp === '财星') caiSeen = true;
  };
  for (var k = 0; k < gi.length; k++) seenGrp(ctx.gans[gi[k]]);
  for (var z = 0; z < 4; z++) seenGrp(LunarUtil.ZHI_HIDE_GAN[ctx.zhis[z]][0]);

  // 传统三才修正：得令为首（+6%）、每处通根加分（+2.5%/处）
  // 纯力量比值未能区分「根深少扶」与「真浮虚弱」，加成后再定级
  var bonus = 0;
  if (deLing) bonus += 0.06;
  bonus += roots.length * 0.025;
  var score = Math.min(p + bonus, 0.95);

  // 定级（从格需满足极端条件；专旺允许食伤吐秀）
  var level;
  var special = '';
  if (score >= 0.88 || (score >= 0.7 && deLing && !guanShaSeen && !caiSeen)) {
    level = '极强';
    special = '从强';
  } else if (score >= 0.62) {
    level = '身强';
  } else if (score >= 0.48) {
    level = '中和';
  } else if (score >= 0.3) {
    level = '身弱';
  } else if (!roots.length && !yinTou && !biTou) {
    level = '极弱';
    special = '从弱';
  } else {
    level = '太弱';
  }

  // 喜用 / 忌神
  var shengWo = base.shengWoOf(dm);
  var keWo = base.keWoOf(dm);
  var woSheng = base.SHENG[dm];
  var woKe = base.KE[dm];
  var xi = [];
  var ji = [];
  var xiNote = '';
  if (special === '从强') {
    xi = [dm, shengWo];
    ji = [keWo, woKe];
    xiNote = '全局生扶一气，宜顺其旺势，以印比为用，最忌逆势克伐。';
  } else if (special === '从弱') {
    // 顺从最旺的异党
    var grpScore = { 财星: t.god.正财 + t.god.偏财, 官杀: t.god.正官 + t.god.七杀, 食伤: t.god.食神 + t.god.伤官 };
    var top = '财星';
    if (grpScore.官杀 > grpScore[top]) top = '官杀';
    if (grpScore.食伤 > grpScore[top]) top = '食伤';
    var topWx = top === '财星' ? woKe : (top === '官杀' ? keWo : woSheng);
    xi = [topWx];
    ji = [dm, shengWo];
    xiNote = '日主无根无助，弃命相从，顺从' + top + '之势为吉，逆生扶反凶。';
  } else if (level === '身强' || level === '极强') {
    xi = [keWo, woSheng, woKe];
    ji = [shengWo, dm];
    xiNote = '日主偏强，喜克泄耗（官杀、食伤、财星）平衡命局，忌再行印比生扶。';
  } else if (level === '中和') {
    xi = [];
    ji = [];
    xiNote = '五行较为均衡，不偏不倚，以调候为先，喜岁运流通有情。';
  } else {
    xi = [shengWo, dm];
    ji = [keWo, woKe, woSheng];
    xiNote = '日主偏弱，喜印星生身、比劫帮身，忌官杀克身与财食盗泄。';
  }

  var toChips = function (arr) {
    return arr.map(function (wx) {
      return { wx: wx, cls: base.WX_CLS[wx] };
    });
  };

  // 说明文字
  var lines = [];
  lines.push('日主' + dayGan + '属' + dm + '，生于' + ctx.zhis[1] + '月，月令本气为' + monthGod + '，' + (deLing ? '得令而旺' : '失令无气') + '。');
  lines.push(roots.length ? '地支于' + roots.join('、') + '通根，根气' + (roots.length >= 2 ? '深厚' : '尚浅') + '。' : '四支无根，日主虚浮。');
  lines.push('全盘生扶力量约占 ' + pct(p) + '%，克泄耗约占 ' + pct(1 - p) + '%。');
  if (bonus > 0) {
    var bonusParts = [];
    if (deLing) bonusParts.push('得令+6%');
    if (roots.length) bonusParts.push('通根' + roots.length + '处+' + pct(roots.length * 0.025) + '%');
    lines.push('综合三才（得令·得地）修正后有效强度约 ' + pct(score) + '%（' + bonusParts.join('、') + '）。');
  }

  var verdict;
  if (special === '从强') verdict = '综合判定：从强格局，旺之极者宜顺不宜逆。';
  else if (special === '从弱') verdict = '综合判定：从弱（弃命）格局，弱极反以从势为安。';
  else verdict = '综合判定：日主' + level + '。' ;

  return {
    level: level,
    special: special,
    samePct: pct(p),
    diffPct: pct(1 - p),
    deLing: deLing,
    roots: roots,
    xiYong: toChips(xi),
    jiShen: toChips(ji),
    xiNote: xiNote,
    lines: lines,
    verdict: verdict
  };
}

module.exports = { analyze: analyze };
