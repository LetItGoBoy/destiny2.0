// 性格画像（外显·天干版）
// 大部分人身上都有不止一种心性，只是配比不同。
// 「两种底色」（守正/求变）取天干地支所有十神（含藏干）统计；
// 「心性构成」取天干（最外显的一层）的十神，每种心性以一条优点(左)←→缺点(右)的轴呈现：
//   方向（偏优/偏缺）随身强身弱而定，幅度 = 失衡度 |P-50|×2 × 该心性在天干的相对能量，
//   故各心性会随大运/流年各自此消彼长，而非同步。措辞保持中立、收敛。
var energy = require('./energy.js');
var base = require('./base.js');

// 十神 → 外显心性（name 心性名，pol 正/偏，lbl 左端顺，rbl 右端偏，pro 优点描述，con 缺点描述）
// 七杀右端词依旺衰动态切换，用 rblStrong/rblWeak 分别存储
var TEMP = {
  比肩: { name: '自立', pol: '正', lbl: '有主见、靠得住', rbl: '固执、不肯回头',
          pro: '独立有主见，靠自己也扛得住，待人讲对等。', con: '主意定了不太肯改，偶尔显得倔。' },
  劫财: { name: '果敢', pol: '偏', lbl: '当断则断', rbl: '冲动、意气用事',
          pro: '行动力强、敢拼，重义气、说做就做。', con: '上头时容易冲，花钱也容易没个准。' },
  食神: { name: '从容', pol: '正', lbl: '张弛有度', rbl: '贪图安逸',
          pro: '温和乐天，懂享受、有才情，自带松弛感。', con: '太舒服时容易松，少了点紧迫劲。' },
  伤官: { name: '锋芒', pol: '偏', lbl: '表达有度', rbl: '张扬、好辩',
          pro: '才华外露、脑子快，敢表达敢挑战。', con: '话偶尔太直，得理时记得留三分。' },
  偏财: { name: '灵活', pol: '偏', lbl: '圆融应变', rbl: '见异思迁',
          pro: '交际广、嗅觉灵，慷慨会变通。', con: '精力和钱容易铺得太散，难聚焦。' },
  正财: { name: '务实', pol: '正', lbl: '精打细算', rbl: '锱铢必较',
          pro: '踏实勤恳，重承诺、会规划，稳。', con: '偏求稳，有时和机会擦肩。' },
  七杀: { name: '开拓', pol: '偏', lbl: '果决担当', rbl: '强势压人', rblWeak: '胆小怕事',
          pro: '果决有魄力、抗压，硬仗顶得上。', con: '急起来偏强势，无意中容易碰人。' },
  正官: { name: '自律', pol: '正', lbl: '有章有法', rbl: '刻板拘谨',
          pro: '端正守规、有章法，让人信任。', con: '偏循规，放开手脚需要点勇气。' },
  偏印: { name: '钻研', pol: '偏', lbl: '深思专注', rbl: '钻牛角尖',
          pro: '思维独特、悟性高，安静时最出灵感。', con: '想得多动得慢，偶尔会犯嘀咕。' },
  正印: { name: '宽厚', pol: '正', lbl: '仁厚重情', rbl: '心软耳软',
          pro: '仁厚好学、念旧重情，让人愿意靠近。', con: '心一软容易被牵着走，起步偏慢。' }
};

// 日主天干 → 外在底色（第一印象）
var CORE = {
  甲: { title: '甲木 · 栋梁', text: '像向上生长的大树，第一印象正直、有方向感，认定的事愿意一路扛到底；自带带头的气场。' },
  乙: { title: '乙木 · 藤蔓', text: '像柔韧的花草藤蔓，温和、有弹性，懂得借力与迂回；待人细腻，适应环境的本事很强。' },
  丙: { title: '丙火 · 太阳', text: '像正午的阳光，热情、外放、有感染力，走到哪儿都自带光和热；情绪来得快，也藏不住。' },
  丁: { title: '丁火 · 灯烛', text: '像温暖的灯火，外表温和、内里有光，善于照顾人、洞察人心；安静处事，却很有存在感。' },
  戊: { title: '戊土 · 高山', text: '像厚重的山岳，沉稳、可靠、有包容度，是旁人眼里能托付的那一个；变动面前偏稳健。' },
  己: { title: '己土 · 沃土', text: '像温润的田园，低调、随和、会成全人，心思细密、滋养力强；不爱张扬，韧性藏在里头。' },
  庚: { title: '庚金 · 利刃', text: '像刚硬的钢铁，干脆、果断、讲原则，执行力强、说到做到；锋芒在外，直来直往。' },
  辛: { title: '辛金 · 珠玉', text: '像精致的珠玉，审美好、有分寸、重质感，敏感而要强；在意细节，也在意被怎样对待。' },
  壬: { title: '壬水 · 江河', text: '像奔流的大江，聪明、豪爽、点子多，胸襟开阔、行动快；喜欢自由，不爱被框住。' },
  癸: { title: '癸水 · 雨露', text: '像细润的雨露，安静、聪慧、直觉准，温柔又有渗透力；心思深，外柔而内里有韧劲。' }
};

function intensity(p) { return Math.round(Math.abs(p - 50) * 2); }

