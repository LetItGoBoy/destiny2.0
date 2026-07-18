// 性格画像编排层：原局底色 + 单步大运全局修正 + 可选流年叠加。
var energy = require('./energy.js');
var base = require('./base.js');
var relations = require('./relations.js');
var rules = require('./portraitRules.js');
var correction = require('./portraitCorrection.js');
var traits = require('./portraitTraits.js');
var copy = require('./portraitCopy.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;

var TEN_GOD_PAIR = {
  比肩: ['比肩', '劫财'], 劫财: ['比肩', '劫财'],
  食神: ['食神', '伤官'], 伤官: ['食神', '伤官'],
  正财: ['正财', '偏财'], 偏财: ['正财', '偏财'],
  正官: ['正官', '七杀'], 七杀: ['正官', '七杀'],
  正印: ['正印', '偏印'], 偏印: ['正印', '偏印']
};

function dominantNatalPairGod(god, godEnergy) {
  var pair = TEN_GOD_PAIR[god];
  if (!pair) return god;
  var left = godEnergy[pair[0]] || 0;
  var right = godEnergy[pair[1]] || 0;
  // 只有原局正偏两类都存在时才替换；能量相同则保留大运实际十神。
  if (left <= 0 || right <= 0 || left === right) return god;
  return left > right ? pair[0] : pair[1];
}

function natalOverview(model) {
  var stems = (model.ganCells || []).filter(function (cell) { return !cell.isDay; });
  var baseTotal = 0, nowTotal = 0, baseZheng = 0, nowZheng = 0;
  function tally(god, baseValue, nowValue) {
    baseTotal += baseValue || 0;
    nowTotal += nowValue || 0;
    var meta = traits.metaOf(god);
    if (meta.pol === '正') {
      baseZheng += baseValue || 0;
      nowZheng += nowValue || 0;
    }
  }
  stems.forEach(function (cell) { tally(cell.god, cell.base, cell.val); });
  (model.hiddenUnits || []).forEach(function (unit) { tally(unit.god, unit.base, unit.val); });

  var aggregated = {};
  function add(god, el, cls, value) {
    if (!aggregated[god]) aggregated[god] = { god: god, el: el, cls: cls, energy: 0 };
    aggregated[god].energy += value || 0;
  }
  stems.forEach(function (cell) { add(cell.god, cell.el, cell.cls, cell.val); });
  (model.hiddenUnits || []).forEach(function (unit) {
    add(unit.god, unit.el, base.WX_CLS[unit.el], unit.val);
  });
  var gods = [];
  for (var god in aggregated) gods.push(aggregated[god]);
  gods.sort(function (a, b) { return b.energy - a.energy; });
  var totalGodEnergy = 0, godPct = {};
  gods.forEach(function (item) { totalGodEnergy += item.energy; });
  gods.forEach(function (item) {
    godPct[item.god] = totalGodEnergy > 0 ? item.energy / totalGodEnergy * 100 : 0;
  });

  return {
    zhengNow: nowTotal ? Math.round(nowZheng / nowTotal * 100) : 50,
    zhengBase: baseTotal ? Math.round(baseZheng / baseTotal * 100) : 50,
    traitPattern: rules.detectTraitPattern(gods, godPct, stems)
  };
}

function natalSets(chart) {
  var elements = {};
  var nativeElements = {};
  var gods = {};

  function addNativeElement(el) {
    if (!el) return;
    elements[el] = 1;
    nativeElements[el] = 1;
  }

  // 性格唤醒池取四柱天干 + 四支本气、中气；时辰缺失时跳过空时柱，余气始终不进入。
  for (var i = 0; i < chart.pillars.length; i++) {
    var pillar = chart.pillars[i];
    if (!pillar || pillar.empty || !pillar.gan || !pillar.zhi) continue;

    var gan = pillar.gan.text;
    addNativeElement(base.ganWx(gan));
    // 日干只用于确认日主五行，不作为额外的比肩性格来源。
    if (i !== 2) gods[LunarUtil.SHI_SHEN[chart.meta.dayGan + gan]] = true;

    var hideGans = LunarUtil.ZHI_HIDE_GAN[pillar.zhi.text] || [];
    if (hideGans[0]) {
      addNativeElement(base.ganWx(hideGans[0]));
      gods[LunarUtil.SHI_SHEN[chart.meta.dayGan + hideGans[0]]] = true;
    }
    // 第二藏干统一视为中气：可以唤醒；仅在没有透干或本气时使用外来词。
    if (hideGans[1]) elements[base.ganWx(hideGans[1])] = 1;
  }
  return { elements: elements, nativeElements: nativeElements, gods: gods };
}

function luckGanSource(chart, daYun) {
  var ch = daYun.ganZhi.charAt(0);
  return {
    char: ch,
    god: LunarUtil.SHI_SHEN[chart.meta.dayGan + ch],
    el: base.ganWx(ch),
    sourceKind: 'luckGan'
  };
}

function luckZhiSource(chart, daYun, sets) {
  var zhi = daYun.ganZhi.charAt(1);
  var hideGans = LunarUtil.ZHI_HIDE_GAN[zhi] || [];
  var ch = hideGans[0];
  var sourceRank = 0;
  var mainEl = base.ganWx(ch);

  // 本气没有原局根基时，只允许原局已有的中气承接；余气不参与。
  if (sets && !sets.elements[mainEl] && hideGans.length > 1) {
    var middle = hideGans[1];
    if (sets.elements[base.ganWx(middle)]) {
      ch = middle;
      sourceRank = 1;
    }
  }
  return {
    char: ch,
    zhi: zhi,
    god: LunarUtil.SHI_SHEN[chart.meta.dayGan + ch],
    el: base.ganWx(ch),
    sourceRank: sourceRank,
    sourceKind: 'luckZhi'
  };
}

function luckUnitEnergy(model, kind, layer, sourceRank) {
  var units = layer === 'gan' ? model.luckGanUnits : model.luckZhiUnits;
  var targetRank = sourceRank == null ? 0 : sourceRank;
  for (var i = 0; i < (units || []).length; i++) {
    if (units[i].kind !== kind) continue;
    if (layer === 'zhi' && units[i].rank !== targetRank) continue;
    return units[i].val;
  }
  return 0.02;
}

function baseSlider(dir, god, side) {
  if (dir === '+') return 35;
  if (dir === '-') return side === 'outer' && !rules.SPECIAL_PIAN[god] ? 50 : 65;
  return 50;
}

function overlayYearSlider(pos, yearDir) {
  var shifted = pos + (yearDir === '+' ? -15 : yearDir === '-' ? 15 : 0);
  return Math.max(25, Math.min(75, shifted));
}

function makeLuckItem(source, side, modifiers, activeXiji, natalXiji, sets) {
  var meta = traits.metaOf(source.god);
  var effective = correction.resolve(source, modifiers, activeXiji, natalXiji);
  // 同一五行只要在年月日天干透出或支本气出现，就使用本命词库；仅中气有根才用外来词。
  var copyKind = sets.nativeElements[source.el] ? 'natal' : 'transit';
  var slider = baseSlider(effective.dir, source.god, side);
  return {
    god: source.god,
    name: meta.name,
    pol: meta.pol,
    lbl: meta.lbl,
    rbl: meta.rbl,
    desc: traits.narrativeText(source.god, copyKind, 'desc'),
    con: traits.narrativeText(source.god, copyKind, 'con'),
    descLabel: '力量',
    conLabel: '留意',
    cls: base.WX_CLS[source.el],
    slider: slider,
    baseSlider: slider,
    traitDir: effective.dir,
    isZhengGod: !rules.SPECIAL_PIAN[source.god],
    isDiseaseGod: rules.isDiseaseGod(source.god, activeXiji),
    isNatalGod: !!sets.nativeElements[source.el],
    traitOverride: effective.reason,
    traitReasonCode: effective.reasonCode,
    influence: effective.influence || null,
    copyKind: copyKind,
    sourceChar: source.char,
    sourceZhi: source.zhi || '',
    sourceKey: source.sourceKey || (source.sourceKind + ':' + source.char),
    hasNatalBaseElement: !!sets.elements[source.el],
    side: side,
    energy: source.energy == null ? 1 : source.energy,
    energyWeight: source.energyWeight == null ? 0.6 : source.energyWeight
  };
}

function makeYearOverlay(chart, year, ganZhi, activeXiji) {
  if (!ganZhi || ganZhi.length < 2) return null;
  var ch = ganZhi.charAt(0);
  var god = LunarUtil.SHI_SHEN[chart.meta.dayGan + ch];
  var el = base.ganWx(ch);
  var text = copy.liuNian[god] || { lbl: '', rbl: '', desc: '' };
  var effective = rules.fixedGodDir(god, el, activeXiji);
  var slider = effective.dir === '+' ? 35 : effective.dir === '-' ? 65 : 50;
  return {
    god: god,
    name: year + '年',
    slider: slider,
    baseSlider: slider,
    bubbleWeight: 0.7,
    lbl: text.lbl,
    rbl: text.rbl,
    catImage: traits.catImageOf(god),
    desc: text.desc,
    traitDir: effective.dir,
    isZhengGod: !rules.SPECIAL_PIAN[god],
    isDiseaseGod: rules.isDiseaseGod(god, activeXiji),
    reason: effective.reason,
    char: ch,
    sourceKey: 'year:' + year + ':' + ch
  };
}

function makeCombinedLayer(ganItem, zhiItem, ganShare, zhiShare, yearOverlay, activeXiji, clusterKey) {
  if (yearOverlay) ganItem.slider = overlayYearSlider(ganItem.slider, yearOverlay.traitDir);
  var ganBubbles = traits.buildTraitBubbles([ganItem], null);
  var yearBubbles = yearOverlay ? traits.buildTraitBubbles([], yearOverlay) : [];
  var zhiBubbles = traits.buildTraitBubbles([zhiItem], null);
  var ganVisible = ganBubbles.length > 0;
  var zhiVisible = zhiBubbles.length > 0;
  zhiBubbles = zhiBubbles.concat(traits.persistentDiseaseBubbles([ganItem, zhiItem], zhiBubbles, activeXiji));
  var names = [];
  [{ item: ganItem, visible: ganVisible }, { item: zhiItem, visible: zhiVisible }].forEach(function (source) {
    var name = source.item.name;
    if (source.visible && name && names.indexOf(name) < 0) names.push(name);
  });
  var notes = [];
  if (ganVisible) notes.push({ key: 'gan', label: ganItem.name, desc: ganItem.desc, con: ganItem.con, descLabel: ganItem.descLabel, conLabel: ganItem.conLabel });
  if (zhiVisible) notes.push({ key: 'zhi', label: zhiItem.name, desc: zhiItem.desc, con: zhiItem.con, descLabel: zhiItem.descLabel, conLabel: zhiItem.conLabel });
  return {
    name: names.join(' · '),
    luckName: yearOverlay ? yearOverlay.name : '',
    yearCard: yearOverlay ? {
      name: yearOverlay.name,
      god: yearOverlay.god,
      catImage: yearOverlay.catImage,
      desc: yearOverlay.desc
    } : null,
    clusterKey: clusterKey || '',
    bubbles: traits.mergeTraitBubbles([ganBubbles, zhiBubbles, yearBubbles]),
    ganAxis: {
      visible: ganVisible,
      char: ganItem.sourceChar,
      god: ganItem.god,
      name: ganItem.name,
      slider: ganItem.slider,
      lbl: ganItem.lbl,
      rbl: ganItem.rbl,
      share: ganShare,
      traitDir: ganItem.traitDir,
      reason: ganItem.traitOverride,
      reasonCode: ganItem.traitReasonCode
    },
    zhiAxis: {
      visible: zhiVisible,
      char: zhiItem.sourceZhi || zhiItem.sourceChar,
      god: zhiItem.god,
      name: zhiItem.name,
      slider: zhiItem.slider,
      lbl: zhiItem.lbl,
      rbl: zhiItem.rbl,
      share: zhiShare,
      traitDir: zhiItem.traitDir,
      reason: zhiItem.traitOverride,
      reasonCode: zhiItem.traitReasonCode
    },
    notes: notes
  };
}

function currentLuckIndex(chart, currentYear) {
  var list = chart.daYun || [];
  for (var i = 0; i < list.length; i++) {
    if (currentYear >= list[i].startYear && currentYear <= list[i].endYear) return list[i].index;
  }
  return list.length ? list[0].index : null;
}

function luckByIndex(chart, index) {
  var list = chart.daYun || [];
  for (var i = 0; i < list.length; i++) if (list[i].index === index) return list[i];
  return null;
}

function luckSummary(chart, daYun, sets) {
  if (!daYun || daYun.isQian) return '';
  var names = [];
  [luckGanSource(chart, daYun), luckZhiSource(chart, daYun, sets)].forEach(function (source) {
    if (!sets.elements[source.el]) return;
    var name = traits.metaOf(source.god).name;
    if (name && names.indexOf(name) < 0) names.push(name);
  });
  return names.join(' · ');
}

function buildLuckSegments(chart, selectedIndex, currentIndex, sets) {
  return (chart.daYun || []).map(function (daYun) {
    var startAge = daYun.isQian ? 0 : daYun.startAge;
    return {
      index: daYun.index,
      gz: daYun.isQian ? '童限' : daYun.ganZhi,
      label: startAge + '-' + daYun.endAge + '岁',
      startAge: startAge,
      endAge: daYun.endAge,
      startYear: daYun.startYear,
      endYear: daYun.endYear,
      summary: luckSummary(chart, daYun, sets),
      isQian: !!daYun.isQian,
      active: daYun.index === selectedIndex,
      current: daYun.index === currentIndex
    };
  });
}

function relationView(chart, daYunGZ, liuNianGZ) {
  var branches = [];
  chart.pillars.forEach(function (pillar) {
    if (pillar.empty || !pillar.zhi) return;
    branches.push({ zhi: pillar.zhi.text, label: pillar.label.charAt(0) });
  });
  if (daYunGZ) branches.push({ zhi: daYunGZ.charAt(1), label: '大运' });
  if (liuNianGZ) branches.push({ zhi: liuNianGZ.charAt(1), label: '流年' });
  return relations.detect(branches);
}

function build(chart, opts) {
  opts = opts || {};
  var dayGan = chart.meta.dayGan;
  var dmEl = base.ganWx(dayGan);
  var natalEnergy = energy.build(chart, {});
  var overview = natalOverview(natalEnergy);
  var rootEls = rules.rootElsOf(chart, {});
  var bodyRootInfo = rules.bodyRootInfoOf(chart);
  var natalXiji = rules.decideXiji(
    natalEnergy.poolXiji || natalEnergy.pool || {},
    dmEl,
    rootEls,
    rules.godEnergyOf(natalEnergy, false),
    natalEnergy.poolXiji || natalEnergy.pool || {},
    bodyRootInfo
  );
  var sets = natalSets(chart);

  var nowYear = new Date().getFullYear();
  var currentIndex = currentLuckIndex(chart, nowYear);
  var selectedIndex = opts.selectedLuckIndex;
  if (selectedIndex == null || !luckByIndex(chart, selectedIndex)) selectedIndex = currentIndex;
  var selectedLuck = luckByIndex(chart, selectedIndex);
  var selectedYear = opts.selectedYear == null ? null : Number(opts.selectedYear);
  var selectedYearGZ = '';
  if (selectedLuck && !selectedLuck.isQian && selectedYear != null) {
    (selectedLuck.liuNian || []).forEach(function (yearItem) {
      if (yearItem.year === selectedYear) selectedYearGZ = yearItem.ganZhi;
    });
    if (!selectedYearGZ) selectedYear = null;
  }

  var luckPortrait;
  if (!selectedLuck || selectedLuck.isQian) {
    luckPortrait = {
      empty: true,
      qian: true,
      index: selectedLuck ? selectedLuck.index : null,
      gz: '童限',
      ganText: '童',
      zhiText: '限',
      ganCls: 'muted',
      zhiCls: 'muted',
      luckLabel: selectedLuck ? '0-' + selectedLuck.endAge + '岁' : '',
      summary: '幼年时期',
      traitLayer: null,
      xiji: natalXiji
    };
  } else {
    var dayunEnergy = energy.build(chart, { daYunGZ: selectedLuck.ganZhi });
    var adjustedNatalGodEnergy = rules.godEnergyOf(dayunEnergy, false);
    var activeXiji = rules.decideXiji(
      dayunEnergy.poolNatalAfterLuckXiji || dayunEnergy.poolXiji || {},
      dmEl,
      rootEls,
      adjustedNatalGodEnergy,
      dayunEnergy.poolNatalAfterLuckXiji || dayunEnergy.poolXiji || {},
      bodyRootInfo
    );
    var yearOverlay = selectedYearGZ ? makeYearOverlay(chart, selectedYear, selectedYearGZ, activeXiji) : null;
    var displayEnergy = selectedYearGZ
      ? energy.build(chart, { daYunGZ: selectedLuck.ganZhi, liuNianGZ: selectedYearGZ })
      : dayunEnergy;
    var ganSource = luckGanSource(chart, selectedLuck);
    var zhiSource = luckZhiSource(chart, selectedLuck, sets);
    var ganEnergy = luckUnitEnergy(displayEnergy, 'dy', 'gan');
    var zhiEnergy = luckUnitEnergy(displayEnergy, 'dy', 'zhi', zhiSource.sourceRank);
    var yearGanEnergy = yearOverlay ? luckUnitEnergy(displayEnergy, 'ln', 'gan') : 0;
    var maxEnergy = Math.max(ganEnergy, zhiEnergy, yearGanEnergy, 0.02);
    ganSource.energy = ganEnergy;
    ganSource.energyWeight = ganEnergy / maxEnergy;
    ganSource.sourceKey = 'dayun:gan:' + ganSource.char;
    zhiSource.energy = zhiEnergy;
    zhiSource.energyWeight = zhiEnergy / maxEnergy;
    zhiSource.sourceKey = 'dayun:zhi:' + zhiSource.zhi;
    if (yearOverlay) {
      yearOverlay.energy = yearGanEnergy;
      yearOverlay.energyWeight = yearGanEnergy / maxEnergy;
    }
    var totalLuckEnergy = ganEnergy + zhiEnergy;
    var ganShare = totalLuckEnergy > 0 ? Math.round(ganEnergy / totalLuckEnergy * 100) : 50;
    var zhiShare = 100 - ganShare;
    var ganItem = makeLuckItem(
      ganSource,
      'outer',
      correction.buildNatalSources(chart, 'gan'),
      activeXiji,
      natalXiji,
      sets
    );
    var zhiItem = makeLuckItem(
      zhiSource,
      'inner',
      correction.buildNatalSources(chart, 'zhi'),
      activeXiji,
      natalXiji,
      sets
    );
    // 普通格局只用原局同组中能量较大的十神提供气泡词；喜忌和滑标仍由大运实际十神决定。
    if (activeXiji.mode !== '病重') {
      ganItem.bubbleGod = dominantNatalPairGod(ganItem.god, adjustedNatalGodEnergy);
      zhiItem.bubbleGod = dominantNatalPairGod(zhiItem.god, adjustedNatalGodEnergy);
    }
    var chartKey = chart.pillars.filter(function (pillar) { return !pillar.empty; }).map(function (pillar) { return pillar.ganZhi; }).join('');
    var clusterKey = chartKey + ':' + selectedLuck.index + ':' + selectedLuck.ganZhi + ':' + (selectedYearGZ || '');
    var traitLayer = makeCombinedLayer(ganItem, zhiItem, ganShare, zhiShare, yearOverlay, activeXiji, clusterKey);
    luckPortrait = {
      empty: false,
      qian: false,
      index: selectedLuck.index,
      gz: selectedLuck.ganZhi,
      ganText: selectedLuck.ganZhi.charAt(0),
      zhiText: selectedLuck.ganZhi.charAt(1),
      ganCls: selectedLuck.gan ? selectedLuck.gan.cls : base.WX_CLS[ganSource.el],
      zhiCls: selectedLuck.zhi ? selectedLuck.zhi.cls : base.WX_CLS[zhiSource.el],
      luckLabel: selectedLuck.startAge + '-' + selectedLuck.endAge + '岁',
      hasYear: !!yearOverlay,
      luckYear: yearOverlay ? selectedYear : null,
      summary: traitLayer.name,
      traitLayer: traitLayer,
      xiji: activeXiji,
      poolFull: dayunEnergy.poolNatalAfterLuck,
      poolXiji: dayunEnergy.poolNatalAfterLuckXiji
    };
  }

  var coreInfo = copy.core[dayGan] || { title: dayGan, text: '' };
  return {
    core: {
      gan: dayGan,
      cls: base.WX_CLS[dmEl],
      title: coreInfo.title,
      text: coreInfo.text
    },
    traitPattern: overview.traitPattern,
    zhengNow: overview.zhengNow,
    pianNow: 100 - overview.zhengNow,
    xiji: natalXiji,
    luckSegments: buildLuckSegments(chart, selectedIndex, currentIndex, sets),
    luckPortrait: luckPortrait,
    selectedLuckIndex: selectedIndex,
    selectedYear: selectedYear,
    currentLuckIndex: currentIndex,
    relations: relationView(chart, selectedLuck && !selectedLuck.isQian ? selectedLuck.ganZhi : '', selectedYearGZ),
    hasTime: !chart.meta.unknownTime
  };
}

module.exports = { build: build };
