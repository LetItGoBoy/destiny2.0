// 画像展示装配：词库选择、缺点显隐、气泡合并。只消费已经算好的喜忌结果。
var rules = require('./portraitRules.js');
var copy = require('./portraitCopy.js');
var traitWords = require('./traitWords.js');
var transitTraitWords = require('./transitTraitWords.js');
var diseaseStrengthWords = require('./diseaseStrengthWords.js');
var favorablePianAttentionWords = require('./favorablePianAttentionWords.js');

function metaOf(god) {
  return copy.tenGod[god] || { name: god, pol: '', lbl: '', rbl: '', desc: '', con: '' };
}

function catImageOf(god) {
  if (!god) return '';
  var key = String(god).split(/\s*\+\s*/)[0];
  return copy.catImages[key] || '';
}

function wordCopy(god, kind) {
  if (kind === 'luck') return copy.yearTraitWords[god] || {};
  if (kind === 'transit') return transitTraitWords[god] || {};
  return traitWords[god] || {};
}

function narrativeText(god, kind, side) {
  if (kind === 'transit') {
    var transit = transitTraitWords[god] || { desc: '', conText: '' };
    return side === 'desc' ? transit.desc : transit.conText;
  }
  var meta = metaOf(god);
  return side === 'desc' ? meta.desc : meta.con;
}

function visibleConWords(god, words, limit) {
  var all = words || [];
  var out = all.slice(0, limit == null ? all.length : limit);
  if ((god === '食神' || god === '伤官') && all.indexOf('爱吃爱玩') >= 0 && out.indexOf('爱吃爱玩') < 0) {
    out.push('爱吃爱玩');
  }
  return out;
}

function bubblePolicy(item) {
  var pos = item && item.slider != null ? item.slider : 50;
  var lean = pos / 100;
  var policy = {
    proLean: lean,
    conLean: lean,
    hidePro: false,
    hideCon: false,
    proLimit: 5,
    proEnergyFactor: 1,
    neuEnergyFactor: 1,
    conEnergyFactor: 1
  };
  if (!item) return policy;

  // 病重特殊冲突中，被冲到的正神不再保留力量词，避免与病象形成相反的性格暗示。
  if (item.traitReasonCode === 'EXCESS_CONFLICT' && item.isZhengGod) {
    policy.hidePro = true;
  }

  // 病重主体显示两枚指定小力量词、全部本色和全部留意词。
  if (item.isDiseaseGod) {
    policy.proEnergyFactor = 0.38;
    policy.diseaseStrengthOnly = true;
    policy.neuEnergyFactor = 0.68;
    policy.conEnergyFactor = 1;
    return policy;
  }

  // 生扶病重主体的忌神沿用上一版，只显示本色和留意。
  if (item.traitReasonCode === 'DISEASE_SUPPORT_LOCK') {
    policy.hidePro = true;
    policy.neuEnergyFactor = 0.68;
    policy.conEnergyFactor = 1;
    return policy;
  }

  // 普通偏神：喜时只保留两枚小留意，忌时隐藏力量词。
  if (item.traitReasonCode !== 'EXCESS_CONFLICT' && rules.SPECIAL_PIAN[item.god]) {
    if (item.traitDir === '+') {
      policy.favorablePianConOnly = true;
      policy.conEnergyFactor = 0.38;
      return policy;
    }
    if (item.traitDir === '-') {
      policy.hidePro = true;
      return policy;
    }
  }

  // 普通正神为喜时隐藏留意；中性与忌神沿用上一版大小策略。
  if (item.traitDir === '+') {
    policy.hideCon = true;
    return policy;
  }
  if (item.traitDir === '0') {
    policy.proLean = 0.5;
    policy.conLean = 0.35;
    return policy;
  }
  if (item.traitDir === '-' || pos >= 65) {
    policy.proLean = 0.5;
    policy.conLean = 0.5;
  } else if (pos === 50) {
    policy.proLean = 0.5;
    policy.conLean = 0.35;
  }
  return policy;
}

