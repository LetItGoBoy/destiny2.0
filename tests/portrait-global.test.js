var test = require('node:test');
var assert = require('node:assert/strict');
var bazi = require('../miniprogram/utils/bazi.js');
var portrait = require('../miniprogram/utils/analyze/portrait.js');
var correction = require('../miniprogram/utils/analyze/portraitCorrection.js');
var traitWords = require('../miniprogram/utils/analyze/traitWords.js');
var portraitTraits = require('../miniprogram/utils/analyze/portraitTraits.js');
var portraitRules = require('../miniprogram/utils/analyze/portraitRules.js');
var portraitCopy = require('../miniprogram/utils/analyze/portraitCopy.js');
var diseaseStrengthWords = require('../miniprogram/utils/analyze/diseaseStrengthWords.js');
var favorablePianAttentionWords = require('../miniprogram/utils/analyze/favorablePianAttentionWords.js');

function chartOf(year, month, day, gender) {
  return bazi.computeChart({
    name: '回归命例',
    gender: gender,
    calendar: 'solar',
    year: year,
    month: month,
    day: day,
    hour: null,
    minute: null,
    unknownTime: true
  });
}

function axesOf(result) {
  return result.luckPortrait.traitLayer;
}

test('1948-06-21 壬戌大运触发伤官见官，病重伤官保持为忌', function () {
  var result = portrait.build(chartOf(1948, 6, 21, 1), { selectedLuckIndex: 4 });
  var layer = axesOf(result);

  assert.equal(result.luckPortrait.gz, '壬戌');
  assert.equal(result.luckPortrait.xiji.mode, '病重');
  assert.equal(layer.ganAxis.god, '正官');
  assert.equal(layer.ganAxis.traitDir, '-');
  assert.equal(layer.ganAxis.reasonCode, 'EXCESS_CONFLICT');
  assert.equal(layer.zhiAxis.god, '伤官');
  assert.equal(layer.zhiAxis.traitDir, '-');
  assert.equal(layer.zhiAxis.reasonCode, 'DISEASE_GOD_LOCK');
});

test('1995-03-02 七杀达到 20% 后，克泄七杀可越过病重锁转喜', function () {
  var chart = chartOf(1995, 3, 2, 1);
  var yiHai = axesOf(portrait.build(chart, { selectedLuckIndex: 3 }));
  var jiaXu = axesOf(portrait.build(chart, { selectedLuckIndex: 4 }));

  assert.equal(yiHai.ganAxis.god, '伤官');
  assert.equal(yiHai.ganAxis.traitDir, '+');
  assert.equal(yiHai.ganAxis.reasonCode, 'RELIEVE_QISHA');
  assert.equal(yiHai.zhiAxis.god, '比肩');
  assert.equal(yiHai.zhiAxis.traitDir, '-');
  assert.equal(yiHai.zhiAxis.reasonCode, 'DISEASE_SUPPORT_LOCK');

  assert.equal(jiaXu.ganAxis.god, '食神');
  assert.equal(jiaXu.ganAxis.traitDir, '+');
  assert.equal(jiaXu.ganAxis.reasonCode, 'RELIEVE_QISHA');
  assert.equal(jiaXu.zhiAxis.god, '七杀');
  assert.equal(jiaXu.zhiAxis.traitDir, '+');
});

test('1990-06-18 病重时生扶病五行不得被偏神修正翻转', function () {
  var result = portrait.build(chartOf(1990, 6, 18, 0), { selectedLuckIndex: 3 });
  var layer = axesOf(result);

  assert.equal(result.luckPortrait.gz, '己卯');
  assert.equal(layer.ganAxis.god, '正财');
  assert.equal(layer.ganAxis.traitDir, '+');
  assert.equal(layer.zhiAxis.god, '劫财');
  assert.equal(layer.zhiAxis.traitDir, '-');
  assert.equal(layer.zhiAxis.reasonCode, 'DISEASE_SUPPORT_LOCK');
});

test('引擎只返回所选大运，所选流年进入气泡滑标与关系检测', function () {
  var result = portrait.build(chartOf(1948, 6, 21, 1), {
    selectedLuckIndex: 4,
    selectedYear: 1984
  });

  assert.equal(result.stagePortraits, undefined);
  assert.equal(result.selectedYear, 1984);
  assert.equal(result.luckPortrait.traitLayer.luckName, '1984年');
  assert.equal(result.luckPortrait.traitLayer.yearCard.catImage, portraitTraits.catImageOf('正印'));
  assert.equal(result.luckPortrait.traitLayer.yearCard.desc, portraitCopy.liuNian['正印'].desc);
  assert.equal(result.luckSegments.find(function (item) { return item.active; }).summary, result.luckPortrait.summary);
  assert.ok(result.luckPortrait.traitLayer.bubbles.some(function (bubble) { return bubble.fromYear; }));
  assert.ok(result.relations.some(function (item) { return item.anyLuck; }));
});