// 某党羽在某 P 下偏优还是偏缺（中立方向）
// party: 'same' 生扶（印比）/ 'diff' 克泄耗（财官食伤）
// 偏旺时克泄耗发挥（偏优），生扶过满（偏缺）；偏弱反之；近中和则均衡。
function direction(party, p) {
  if (intensity(p) < 10) return 'mid';
  var favorable = p >= 50 ? 'diff' : 'same';
  return party === favorable ? 'pro' : 'con';
}

/**
 * @param {object} chart bazi.computeChart 返回值
 * @param {object} opts  { daYunGZ, liuNianGZ }
 */
function build(chart, opts) {
  opts = opts || {};
  var dayGan = chart.meta.dayGan;
  var m = energy.build(chart, opts);
  var P = m.pNow, Pb = m.pBase;
  var inten = intensity(P), intenBase = intensity(Pb);

  // 仅取非日主天干（最外显的一层）
  var stems = m.ganCells.filter(function (c) { return !c.isDay; });

  // —— 两种底色：天干地支所有十神（含藏干） ——
  var zb = 0, zn = 0, bt = 0, nt = 0;
  function tallyPol(god, bv, vv) {
    bt += bv; nt += vv;
    var t = TEMP[god];
    if (t && t.pol === '正') { zb += bv; zn += vv; }
  }
  stems.forEach(function (c) { tallyPol(c.god, c.base, c.val); });
  (m.hiddenUnits || []).forEach(function (u) { tallyPol(u.god, u.base, u.val); });
  var zhengNow = nt ? Math.round(zn / nt * 100) : 50;
  var zhengBase = bt ? Math.round(zb / bt * 100) : 50;

  // —— 心性构成：天干十神，按能量聚合 ——
  var agg = {};
  stems.forEach(function (c) {
    if (!agg[c.god]) agg[c.god] = { god: c.god, party: c.party, cls: c.cls, energy: 0, baseEnergy: 0 };
    agg[c.god].energy += c.val;
    agg[c.god].baseEnergy += c.base;
  });
  var maxE = 0, maxEb = 0, g;
  for (g in agg) { if (agg[g].energy > maxE) maxE = agg[g].energy; if (agg[g].baseEnergy > maxEb) maxEb = agg[g].baseEnergy; }

  var list = [];
  for (g in agg) {
    var t = TEMP[g] || { name: g, pol: '', lbl: '', rbl: '', pro: '', con: '' };
    var dir = direction(agg[g].party, P);
    var dirB = direction(agg[g].party, Pb);
    var w = maxE > 0 ? agg[g].energy / maxE : 1;
    var wb = maxEb > 0 ? agg[g].baseEnergy / maxEb : 1;
    // 七杀右端词随旺衰切换
    var rbl = t.rbl;
    if (g === '七杀' && P < 50 && t.rblWeak) rbl = t.rblWeak;
    // 滑标位置：0=纯左，100=纯右，50=中间
    // dir=pro → 偏左，dir=con → 偏右，mid → 50
    var mag = Math.round(inten * w);
    var slider = dir === 'pro' ? Math.round(50 - mag / 2) : (dir === 'con' ? Math.round(50 + mag / 2) : 50);
    slider = Math.max(0, Math.min(100, slider));
    list.push({
      god: g, name: t.name, pol: t.pol, lbl: t.lbl, rbl: rbl, pro: t.pro, con: t.con, cls: agg[g].cls,
      dir: dir,
      mag: mag,
      slider: slider,
      magBase: Math.round(intenBase * wb),
      dirBase: dirB,
      energy: agg[g].energy
    });
  }
  // 排序：偏优在前 → 均衡 → 偏缺；同组按能量
  var rank = { pro: 0, mid: 1, con: 2 };
  list.sort(function (a, b) {
    if (rank[a.dir] !== rank[b.dir]) return rank[a.dir] - rank[b.dir];
    return b.energy - a.energy;
  });

  // 最突出两种（按外显能量）
  var byEnergy = list.slice().sort(function (a, b) { return b.energy - a.energy; });
  var topTwo = byEnergy.slice(0, 2);

  // 当前旺衰
  var stateLabel = P > 55 ? '偏旺' : (P < 45 ? '偏弱' : '中和');
  var flowGroup = P >= 50 ? '向外发挥的一类（食伤·财·官杀）' : '向内蓄养的一类（印星·比劫）';

  var coreInfo = CORE[dayGan] || { title: dayGan, text: '' };

  // 盘面
  var paimian = chart.pillars.map(function (p) {
    if (p.empty) return { label: p.label, empty: true };
    return {
      label: p.label,
      gan: p.gan.text, ganCls: p.gan.cls,
      zhi: p.zhi.text, zhiCls: p.zhi.cls,
      god: p.shiShenGan, isDay: p.shiShenGan === '日主'
    };
  });

  return {
    core: {
      gan: dayGan,
      cls: base.WX_CLS[base.ganWx(dayGan)],
      title: coreInfo.title,
      text: coreInfo.text
    },
    paimian: paimian,
    list: list,
    topTwo: topTwo,
    zhengNow: zhengNow, pianNow: 100 - zhengNow,
    zhengBase: zhengBase, pianBase: 100 - zhengBase,
    polShift: zhengNow !== zhengBase,
    sheng: P, ke: 100 - P, shengBase: Pb,
    inten: inten,
    stateLabel: stateLabel,
    flowGroup: flowGroup,
    wsShift: P !== Pb,
    hasLuck: m.hasLuck,
    hasTime: !chart.meta.unknownTime
  };
}

module.exports = { build: build };
