var bazi = require('../../utils/bazi.js');
var portrait = require('../../utils/analyze/portrait.js');
var prefs = require('../../utils/prefs.js');

var STAGE_RANGES = [
  { key: 'life1', start: 0, end: 7 },
  { key: 'life2', start: 8, end: 16 },
  { key: 'life3', start: 17, end: 24 },
  { key: 'life4', start: 25, end: 32 },
  { key: 'life5', start: 33, end: 40 },
  { key: 'life6', start: 41, end: 48 },
  { key: 'life7', start: 49, end: 56 },
  { key: 'life8', start: 57, end: 120 }
];

// 守正/求变配比 → 个性化判词（>=58 守正主导，<=42 求变主导，其余均衡）
function polVerdictOf(zheng) {
  if (zheng >= 58) return '你更偏「守正」：遇事先求稳、讲规则、重积累，可靠是你的默认姿态；变化来临时习惯先想清楚再动。';
  if (zheng <= 42) return '你更偏「求变」：不安于重复，天然想突破、想表达，机会感比稳定感更让你安心；顺境里冲劲十足。';
  return '你在守正与求变之间较为均衡：能稳能闯，会按场合切换姿态，既守得住基本盘，也接得住新机会。';
}

// 命局特殊结构一句话解读（检测逻辑见 utils/analyze/portrait.js detectTraitPattern）
var PATTERN_NOTES = {
  食神制杀: '温和的输出与强悍的压力势均力敌、互相制衡：能把危机感转成章法，是很有张力的组合。',
  羊刃驾杀: '刚劲与魄力互相咬合：敢扛硬仗、关键时刻压得住阵，但需要分寸来驾驭这股狠劲。',
  身杀两停: '自我与挑战势均力敌：抗压耐打，压力越大越能被激发，越有目标越有劲。'
};