test('全局修正按干支分层，并在缺时柱时归一已有三柱权重', function () {
  var chart = chartOf(1987, 10, 17, 1);
  var ganSources = correction.buildNatalSources(chart, 'gan');
  var zhiSources = correction.buildNatalSources(chart, 'zhi');
  var ganTotal = ganSources.reduce(function (sum, item) { return sum + item.weight; }, 0);
  var zhiTotal = zhiSources.reduce(function (sum, item) { return sum + item.weight; }, 0);

  assert.equal(ganSources.length, 3);
  assert.equal(zhiSources.length, 3);
  assert.ok(ganSources.some(function (item) { return item.god === '日主'; }));
  assert.ok(zhiSources.every(function (item) { return /支本气$/.test(item.label); }));
  assert.ok(Math.abs(ganTotal - 3.9) < 1e-9);
  assert.ok(Math.abs(zhiTotal - 3.9) < 1e-9);
});

test('普通伤官缺点包含任性随意', function () {
  assert.ok(traitWords['伤官'].con.indexOf('任性随意') >= 0);
});

test('七杀与劫财使用最新力量词和留意词', function () {
  assert.deepEqual(traitWords['七杀'].pro, ['杀伐果断', '警觉', '有手段', '敢闯敢冒险', '坚韧']);
  assert.ok(traitWords['七杀'].con.indexOf('赌性强') >= 0);
  assert.ok(traitWords['七杀'].con.indexOf('防备') >= 0);
  assert.equal(traitWords['七杀'].con.indexOf('赌性大'), -1);
  assert.ok(traitWords['劫财'].con.indexOf('固执') >= 0);
  assert.ok(traitWords['劫财'].con.indexOf('好胜') >= 0);
  assert.ok(traitWords['偏印'].con.indexOf('不爱社交') >= 0);
});

test('四大偏神为喜时各保留两枚小留意词', function () {
  assert.deepEqual(favorablePianAttentionWords, {
    劫财: ['固执', '好胜'],
    伤官: ['任性随意', '爱吃爱玩'],
    七杀: ['赌性强', '防备'],
    偏印: ['懒得动弹', '不爱社交']
  });

  Object.keys(favorablePianAttentionWords).forEach(function (god) {
    var bubbles = portraitTraits.buildTraitBubbles([{
      god: god,
      copyKind: 'natal',
      traitDir: '+',
      isZhengGod: false,
      isDiseaseGod: false,
      hasNatalBaseElement: true,
      slider: 35,
      baseSlider: 35,
      energyWeight: 1,
      energy: 1,
      sourceKey: 'test:喜:' + god
    }], null);
    var attention = bubbles.filter(function (bubble) { return bubble.kind === 'con'; });
    assert.deepEqual(attention.map(function (bubble) { return bubble.label; }), favorablePianAttentionWords[god]);
    assert.ok(attention.every(function (bubble) { return bubble.rawEnergy === 0.38; }));
  });
});

test('正偏印使用最新本色词与留意词', function () {
  assert.deepEqual(traitWords['正印'].neu, ['佛系', '求安稳', '喜静']);
  assert.deepEqual(traitWords['正印'].con, ['懒得动弹', '优柔寡断', '讨好', '守旧', '依赖', '不思进取']);
  assert.deepEqual(traitWords['偏印'].con, ['孤僻', '多疑', '冷', '偏执', '封闭', '胆小', '懒得动弹', '不爱社交']);
  assert.equal(traitWords['偏印'].con.indexOf('悲观'), -1);
  assert.equal(traitWords['偏印'].con.indexOf('说话带刺'), -1);
});

test('只有指定病重十神保留两枚力量词', function () {
  assert.deepEqual(diseaseStrengthWords, {
    比肩: ['独立', '坚守原则'],
    食神: ['善良', '宽容'],
    正印: ['仁慈', '平和'],
    正财: ['勤俭', '务实'],
    偏财: ['大方', '灵活']
  });
});

