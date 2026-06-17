// 性格画像（外显·天干版）
// 大部分人身上都有不止一种心性，只是成分比例不同；这里取天干（最外显的一层）
// 所代表的十神构成「心性」，并按身强身弱程度给出每种心性当前的状态（顺势/蓄势/均衡），
// 状态强度 = 失衡度 |P-50|×2，方向随旺衰而定；P 随大运/流年改写，故状态此消彼长。
// 措辞保持中立，不出现喜忌等评价性字眼。
var energy = require('./energy.js');
var base = require('./base.js');

// 十神 → 外显心性（name 心性名，pol 正/偏 倾向，desc 外在表现）
var TEMP = {
  比肩: { name: '自立', pol: '正', desc: '独立有主见，凡事先靠自己，能扛事、讲对等；这股劲收放得宜时格外可靠。' },
  劫财: { name: '果敢', pol: '偏', desc: '行动力强、敢拼敢争，重朋友义气、说做就做；爆发力是你天然的底牌。' },
  食神: { name: '从容', pol: '正', desc: '温和乐天，懂享受、会生活，才情与口才自然流露；节奏从容，自带松弛感。' },
  伤官: { name: '锋芒', pol: '偏', desc: '才华外露、脑子快，敢表达敢挑战、不服权威；锋芒用对地方就是亮点。' },
  偏财: { name: '灵活', pol: '偏', desc: '交际广、嗅觉灵，慷慨会变通，对机会与人脉敏感；活络是你打开局面的方式。' },
  正财: { name: '务实', pol: '正', desc: '踏实勤恳，重承诺、会规划，钱与事都打理得有条理；稳，是你的护城河。' },
  七杀: { name: '开拓', pol: '偏', desc: '果决有魄力、抗压强，乱局里反而能成事，自带威势；越是硬仗越能顶上。' },
  正官: { name: '自律', pol: '正', desc: '端正守规，重名誉与责任，做事有章法、让人信任；框架感是你的稳定器。' },
  偏印: { name: '钻研', pol: '偏', desc: '思维独特、直觉与悟性高，偏爱冷门与深度；安静下来时最出灵感。' },
  正印: { name: '宽厚', pol: '正', desc: '仁厚好学、念旧重情，耐心包容、贵人缘佳；这份温度让人愿意靠近。' }
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

// 某党羽在某 P 下的状态：顺势 / 蓄势 / 均衡（中立措辞）
// party: 'same' 生扶（印比） / 'diff' 克泄耗（财官食伤）
function flowState(party, p) {
  var inten = intensity(p);
  if (inten < 10) return { tag: '均衡', dir: 'mid', pct: inten };
  var favorable = p >= 50 ? 'diff' : 'same'; // 偏旺时克泄耗顺势，偏弱时生扶顺势
  if (party === favorable) return { tag: '顺势', dir: 'flow', pct: inten };
  return { tag: '蓄势', dir: 'store', pct: inten };
}

/**
 * @param {object} chart bazi.computeChart 返回值
 * @param {object} opts  { daYunGZ, liuNianGZ } 叠加岁运则 P 随之改写，状态联动
 */
function build(chart, opts) {
  opts = opts || {};
  var dayGan = chart.meta.dayGan;
  var m = energy.build(chart, opts);
  var P = m.pNow, Pb = m.pBase;

  // 仅取非日主天干（最外显的一层）
  var stems = m.ganCells.filter(function (c) { return !c.isDay; });

  // 按十神聚合（能量仅用于排序与「最突出」判断，不作为百分比）
  var agg = {};
  var zb = 0, zn = 0, baseTotal = 0, nowTotal = 0;
  stems.forEach(function (c) {
    if (!agg[c.god]) agg[c.god] = { god: c.god, party: c.party, cls: c.cls, energy: 0 };
    agg[c.god].energy += c.val;
    baseTotal += c.base;
    nowTotal += c.val;
    var tt = TEMP[c.god];
    if (tt && tt.pol === '正') { zb += c.base; zn += c.val; }
  });

  var list = [];
  for (var g in agg) {
    var t = TEMP[g] || { name: g, pol: '', desc: '' };
    var st = flowState(agg[g].party, P);
    var stb = flowState(agg[g].party, Pb);
    list.push({
      god: g, name: t.name, pol: t.pol, desc: t.desc, cls: agg[g].cls,
      tag: st.tag, dir: st.dir, pct: st.pct,
      basePct: stb.pct, energy: agg[g].energy
    });
  }
  // 排序：顺势在前 → 均衡 → 蓄势，让正向状态先出现；同组按能量
  var rank = { flow: 0, mid: 1, store: 2 };
  list.sort(function (a, b) {
    if (rank[a.dir] !== rank[b.dir]) return rank[a.dir] - rank[b.dir];
    return b.energy - a.energy;
  });

  // 最突出两种（按外显能量，体现「两种心性」）
  var byEnergy = list.slice().sort(function (a, b) { return b.energy - a.energy; });
  var topTwo = byEnergy.slice(0, 2);

  // 守正 / 求变（正神 vs 偏神，能量占比，保留）
  var zhengNow = nowTotal ? Math.round(zn / nowTotal * 100) : 50;
  var zhengBase = baseTotal ? Math.round(zb / baseTotal * 100) : 50;

  // 当前旺衰状态
  var inten = intensity(P);
  var stateLabel = P > 55 ? '偏旺' : (P < 45 ? '偏弱' : '中和');
  var flowGroup = P >= 50 ? '向外发挥的一类（食伤·财·官杀）' : '向内蓄养的一类（印星·比劫）';

  var coreInfo = CORE[dayGan] || { title: dayGan, text: '' };

  // 盘面（紧凑四柱）
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
