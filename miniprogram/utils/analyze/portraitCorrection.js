// 大运全局修正：原局全部天干修大运天干，全部地支本气修大运地支本气。
// 干支分层聚合，不再按少年/青年/中年/老年选择单柱。
var base = require('./base.js');
var rules = require('./portraitRules.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;

var SHENG = base.SHENG;
var KE = base.KE;
var SOURCE_WEIGHT = [0.9, 1.2, 1.0, 0.8];
var FULL_WEIGHT = 3.9;
var EFFECT_THRESHOLD = 0.6;
var PILLAR_NAMES = ['年', '月', '日', '时'];

function buildNatalSources(chart, layer) {
  var sources = [];
  var presentWeight = 0;
  chart.pillars.forEach(function (pillar, index) {
    if (!pillar || pillar.empty) return;
    var ch;
    if (layer === 'gan') {
      if (!pillar.gan) return;
      ch = pillar.gan.text;
    } else {
      if (!pillar.zhi) return;
      var hides = LunarUtil.ZHI_HIDE_GAN[pillar.zhi.text] || [];
      if (!hides.length) return;
      ch = hides[0];
    }
    var weight = SOURCE_WEIGHT[index] || 1;
    presentWeight += weight;
    sources.push({
      layer: layer,
      pillar: index,
      char: ch,
      zhi: layer === 'zhi' ? pillar.zhi.text : '',
      god: layer === 'gan' && pillar.shiShenGan === '日主'
        ? '日主'
        : LunarUtil.SHI_SHEN[chart.meta.dayGan + ch],
      el: base.ganWx(ch),
      rawWeight: weight,
      label: PILLAR_NAMES[index] + (layer === 'gan' ? '干' : '支本气')
    });
  });

  // 缺时柱时把已有三柱归一到同一总权重，避免只因资料缺失而整体修正偏弱。
  var normalizer = presentWeight > 0 ? FULL_WEIGHT / presentWeight : 1;
  sources.forEach(function (source) {
    source.weight = source.rawWeight * normalizer;
  });
  return sources;
}

function influenceSummary(target, sources) {
  var controlled = [];
  var drained = [];
  var supported = [];
  (sources || []).forEach(function (source) {
    if (KE[source.el] === target.el) controlled.push(source);
    if (SHENG[target.el] === source.el) drained.push(source);
    if (source.el === target.el || SHENG[source.el] === target.el) supported.push(source);
  });

  function sum(list) {
    var total = 0;
    list.forEach(function (item) { total += item.weight || 0; });
    return total;
  }

  var controlledWeight = sum(controlled);
  var drainedWeight = sum(drained);
  var supportedWeight = sum(supported);
  return {
    controlled: controlled,
    drained: drained,
    supported: supported,
    controlledWeight: controlledWeight,
    drainedWeight: drainedWeight,
    supportedWeight: supportedWeight,
    net: controlledWeight + drainedWeight - supportedWeight
  };
}

function qishaReliefSource(target, sources) {
  for (var i = 0; i < (sources || []).length; i++) {
    var source = sources[i];
    if (source.god !== '七杀') continue;
    if (KE[target.el] === source.el || SHENG[source.el] === target.el) return source;
  }
  return null;
}

function strongestDrainDirection(summary, natalXiji) {
  var favorable = 0, unfavorable = 0;
  (summary.drained || []).forEach(function (source) {
    if ((natalXiji.dir[source.el] || '0') === '-') unfavorable += source.weight || 0;
    else favorable += source.weight || 0;
  });
  return favorable > unfavorable ? '+' : '-';
}

function resolve(target, sources, activeXiji, natalXiji) {
  activeXiji = activeXiji || natalXiji || { dir: {}, subtypes: [] };
  natalXiji = natalXiji || activeXiji;
  var baseResult = rules.fixedGodDir(target.god, target.el, activeXiji);
  var summary = influenceSummary(target, sources);
  var qishaSource = qishaReliefSource(target, sources);

  // 唯一允许越过病重硬锁直接转喜的例外：克/泄七杀，且七杀能量达到20%。
  if (qishaSource && (activeXiji.qiShaPct || 0) >= 20) {
    return {
      dir: '+',
      reasonCode: 'RELIEVE_QISHA',
      reason: KE[target.el] === qishaSource.el
        ? target.god + '克全局' + qishaSource.label + '七杀（能量' + Math.round(activeXiji.qiShaPct) + '%），转为喜用'
        : target.god + '承接全局' + qishaSource.label + '七杀之泄（能量' + Math.round(activeXiji.qiShaPct) + '%），转为喜用',
      influence: summary
    };
  }

  var excessName = target.god + '过旺';
  if ((activeXiji.subtypes || []).indexOf(excessName) >= 0) {
    if (rules.SPECIAL_PIAN[target.god] && summary.net >= EFFECT_THRESHOLD) {
      return {
        dir: '0',
        reasonCode: 'DISEASE_TO_NEUTRAL',
        reason: '病重主体' + excessName + '受到全局制泄，先转中性',
        influence: summary
      };
    }
    return {
      dir: '-',
      reasonCode: 'DISEASE_GOD_LOCK',
      reason: '病重主体' + excessName + '，锁定为忌',
      influence: summary
    };
  }

  var diseaseSupport = rules.diseaseSupportOf(target, activeXiji);
  if (diseaseSupport) {
    return {
      dir: '-',
      reasonCode: 'DISEASE_SUPPORT_LOCK',
      reason: diseaseSupport.kind === '生'
        ? target.god + '生扶病重五行' + diseaseSupport.el + '，锁定为忌'
        : target.god + '与病重五行' + diseaseSupport.el + '同气扶病，锁定为忌',
      influence: summary
    };
  }

  if (rules.SPECIAL_PIAN[target.god] && baseResult.dir === '-' && summary.net >= EFFECT_THRESHOLD) {
    if (summary.controlledWeight > 0) {
      return {
        dir: '+',
        reasonCode: 'PIAN_CONTROLLED',
        reason: '偏神受到原局全局克制，转为喜用',
        influence: summary
      };
    }
    if (summary.drainedWeight > 0) {
      if (strongestDrainDirection(summary, natalXiji) === '-') {
        return {
          dir: '-',
          reasonCode: 'PIAN_DRAINS_TO_UNFAVORABLE',
          reason: '偏神顺生原局忌神，仍为忌',
          influence: summary
        };
      }
      return {
        dir: '+',
        reasonCode: 'PIAN_DRAINED',
        reason: '偏神顺生原局喜用五行得泄，转为喜用',
        influence: summary
      };
    }
  }

  baseResult.influence = summary;
  return baseResult;
}

module.exports = {
  SOURCE_WEIGHT: SOURCE_WEIGHT,
  EFFECT_THRESHOLD: EFFECT_THRESHOLD,
  buildNatalSources: buildNatalSources,
  influenceSummary: influenceSummary,
  resolve: resolve
};