test('指定病重底色补充两枚小力量词、本色和留意', function () {
  var bubbles = portraitTraits.persistentDiseaseBubbles([], [], {
    mode: '病重',
    subtypes: ['正印过旺'],
    diseaseEls: []
  });
  assert.deepEqual(bubbles.filter(function (bubble) { return bubble.kind === 'pro'; }).map(function (bubble) { return bubble.label; }), ['仁慈', '平和']);
  assert.ok(bubbles.some(function (bubble) { return bubble.kind === 'neu' && bubble.label === '佛系'; }));
  assert.ok(bubbles.some(function (bubble) { return bubble.kind === 'con' && bubble.label === '懒得动弹'; }));
  assert.ok(bubbles.some(function (bubble) { return bubble.kind === 'con' && bubble.label === '不思进取'; }));
  var merged = portraitTraits.mergeTraitBubbles([bubbles]);
  var strengthBubble = merged.filter(function (bubble) { return bubble.kind === 'pro'; })[0];
  var neutralBubble = merged.filter(function (bubble) { return bubble.kind === 'neu'; })[0];
  var attentionBubble = merged.filter(function (bubble) { return bubble.kind === 'con'; })[0];
  assert.ok(strengthBubble.w < neutralBubble.w);
  assert.ok(neutralBubble.w < attentionBubble.w);
});

test('未列入的病重十神不显示力量词', function () {
  var bubbles = portraitTraits.buildTraitBubbles([{
    god: '偏印',
    copyKind: 'natal',
    traitDir: '-',
    traitReasonCode: 'DISEASE_GOD_LOCK',
    isZhengGod: false,
    isDiseaseGod: true,
    hasNatalBaseElement: true,
    slider: 65,
    baseSlider: 65,
    energyWeight: 1,
    energy: 1,
    sourceKey: 'test:病重偏印'
  }], null);
  assert.equal(bubbles.some(function (bubble) { return bubble.kind === 'pro'; }), false);
});

test('偏印新增留意词均可进入星团', function () {
  var bubbles = portraitTraits.buildTraitBubbles([{
    god: '偏印',
    copyKind: 'natal',
    traitDir: '-',
    isZhengGod: false,
    isDiseaseGod: true,
    hasNatalBaseElement: true,
    slider: 65,
    baseSlider: 65,
    energyWeight: 1,
    energy: 1,
    sourceKey: 'test:偏印'
  }], null);
  ['冷', '偏执', '封闭', '胆小', '懒得动弹'].forEach(function (word) {
    assert.ok(bubbles.some(function (bubble) { return bubble.kind === 'con' && bubble.label === word; }), word + '应进入星团');
  });
});

test('1984-01-01 壬申运偏印生扶病重正印时，只显示本色和留意', function () {
  var result = portrait.build(chartOf(1984, 1, 1, 0), { selectedLuckIndex: 8 });
  var layer = axesOf(result);
  var strength = layer.bubbles.filter(function (bubble) {
    return bubble.kind === 'pro' && traitWords['偏印'].pro.indexOf(bubble.label) >= 0;
  });
  var attention = layer.bubbles.filter(function (bubble) {
    return bubble.kind === 'con' && bubble.label === '孤僻';
  });

  assert.equal(layer.ganAxis.god, '偏印');
  assert.equal(layer.ganAxis.traitDir, '-');
  assert.equal(layer.ganAxis.reasonCode, 'DISEASE_SUPPORT_LOCK');
  assert.equal(strength.length, 0);
  assert.equal(attention.length, 1);
});

test('1990-06-18 辛巳运的正官为忌时，缺点气泡不得被中性规则隐藏', function () {
  var result = portrait.build(chartOf(1990, 6, 18, 0), { selectedLuckIndex: 1 });
  var layer = axesOf(result);
  var labels = layer.bubbles.map(function (item) { return item.label; });

  assert.equal(layer.ganAxis.god, '正官');
  assert.equal(layer.ganAxis.traitDir, '-');
  assert.ok(labels.indexOf('害怕出错') >= 0);
  assert.ok(labels.indexOf('压抑真实') >= 0);
});

