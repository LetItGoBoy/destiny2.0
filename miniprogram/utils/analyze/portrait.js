// 性格画像（外显·天干版）
// 思路：大部分人身上都有不止一种心性，只是成分比例不同；
// 这里取天干（最外显的一层）所代表的十神，按其能量占比构成「心性」，
// 并随大运/流年作用而此消彼长（能量改写沿用 energy.js）。
var energy = require('./energy.js');
var base = require('./base.js');

// 十神 → 外显心性（name 心性名，pol 正/偏 倾向，desc 外在表现）
var TEMP = {
  比肩: { name: '自立', pol: '正', desc: '独立有主见，凡事先靠自己，能扛事、讲对等，不爱被支配；用力过头时会显得固执、不肯低头。' },
  劫财: { name: '果敢', pol: '偏', desc: '行动力强、敢拼敢争，重朋友义气、输人不输阵；情绪上头时容易冲动，也容易破财。' },
  食神: { name: '从容', pol: '正', desc: '温和乐天，懂享受、会生活，才情与口才自然流露；节奏从容，但有时偏安逸、缺一点紧迫感。' },
  伤官: { name: '锋芒', pol: '偏', desc: '才华外露、脑子快，敢表达敢挑战、不服权威；话锋利时容易得罪人，也容易心高气傲。' },
  偏财: { name: '灵活', pol: '偏', desc: '交际广、嗅觉灵，慷慨会变通，对机会与人脉敏感；爱热闹，注意精力与钱财别太分散。' },
  正财: { name: '务实', pol: '正', desc: '踏实勤恳，重承诺、会规划，钱与事都打理得有条理；偏爱稳妥，有时会与机会擦肩。' },
  七杀: { name: '开拓', pol: '偏', desc: '果决有魄力、抗压强，乱局里反而能成事，自带威势；急起来较强势，无意间易树敌。' },
  正官: { name: '自律', pol: '正', desc: '端正守规，重名誉与责任，做事有章法、让人信任；在框架里最安心，放开手脚需要练习。' },
  偏印: { name: '钻研', pol: '偏', desc: '思维独特、直觉与悟性高，偏爱冷门与深度；偏内向，想得多、做得慢，易多思多疑。' },
  正印: { name: '宽厚', pol: '正', desc: '仁厚好学、念旧重情，耐心包容、贵人缘佳；遇事先求安稳，行动偏慢、依赖性稍强。' }
};

// 日主天干 → 外在底色（第一印象，区别于详批旧文案）
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

function pct(part, total) { return total > 0 ? Math.round((part / total) * 100) : 0; }

/**
 * @param {object} chart bazi.computeChart 返回值
 * @param {object} opts  { daYunGZ, liuNianGZ } 叠加岁运则比例随之改写
 */
function build(chart, opts) {
  opts = opts || {};
  var dayGan = chart.meta.dayGan;
  var m = energy.build(chart, opts);

  // 仅取非日主天干（最外显的一层）
  var stems = m.ganCells.filter(function (c) { return !c.isDay; });

  var agg = {};
  var baseTotal = 0, nowTotal = 0;
  stems.forEach(function (c) {
    if (!agg[c.god]) agg[c.god] = { god: c.god, base: 0, now: 0, cls: c.cls };
    agg[c.god].base += c.base;
    agg[c.god].now += c.val;
    baseTotal += c.base;
    nowTotal += c.val;
  });

  var list = [];
  for (var g in agg) {
    var t = TEMP[g] || { name: g, pol: '', desc: '' };
    list.push({
      god: g,
      name: t.name,
      pol: t.pol,
      desc: t.desc,
      cls: agg[g].cls,
      basePct: pct(agg[g].base, baseTotal),
      nowPct: pct(agg[g].now, nowTotal)
    });
  }
  list.sort(function (a, b) { return b.nowPct - a.nowPct; });
  list.forEach(function (it, i) { it.major = i < 2; });

  // 正/偏 两种底色倾向（守正 vs 求变）
  var zb = 0, zn = 0;
  stems.forEach(function (c) {
    var t = TEMP[c.god];
    if (t && t.pol === '正') { zb += c.base; zn += c.val; }
  });
  var zhengBase = pct(zb, baseTotal);
  var zhengNow = pct(zn, nowTotal);

  var coreInfo = CORE[dayGan] || { title: dayGan, text: '' };

  return {
    core: {
      gan: dayGan,
      cls: base.WX_CLS[base.ganWx(dayGan)],
      title: coreInfo.title,
      text: coreInfo.text
    },
    list: list,
    topTwo: list.slice(0, 2),
    zhengNow: zhengNow,
    pianNow: 100 - zhengNow,
    zhengBase: zhengBase,
    pianBase: 100 - zhengBase,
    polShift: zhengNow !== zhengBase,
    hasLuck: m.hasLuck,
    hasTime: !chart.meta.unknownTime
  };
}

module.exports = { build: build };
