// 性格画像纯规则层：五行喜忌、病重分类、十神覆盖与滑标方向。
// 本文件不拼页面文案、不管理大运选择，便于独立回归测试。
var base = require('./base.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;

var WX = ['木', '火', '土', '金', '水'];
var SHENG = base.SHENG;
var KE = base.KE;

var SPECIAL_PIAN = { 劫财: true, 伤官: true, 七杀: true, 偏印: true };
var EXCESS_CONFLICTS = {
  伤官过旺: { 正官: '伤官见官' },
  偏印过旺: { 食神: '枭神夺食' },
  劫财过旺: { 正财: '劫财夺财', 偏财: '劫财夺财' },
  七杀过旺: { 比肩: '七杀制身' }
};
var RIGHT_SOFT_CAP_GODS = { 正财: true, 比肩: true, 偏财: true, 食神: true, 正印: true };
var BODY_ROOT_STARS = { 长生: true, 冠带: true, 临官: true, 帝旺: true };

function wxIdx(e) { return WX.indexOf(e); }
function shengI(i) { return (i + 1) % 5; }
function keI(i) { return (i + 2) % 5; }

function partyGod(dmEl, e) {
  var di = wxIdx(dmEl), ei = wxIdx(e);
  if (ei === di) return '比劫';
  if (ei === shengI(di)) return '食伤';
  if (ei === keI(di)) return '财';
  if (ei === (di + 3) % 5) return '官杀';
  return '印';
}

function dominantGod(godEnergy, left, right) {
  return (godEnergy[left] || 0) > (godEnergy[right] || 0) ? left : right;
}

function diseaseSubtype(party, godEnergy) {
  if (party === '食伤') return dominantGod(godEnergy, '伤官', '食神') + '过旺';
  if (party === '印') return dominantGod(godEnergy, '偏印', '正印') + '过旺';
  if (party === '比劫') return dominantGod(godEnergy, '劫财', '比肩') + '过旺';
  if (party === '官杀') return dominantGod(godEnergy, '七杀', '正官') + '过旺';
  if (party === '财') return dominantGod(godEnergy, '偏财', '正财') + '过旺';
  return '';
}

// diseaseP 只负责病重阈值；p 负责病重后的药病关系和非病重结构判断。
function decideXiji(p, dmEl, rootEls, godEnergy, diseaseP, bodyRootInfo) {
  rootEls = rootEls || {};
  godEnergy = godEnergy || {};
  diseaseP = diseaseP || p;
  bodyRootInfo = bodyRootInfo || { rooted: false, roots: [] };
  var bodyRooted = !!bodyRootInfo.rooted;
  var godTotal = 0;
  for (var godName in godEnergy) godTotal += godEnergy[godName] || 0;
  var qiShaPct = godTotal > 0 ? (godEnergy['七杀'] || 0) / godTotal * 100 : 0;
  var diseaseTop = WX[0];
  WX.forEach(function (e) { if (diseaseP[e] > diseaseP[diseaseTop]) diseaseTop = e; });
  var dir = {}, mode, disease = null, subtype = '';
  var ti = 0, shiShang = 0, biJie = 0;

  WX.forEach(function (e) {
    var g = partyGod(dmEl, e);
    if (g === '食伤') { ti += p[e]; shiShang += p[e]; }
    if (g === '比劫') { ti += p[e]; biJie += p[e]; }
  });

  var diseaseEls = WX.filter(function (e) { return (diseaseP[e] || 0) >= 40; });
  var subtypes = diseaseEls.map(function (e) {
    return diseaseSubtype(partyGod(dmEl, e), godEnergy);
  }).filter(function (s) { return !!s; });

  if (diseaseEls.length) {
    mode = '病重';
    disease = diseaseTop;
    subtype = diseaseSubtype(partyGod(dmEl, diseaseTop), godEnergy);
    var D = diseaseTop, di = wxIdx(D), diseaseIsBi = partyGod(dmEl, D) === '比劫';
    var bodyWeak = !bodyRooted;

    WX.forEach(function (e) {
      var i = wxIdx(e), v;
      if (e === D) v = '-';
      else if (shengI(i) === di) v = '-';
      else if (keI(i) === di) v = '+';
      else if (shengI(di) === i) {
        if (diseaseIsBi) v = '+';
        else if ((partyGod(dmEl, e) === '财' || partyGod(dmEl, e) === '官杀') && bodyWeak) v = '-';
        else v = '+';
      } else if (keI(di) === i) {
        // 病五行克出去，基础按喜处理；劫财夺财、伤官见官等明确病重冲突由 fixedGodDir 单独覆盖。
        v = '+';
      } else v = '-';
      dir[e] = v;
    });

    // 病五行和所有生病五行是硬锁，普通偏神修正不得翻转。
    diseaseEls.forEach(function (diseaseEl) {
      dir[diseaseEl] = '-';
      WX.forEach(function (e) {
        if (SHENG[e] === diseaseEl) dir[e] = '-';
      });
    });
  } else if (ti >= 40) {
    if (shiShang > biJie) {
      subtype = dominantGod(godEnergy, '伤官', '食神') + '偏旺';
      mode = subtype;
      WX.forEach(function (e) {
        var foodExcessGod = partyGod(dmEl, e);
        if (foodExcessGod === '食伤') dir[e] = '-';
        else if (foodExcessGod === '比劫') dir[e] = bodyRooted ? '-' : '+';
        else dir[e] = '+';
      });
    } else {
      mode = '体旺';
      WX.forEach(function (e) {
        var strongGod = partyGod(dmEl, e);
        dir[e] = (strongGod === '比劫' || strongGod === '印') ? '-' : '+';
      });
    }
  } else {
    mode = '体弱';
    WX.forEach(function (e) {
      var weakGod = partyGod(dmEl, e);
      dir[e] = (weakGod === '比劫' || weakGod === '印') ? '+' : '-';
    });
  }

  return {
    dir: dir,
    mode: mode,
    disease: disease,
    diseaseEls: diseaseEls,
    subtype: subtype,
    subtypes: subtypes,
    bodyRooted: bodyRooted,
    rootStars: bodyRootInfo.roots || [],
    qiShaPct: qiShaPct
  };
}

function capTraitRight(god, pos) {
  return RIGHT_SOFT_CAP_GODS[god] ? Math.min(pos, 65) : pos;
}

function traitSliderPos(d, godPct, god) {
  var mag = Math.min(25, Math.max(10, Math.round(Math.max(0, godPct - 10))));
  if (d === '+') return 50 - mag;
  if (d === '-') return capTraitRight(god, 50 + mag);
  return 50;
}

function detectTraitPattern(arr, godPct, stems) {
  function pct(g) { return godPct[g] || 0; }
  function ratio(a, b) {
    var hi = Math.max(a, b), lo = Math.min(a, b);
    return hi > 0 ? lo / hi : 0;
  }
  function stemSum(names) {
    var n = 0;
    (stems || []).forEach(function (c) {
      if (names.indexOf(c.god) >= 0) n += c.val || 0;
    });
    return n;
  }

  var shi = pct('食神'), sha = pct('七杀');
  if (shi >= 18 && sha >= 18 && ratio(shi, sha) >= 0.75) {
    return { name: '食神制杀', dirByGod: { 食神: '+', 七杀: '+' } };
  }

  var stemBody = stemSum(['比肩', '劫财']);
  var stemSha = stemSum(['七杀']);
  var stemJie = stemSum(['劫财']);
  if (stemBody > 0 && stemSha > 0 && ratio(stemBody, stemSha) >= 0.70) {
    if (stemJie > 0) {
      return { name: '羊刃驾杀', dirByGod: { 劫财: '0', 比肩: '0', 七杀: '0' } };
    }
    return {
      name: '身杀两停',
      dirByGod: { 比肩: '+', 劫财: '+', 正财: '+', 偏财: '+', 七杀: '+', 正官: '+' }
    };
  }
  return null;
}

function rootElsOf(chart, opts) {
  opts = opts || {};
  var out = {};
  function add(zhi) {
    if (!zhi) return;
    out[base.ganWx(LunarUtil.ZHI_HIDE_GAN[zhi][0])] = 1;
  }
  chart.pillars.forEach(function (p) { if (!p.empty && p.zhi) add(p.zhi.text); });
  if (opts.daYunGZ && opts.daYunGZ.length >= 2) add(opts.daYunGZ.charAt(1));
  if (opts.liuNianGZ && opts.liuNianGZ.length >= 2) add(opts.liuNianGZ.charAt(1));
  return out;
}

function bodyRootInfoOf(chart) {
  var names = ['年支', '月支', '日支'];
  var roots = [];
  [0, 1, 2].forEach(function (pillarIndex) {
    var pillar = chart.pillars[pillarIndex];
    if (!pillar || pillar.empty || !pillar.zhi || !BODY_ROOT_STARS[pillar.xingYun]) return;
    roots.push({
      pillar: pillarIndex,
      label: names[pillarIndex],
      zhi: pillar.zhi.text,
      xingYun: pillar.xingYun
    });
  });
  return { rooted: roots.length > 0, roots: roots };
}

function godEnergyOf(model, includeLuck) {
  var out = {};
  function add(god, val) {
    if (!god || god === '日主') return;
    out[god] = (out[god] || 0) + (val || 0);
  }
  (model.ganCells || []).forEach(function (c) { if (!c.isDay) add(c.god, c.val); });
  (model.hiddenUnits || []).forEach(function (u) { add(u.god, u.val); });
  if (includeLuck) {
    (model.luckGanUnits || []).forEach(function (u) { add(u.god, u.val); });
    (model.luckZhiUnits || []).forEach(function (u) { add(u.god, u.val); });
  }
  return out;
}

function fixedGodDir(god, el, activeXiji) {
  activeXiji = activeXiji || { dir: {}, subtypes: [] };
  var dir = activeXiji.dir[el] || '0';
  for (var i = 0; i < (activeXiji.subtypes || []).length; i++) {
    var hit = EXCESS_CONFLICTS[activeXiji.subtypes[i]];
    if (hit && hit[god]) {
      return { dir: '-', reason: hit[god], reasonCode: 'EXCESS_CONFLICT' };
    }
  }
  return { dir: dir, reason: '', reasonCode: 'BASE_XIJI' };
}

function diseaseSupportOf(target, activeXiji) {
  if (!activeXiji || activeXiji.mode !== '病重') return null;
  for (var i = 0; i < (activeXiji.diseaseEls || []).length; i++) {
    var diseaseEl = activeXiji.diseaseEls[i];
    if (target.el === diseaseEl) return { el: diseaseEl, kind: '扶' };
    if (SHENG[target.el] === diseaseEl) return { el: diseaseEl, kind: '生' };
  }
  return null;
}

function isDiseaseGod(god, activeXiji) {
  return !!activeXiji && (activeXiji.subtypes || []).indexOf(god + '过旺') >= 0;
}

function diseaseExtraCon(god, activeXiji) {
  return god === '伤官' && isDiseaseGod(god, activeXiji) ? ['对抗权威', '漠视规则'] : [];
}

module.exports = {
  WX: WX,
  SPECIAL_PIAN: SPECIAL_PIAN,
  EXCESS_CONFLICTS: EXCESS_CONFLICTS,
  partyGod: partyGod,
  decideXiji: decideXiji,
  traitSliderPos: traitSliderPos,
  detectTraitPattern: detectTraitPattern,
  rootElsOf: rootElsOf,
  bodyRootInfoOf: bodyRootInfoOf,
  godEnergyOf: godEnergyOf,
  fixedGodDir: fixedGodDir,
  diseaseSupportOf: diseaseSupportOf,
  isDiseaseGod: isDiseaseGod,
  diseaseExtraCon: diseaseExtraCon
};