test('病重特殊冲突会隐藏被冲正神的优势气泡', function () {
  ['正官', '食神', '比肩', '正财'].forEach(function (god) {
    var bubbles = portraitTraits.buildTraitBubbles([{
      god: god,
      copyKind: 'natal',
      traitDir: '-',
      traitReasonCode: 'EXCESS_CONFLICT',
      isZhengGod: true,
      isDiseaseGod: false,
      hasNatalBaseElement: true,
      slider: 50,
      baseSlider: 50,
      energyWeight: 1,
      energy: 1,
      sourceKey: 'test:' + god
    }], null);
    assert.equal(bubbles.some(function (bubble) { return bubble.kind === 'pro'; }), false, god + '优势词应隐藏');
    assert.ok(bubbles.some(function (bubble) { return bubble.kind === 'con'; }), god + '缺点词应保留');
  });
});

test('1987-06-05 甲辰运不是病重，不得混入伤官病重气泡', function () {
  var chart = bazi.computeChart({
    name: '回归命例', gender: 1, calendar: 'solar', year: 1987, month: 6, day: 5,
    hour: 12, minute: 0, unknownTime: false
  });
  var result = portrait.build(chart, { selectedLuckIndex: 1 });
  var layer = axesOf(result);
  var labels = layer.bubbles.map(function (bubble) { return bubble.label; });

  assert.notEqual(result.luckPortrait.xiji.mode, '病重');
  assert.equal(layer.bubbles.some(function (bubble) { return bubble.persistentDisease; }), false);
  assert.equal(labels.indexOf('对抗权威'), -1);
  assert.equal(labels.indexOf('漠视规则'), -1);
  assert.equal(labels.indexOf('爱吃爱玩'), -1);
  assert.ok(layer.clusterKey);
  assert.equal(layer.ganAxis.visible, true);
  assert.equal(layer.zhiAxis.visible, true);
  assert.equal(layer.notes.some(function (item) { return item.key === 'zhi'; }), true);
});

test('原局缺少大运五行时，只显示大运带来的本色词', function () {
  var chart = bazi.computeChart({
    name: '回归命例', gender: 1, calendar: 'solar', year: 1987, month: 6, day: 5,
    hour: 12, minute: 0, unknownTime: false
  });
  var result = portrait.build(chart, { selectedLuckIndex: 1, selectedYear: 1997 });
  var layer = axesOf(result);

  assert.equal(layer.zhiAxis.visible, true);
  assert.equal(layer.notes.some(function (item) { return item.key === 'zhi'; }), true);
  var zhiWords = require('../miniprogram/utils/analyze/transitTraitWords.js')[layer.zhiAxis.god].neu;
  zhiWords.forEach(function (word) {
    assert.ok(layer.bubbles.some(function (bubble) { return bubble.label === word && bubble.kind === 'neu'; }));
  });
  assert.equal(layer.bubbles.some(function (bubble) {
    return bubble.src === 'dayun' && bubble.kind === 'pro' && bubble.label === '主动表达';
  }), false);
  assert.ok(layer.bubbles.some(function (bubble) { return bubble.fromYear; }));
});

test('流年文案卡的猫图跟随流年天干十神切换', function () {
  var chart = chartOf(1948, 6, 21, 1);
  var jia = axesOf(portrait.build(chart, { selectedLuckIndex: 4, selectedYear: 1984 }));
  var yi = axesOf(portrait.build(chart, { selectedLuckIndex: 4, selectedYear: 1985 }));

  assert.equal(jia.yearCard.god, '正印');
  assert.equal(yi.yearCard.god, '偏印');
  assert.equal(jia.yearCard.catImage, portraitTraits.catImageOf('正印'));
  assert.equal(yi.yearCard.catImage, portraitTraits.catImageOf('偏印'));
  assert.notEqual(jia.yearCard.catImage, yi.yearCard.catImage);
});

test('1984-04-14 甲子运：比肩过旺时正财不套用七杀的 20% 门槛', function () {
  var result = portrait.build(chartOf(1984, 4, 14, 0), { selectedLuckIndex: 4 });
  var layer = axesOf(result);

  assert.equal(result.luckPortrait.gz, '甲子');
  assert.equal(result.luckPortrait.xiji.subtype, '比肩过旺');
  assert.equal(result.luckPortrait.xiji.dir['水'], '+');
  assert.equal(layer.zhiAxis.god, '正财');
  assert.equal(layer.zhiAxis.traitDir, '+');
});

test('劫财过旺时，正财仍由劫财夺财特殊冲突覆盖为忌', function () {
  var result = portraitRules.fixedGodDir('正财', '水', {
    dir: { 水: '+' },
    subtypes: ['劫财过旺']
  });
  assert.equal(result.dir, '-');
  assert.equal(result.reason, '劫财夺财');
});
