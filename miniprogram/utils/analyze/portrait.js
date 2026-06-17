// 性格画像（外显·天干版）
// 大部分人身上都有不止一种心性，只是配比不同。
// 「两种底色」（守正/求变）取天干地支所有十神（含藏干）统计；
// 「心性构成」取天干（最外显的一层）的十神，每种心性以一条优点(左)←→缺点(右)的轴呈现：
//   方向（偏优/偏缺）随身强身弱而定，幅度 = 失衡度 |P-50|×2 × 该心性在天干的相对能量，
//   故各心性会随大运/流年各自此消彼长，而非同步。措辞保持中立、收敛。
var energy = require('./energy.js');
var base = require('./base.js');

// 十神 → 外显心性（name 心性名，pol 正/偏，lbl 左端顺，rbl 右端偏，desc 综合特质描述）
var TEMP = {
  比肩: { name: '自立', pol: '正', lbl: '自强果断', rbl: '据理力争',
          desc: '刚健果断、有毅力，不服输、勤奋努力，自我意识强、执行力好，做事靠得住；只是自尊心强、爱面子，认准的事容易据理力争，有时显得死板、多疑，偶尔说话不经思量。' },
  劫财: { name: '果敢', pol: '偏', lbl: '豪爽直率', rbl: '多疑挑剔',
          desc: '自信豪爽、热情直率，不怕困难、敢于竞争，口才好、朋友多，义气足、说做就做；只是容易多疑、对人挑剔，虚荣心强、有时爱攀比，在意外在评价，偶尔会为面子得不偿失。' },
  食神: { name: '从容', pol: '正', lbl: '温和乐善', rbl: '好逸恶劳',
          desc: '温和斯文、思维细腻，宽容善良、乐于奉献，人缘好、有人文情怀，生活里自带一份福气与从容；只是容易爱幻想、想得多做得少，自尊心强时不肯放下架子，日子舒坦了也容易好逸恶劳。' },
  伤官: { name: '锋芒', pol: '偏', lbl: '聪慧灵动', rbl: '恃才傲物',
          desc: '聪明、悟性高，才华横溢、创新能力强，表现欲足、个人魅力突出，追求完美、向往自由；只是锋芒难收时容易恃才傲物、争强好胜，不服管束、爱出风头，热情来得快去得也快，自律上常要费些力气。' },
  偏财: { name: '灵活', pol: '偏', lbl: '豁达大方', rbl: '用心不专',
          desc: '热情豁达、情商高，大方重义、善于交际，处事灵活、拿得起放得下，人缘好、广结善缘；只是欲望容易过强，有时不够克制，精力铺得太散难以专注，对感情和事业都偏向见异思迁。' },
  正财: { name: '务实', pol: '正', lbl: '踏实稳健', rbl: '锱铢必较',
          desc: '勤俭踏实、感情专一，守本分、不惹事，注重细节、善于理财，情绪感知细腻、现实而可靠；只是太过在意得失时容易显得保守小气，凡事计较、缺乏进取，求稳有余而开拓不足。' },
  七杀: { name: '开拓', pol: '偏', lbl: '果敢担当', rbl: '胆大妄为',
          desc: '有魄力、机警伶俐，目标感强、思维缜密，敢想敢干、善于谋略，做事有手段、务实果决；这股劲一旦走偏，容易多疑多虑、好斗冲动，或贪图捷径、行事胆大妄为不计后果，有时也可能走向另一面，变得瞻前顾后、内心纠结内耗。' },
  正官: { name: '自律', pol: '正', lbl: '稳健自律', rbl: '多虑悲观',
          desc: '自律、做事稳健，善于思考、有管理能力，遵守规矩、为人公道，责任心强、值得托付；只是太在意规则时容易悲观多虑，思前想后、不善变通，有时显得胆小怕事、意志不够坚定。' },
  偏印: { name: '钻研', pol: '偏', lbl: '精明善察', rbl: '多疑孤僻',
          desc: '思维独特、领悟力强，善于观察细节、警觉性高，好钻研、有创造力，安静独处时最出灵感；只是想得多了容易向内收，显得孤独不合群，心思深的同时也偏多疑，有时会钻进牛角尖里难以自拔。' },
  正印: { name: '宽厚', pol: '正', lbl: '仁慈善良', rbl: '优柔寡断',
          desc: '仁慈、心地善良，安静平和、有同情心，有修养、有智慧，注重内涵、有精神追求，是让人愿意靠近的温暖；只是容易懒惰、行动力偏弱，依赖性强，有时不思进取，优柔寡断、难下决心。' }
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
  var P = m.pNow;
  var inten = intensity(P);

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
    if (!agg[c.god]) agg[c.god] = { god: c.god, party: c.party, cls: c.cls, energy: 0 };
    agg[c.god].energy += c.val;
  });
  var maxE = 0, g;
  for (g in agg) { if (agg[g].energy > maxE) maxE = agg[g].energy; }

  var list = [];
  for (g in agg) {
    var t = TEMP[g] || { name: g, pol: '', lbl: '', rbl: '', desc: '' };
    var dir = direction(agg[g].party, P);
    var w = maxE > 0 ? agg[g].energy / maxE : 1;
    // 滑标位置：0=纯左，100=纯右，50=中间
    // dir=pro → 偏左，dir=con → 偏右，mid → 50
    var mag = Math.round(inten * w);
    var slider = dir === 'pro' ? Math.round(50 - mag / 2) : (dir === 'con' ? Math.round(50 + mag / 2) : 50);
    slider = Math.max(0, Math.min(100, slider));
    list.push({
      god: g, name: t.name, pol: t.pol, lbl: t.lbl, rbl: t.rbl, desc: t.desc, cls: agg[g].cls,
      slider: slider,
      energy: agg[g].energy
    });
  }
  // 能量从大到小排序：第一位为主心性
  list.sort(function (a, b) { return b.energy - a.energy; });

  // 用「能量圆点」表达各心性的突出程度（不露具体数字）
  list.forEach(function (it, idx) {
    var ratio = maxE > 0 ? it.energy / maxE : 1;
    var n = Math.max(1, Math.min(5, Math.round(ratio * 5)));
    var dots = [];
    for (var k = 1; k <= 5; k++) dots.push({ i: k, on: k <= n });
    it.dots = dots;
    it.isMain = idx === 0;
  });

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
    zhengNow: zhengNow, pianNow: 100 - zhengNow,
    hasLuck: m.hasLuck,
    hasTime: !chart.meta.unknownTime
  };
}

module.exports = { build: build };