function buildTraitBubbles(items, yearOverlay) {
  var out = [];
  (items || []).forEach(function (item, index) {
    var transitOnly = item.hasNatalBaseElement === false;
    var bubbleGod = item.bubbleGod || item.god;
    // 原局缺少该五行时使用大运实际十神的完整外来词，不参与正偏神词库替换。
    var copyGod = transitOnly ? item.god : bubbleGod;
    var words = wordCopy(copyGod, transitOnly ? 'transit' : (item.copyKind || 'natal'));
    var policy = bubblePolicy(item);
    var weight = item.energyWeight == null ? (index === 0 ? 0.95 : 0.78) : item.energyWeight;
    var rawEnergy = item.energy == null ? weight : item.energy;
    var sourceKey = item.sourceKey || ('dayun:' + index + ':' + item.god);
    // 原局完全没有该五行时，沿用上一版，只显示三枚外来本色词。
    if (transitOnly) {
      (words.neu || []).slice(0, 3).forEach(function (word) {
        out.push({ label: word, kind: 'neu', src: 'dayun', sourceKey: sourceKey, rawEnergy: rawEnergy, w: weight, lean: 0.5 });
      });
      return;
    }
    if (!policy.hidePro) {
      var proWords = policy.diseaseStrengthOnly
        ? diseaseStrengthWords[item.god]
        : (words.pro || []).slice(0, policy.proLimit);
      proWords.forEach(function (word) {
        out.push({
          label: word,
          kind: 'pro',
          src: 'dayun',
          sourceKey: sourceKey,
          rawEnergy: rawEnergy * policy.proEnergyFactor,
          w: weight * policy.proEnergyFactor,
          lean: policy.proLean
        });
      });
    }
    (words.neu || []).slice(0, 4).forEach(function (word) {
      out.push({
        label: word,
        kind: 'neu',
        src: 'dayun',
        sourceKey: sourceKey,
        rawEnergy: rawEnergy * policy.neuEnergyFactor,
        w: weight * policy.neuEnergyFactor,
        lean: 0.5
      });
    });
    if (!policy.hideCon) {
      var conWords = policy.favorablePianConOnly
        ? (favorablePianAttentionWords[item.god] || [])
        : visibleConWords(bubbleGod, words.con, 8);
      conWords.forEach(function (word) {
        out.push({
          label: word,
          kind: 'con',
          src: 'dayun',
          sourceKey: sourceKey,
          rawEnergy: rawEnergy * policy.conEnergyFactor,
          w: weight * policy.conEnergyFactor,
          lean: policy.conLean
        });
      });
      (item.extraCon || []).forEach(function (word) {
        out.push({
          label: word,
          kind: 'con',
          src: 'dayun',
          sourceKey: sourceKey,
          rawEnergy: rawEnergy * policy.conEnergyFactor,
          w: weight * policy.conEnergyFactor,
          lean: policy.conLean
        });
      });
    }
  });

  if (yearOverlay && yearOverlay.god) {
    var yearWords = wordCopy(yearOverlay.god, 'luck');
    var yearPolicy = bubblePolicy(yearOverlay);
    var yearWeight = yearOverlay.energyWeight == null ? (yearOverlay.bubbleWeight || 0.7) : yearOverlay.energyWeight;
    var yearEnergy = yearOverlay.energy == null ? yearWeight : yearOverlay.energy;
    var yearSourceKey = yearOverlay.sourceKey || ('year:' + yearOverlay.name);
    (yearWords.pro || []).slice(0, 4).forEach(function (word) {
      out.push({ label: word, kind: 'pro', src: 'luck', sourceKey: yearSourceKey, rawEnergy: yearEnergy, w: yearWeight, lean: yearPolicy.proLean });
    });
    if (!yearPolicy.hideCon) {
      var yearConWords = yearPolicy.favorablePianConOnly
        ? (favorablePianAttentionWords[yearOverlay.god] || [])
        : visibleConWords(yearOverlay.god, yearWords.con, 4);
      yearConWords.forEach(function (word) {
        out.push({
          label: word,
          kind: 'con',
          src: 'luck',
          sourceKey: yearSourceKey,
          rawEnergy: yearEnergy * yearPolicy.conEnergyFactor,
          w: yearWeight * yearPolicy.conEnergyFactor,
          lean: yearPolicy.conLean
        });
      });
    }
  }
  return out;
}