Page({
  data: {
    loaded: false,
    fs: 'std',
    meta: {},
    core: {},
    traitPattern: null,
    zhengNow: 50,
    pianNow: 50,
    hasTime: true,
    stagePortraits: [],
    openStageKey: 'life1',
    currentStageKey: '',
    openLayers: {},
    luckStageIndex: 1,
    luckYear: null,
    luckYearList: [],
    luckPortrait: null,
    luckFlow: null,
    relations: []
  },

  onLoad: function (options) {
    this.setData({ fs: prefs.getFontSize() });
    var input = null;
    try {
      input = JSON.parse(decodeURIComponent(options.input));
    } catch (e) {}
    if (!input) {
      wx.showToast({ title: '参数有误', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this._input = input;

    var chart;
    try {
      chart = bazi.computeChart(input);
    } catch (e) {
      wx.showToast({ title: '分析失败，请重试', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this._chart = chart;
    this._birthYear = new Date(chart.meta.timestamp).getFullYear();

    this._dy = (chart.daYun || []).filter(function (d) {
      return d.ganZhi && !d.isQian;
    }).map(function (d, i) {
      return {
        index: i,
        gz: d.ganZhi,
        gan: d.gan,
        zhi: d.zhi,
        god: d.shiShenGan,
        age: d.startAge + '-' + d.endAge,
        _liuNian: d.liuNian || []
      };
    });

    this._yearMap = {};
    var self = this;
    this._dy.forEach(function (d) {
      (d._liuNian || []).forEach(function (x, i) {
        self._yearMap[x.year] = { dy: d.index, ln: i };
      });
    });

    var currentYear = new Date().getFullYear();
    var defaultStageIndex = this.stageIndexForYear(currentYear);
    var defaultYear = this.ensureLuckYear(defaultStageIndex, currentYear);
    this.setData({
      loaded: true,
      meta: chart.meta,
      openStageKey: (STAGE_RANGES[defaultStageIndex] || STAGE_RANGES[0]).key,
      currentStageKey: (STAGE_RANGES[defaultStageIndex] || STAGE_RANGES[0]).key,
      luckStageIndex: defaultStageIndex,
      luckYear: defaultYear
    });
    this.recompute();
  },

  stageIndexForYear: function (year) {
    var birthYear = this._birthYear || new Date().getFullYear();
    var age = year - birthYear;
    for (var i = 0; i < STAGE_RANGES.length; i++) {
      if (age >= STAGE_RANGES[i].start && age <= STAGE_RANGES[i].end) return i;
    }
    return age < 0 ? 0 : STAGE_RANGES.length - 1;
  },

  layerOpen: function (stageKey, layerKey) {
    var key = stageKey + ':' + layerKey;
    return this.data.openLayers[key] !== false;
  },

  applyLayerOpen: function (stages, luckPortrait) {
    var self = this;
    (stages || []).forEach(function (stage) {
      if (stage.layer) stage.layer.open = self.layerOpen(stage.key, 'main');
    });
    if (luckPortrait) {
      if (luckPortrait.layer) luckPortrait.layer.open = this.layerOpen('luck', 'main');
    }
  },

  toggleStage: function (e) {
    var key = e.currentTarget.dataset.key;
    var next = this.data.openStageKey === key ? '' : key;
    var patch = { openStageKey: next };
    if (next === 'luck') {
      patch.luckYear = this.ensureLuckYear(this.data.luckStageIndex, this.data.luckYear);
    }
    var self = this;
    this.setData(patch, function () { self.recompute(); });
  },

  toggleLayer: function (e) {
    var stage = e.currentTarget.dataset.stage;
    var layer = e.currentTarget.dataset.layer;
    if (!stage || !layer) return;
    var key = stage + ':' + layer;
    var next = {};
    for (var k in this.data.openLayers) next[k] = this.data.openLayers[k];
    next[key] = this.data.openLayers[key] === false;
    var self = this;
    this.setData({ openLayers: next }, function () { self.recompute(); });
  },

  selectLuckStage: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    var year = this.ensureLuckYear(idx, this.data.luckYear);
    var self = this;
    this.setData({
      openStageKey: 'luck',
      luckStageIndex: idx,
      luckYear: year
    }, function () { self.recompute(); });
  },

  selectLuckYear: function (e) {
    var year = Number(e.currentTarget.dataset.year);
    var self = this;
    this.setData({
      openStageKey: 'luck',
      luckYear: year
    }, function () { self.recompute(); });
  },

  stepLuckYear: function (e) {
    var delta = Number(e.currentTarget.dataset.d);
    var list = this.buildLuckYearList(this.data.luckStageIndex, this.data.luckYear);
    if (!list.length) return;
    var cur = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].year === this.data.luckYear) { cur = i; break; }
    }
    var next = Math.max(0, Math.min(list.length - 1, cur + delta));
    var self = this;
    this.setData({
      openStageKey: 'luck',
      luckYear: list[next].year
    }, function () { self.recompute(); });
  },

  ensureLuckYear: function (stageIndex, preferredYear) {
    var list = this.buildLuckYearList(stageIndex, preferredYear);
    if (!list.length) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].year === preferredYear) return preferredYear;
    }
    return list[0].year;
  },

  buildLuckYearList: function (stageIndex, activeYear) {
    var range = STAGE_RANGES[stageIndex] || STAGE_RANGES[1];
    var birthYear = this._birthYear || new Date().getFullYear();
    var out = [];
    var years = Object.keys(this._yearMap || {}).map(function (y) { return Number(y); });
    years.sort(function (a, b) { return a - b; });
    for (var i = 0; i < years.length; i++) {
      var year = years[i];
      var age = year - birthYear;
      if (age < range.start || age > range.end) continue;
      var sel = this._yearMap[year];
      var dy = this._dy[sel.dy];
      var ln = dy && dy._liuNian ? dy._liuNian[sel.ln] : null;
      if (!ln) continue;
      out.push({
        year: year,
        age: age,
        gz: ln.ganZhi,
        active: year === activeYear
      });
    }
    return out;
  },

  selectionForLuckYear: function (year) {
    if (year == null) return {};
    var sel = this._yearMap[year];
    if (!sel) return {};
    var dy = this._dy[sel.dy];
    var ln = dy && dy._liuNian ? dy._liuNian[sel.ln] : null;
    if (!dy || !ln) return {};
    return {
      daYunGZ: dy.gz,
      liuNianGZ: ln.ganZhi
    };
  },

  recompute: function () {
    var luckYear = this.data.luckYear;
    var luckYearList = this.buildLuckYearList(this.data.luckStageIndex, luckYear);
    if (this.data.openStageKey === 'luck' && luckYearList.length) {
      var found = false;
      for (var i = 0; i < luckYearList.length; i++) {
        if (luckYearList[i].year === luckYear) found = true;
      }
      if (!found) {
        luckYear = luckYearList[0].year;
        luckYearList = this.buildLuckYearList(this.data.luckStageIndex, luckYear);
      }
    }

    var opts = {};
    if (this.data.openStageKey === 'luck') {
      opts = this.selectionForLuckYear(luckYear);
    }
    var p = portrait.build(this._chart, opts);
    var luckPortrait = null;
    if (this.data.openStageKey === 'luck') {
      luckPortrait = (p.stagePortraits || [])[this.data.luckStageIndex] || null;
    }
    this.applyLayerOpen(p.stagePortraits || [], luckPortrait);

    this.setData({
      core: p.core,
      traitPattern: p.traitPattern
        ? { name: p.traitPattern.name, note: PATTERN_NOTES[p.traitPattern.name] || '' }
        : null,
      zhengNow: p.zhengNow,
      pianNow: p.pianNow,
      polVerdict: polVerdictOf(p.zhengNow),
      hasTime: p.hasTime,
      stagePortraits: p.stagePortraits || [],
      luckYear: luckYear,
      luckYearList: luckYearList,
      luckPortrait: luckPortrait,
      luckFlow: this.data.openStageKey === 'luck' ? (p.luckTrait || null) : null,
      relations: p.relations || []
    });
  },

  noop: function () {},

  onShareAppMessage: function () {
    if (!this._input) return { title: '同乐八字 · 性格画像', path: '/pages/index/index' };
    var meta = this.data.meta || {};
    var core = this.data.core || {};
    return {
      title: (meta.name || '我') + '的性格画像' + (core.title ? ' · ' + core.title : ''),
      path: '/pages/portrait/portrait?input=' + encodeURIComponent(JSON.stringify(this._input))
    };
  },

  onShareTimeline: function () {
    if (!this._input) return { title: '同乐八字 · 性格画像' };
    var meta = this.data.meta || {};
    var core = this.data.core || {};
    return {
      title: (meta.name || '我') + '的性格画像' + (core.title ? ' · ' + core.title : ''),
      query: 'input=' + encodeURIComponent(JSON.stringify(this._input))
    };
  }
});