function persistentDiseaseBubbles(items, bubbles, activeXiji) {
  if (!activeXiji || activeXiji.mode !== '病重') return [];
  var mainGods = {}, used = {};
  (items || []).forEach(function (item) {
    if (item.hasNatalBaseElement !== false) mainGods[item.god] = true;
  });
  (bubbles || []).forEach(function (item) { used[item.label] = true; });

  var out = [];
  (activeXiji.subtypes || []).forEach(function (subtype) {
    var god = String(subtype || '').replace(/过旺$/, '');
    if (!god || mainGods[god]) return;
    var words = traitWords[god] || {};
    (diseaseStrengthWords[god] || []).forEach(function (word) {
      if (!word || used[word]) return;
      used[word] = true;
      out.push({
        label: word,
        kind: 'pro',
        src: 'natal',
        sourceKey: 'disease:' + god,
        rawEnergy: 0.36,
        w: 0.36,
        lean: 0.5,
        persistentDisease: true,
        diseaseGod: god
      });
    });
    (words.neu || []).forEach(function (word) {
      if (!word || used[word]) return;
      used[word] = true;
      out.push({
        label: word,
        kind: 'neu',
        src: 'natal',
        sourceKey: 'disease:' + god,
        rawEnergy: 0.52,
        w: 0.52,
        lean: 0.5,
        persistentDisease: true,
        diseaseGod: god
      });
    });
    // 病重常驻层只保留该十神的通用留意词；冲突专属词由当步大运触发。
    visibleConWords(god, words.con).forEach(function (word) {
      if (!word || used[word]) return;
      used[word] = true;
      out.push({
        label: word,
        kind: 'con',
        src: 'natal',
        sourceKey: 'disease:' + god,
        rawEnergy: 0.72,
        w: 0.72,
        lean: 0.5,
        persistentDisease: true,
        diseaseGod: god
      });
    });
  });
  return out;
}

function mergeTraitBubbles(groups) {
  var byLabel = {}, out = [];
  (groups || []).forEach(function (group) {
    (group || []).forEach(function (bubble) {
      if (!bubble || !bubble.label) return;
      var item = byLabel[bubble.label];
      if (!item) {
        item = {
          label: bubble.label,
          kind: bubble.kind || 'neu',
          src: bubble.src || 'dayun',
          lean: bubble.lean == null ? 0.5 : bubble.lean,
          persistentDisease: !!bubble.persistentDisease,
          diseaseGod: bubble.diseaseGod || '',
          _energy: 0,
          _leanEnergy: 0,
          _kindEnergy: { pro: 0, neu: 0, con: 0 },
          _sources: {},
          _hasRegular: false,
          _hasYear: false
        };
        byLabel[bubble.label] = item;
        out.push(item);
      }

      var sourceKey = bubble.sourceKey || bubble.src || ('bubble:' + bubble.label);
      if (item._sources[sourceKey]) return;
      if (bubble.persistentDisease && item._hasRegular) {
        item.persistentDisease = true;
        if (!item.diseaseGod && bubble.diseaseGod) item.diseaseGod = bubble.diseaseGod;
        return;
      }
      item._sources[sourceKey] = true;
      var strength = typeof bubble.rawEnergy === 'number' && isFinite(bubble.rawEnergy)
        ? Math.max(0.02, bubble.rawEnergy)
        : Math.max(0.02, bubble.w || 0.6);
      item._energy += strength;
      item._leanEnergy += strength * (bubble.lean == null ? 0.5 : bubble.lean);
      item._kindEnergy[bubble.kind || 'neu'] += strength;
      item.persistentDisease = item.persistentDisease || !!bubble.persistentDisease;
      item._hasRegular = item._hasRegular || !bubble.persistentDisease;
      item._hasYear = item._hasYear || bubble.src === 'luck';
      if (!item.diseaseGod && bubble.diseaseGod) item.diseaseGod = bubble.diseaseGod;
    });
  });

  var maxEnergy = 0;
  out.forEach(function (item) {
    if (item._hasRegular && item._energy > maxEnergy) maxEnergy = item._energy;
  });
  out.forEach(function (item) {
    var bestKind = item.kind, bestEnergy = -1;
    ['pro', 'neu', 'con'].forEach(function (kind) {
      if (item._kindEnergy[kind] > bestEnergy) {
        bestEnergy = item._kindEnergy[kind];
        bestKind = kind;
      }
    });
    item.kind = bestKind;
    item.lean = item._energy > 0 ? item._leanEnergy / item._energy : 0.5;
    item.w = !item._hasRegular && item.persistentDisease
      ? Math.max(0.32, Math.min(0.72, item._energy))
      : Math.max(0.32, Math.min(1, maxEnergy > 0 ? item._energy / maxEnergy : 0.6));
    item.energy = Math.round(item._energy * 100) / 100;
    item.fromYear = item._hasYear;
    delete item._energy;
    delete item._leanEnergy;
    delete item._kindEnergy;
    delete item._sources;
    delete item._hasRegular;
    delete item._hasYear;
  });
  return out;
}

module.exports = {
  metaOf: metaOf,
  catImageOf: catImageOf,
  narrativeText: narrativeText,
  buildTraitBubbles: buildTraitBubbles,
  persistentDiseaseBubbles: persistentDiseaseBubbles,
  mergeTraitBubbles: mergeTraitBubbles
};
