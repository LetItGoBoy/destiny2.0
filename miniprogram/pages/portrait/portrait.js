var bazi = require('../../utils/bazi.js');
var portrait = require('../../utils/analyze/portrait.js');
var prefs = require('../../utils/prefs.js');

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
    polVerdict: '',
    hasTime: true,
    stagePortraits: [],
    openStageKey: '',
    currentStageKey: '',
    openLayers: {},
    openYearList: [],
    hasLuck: false,
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

    // 一键画像也是一次排盘，记入「最近排盘」历史
    prefs.pushHistory({
      input: input,
      name: chart.meta.name,
      gender: chart.meta.gender,
      baZi: chart.pillars.filter(function (p) { return !p.empty; }).map(function (p) { return p.ganZhi; }).join(' '),
      dateStr: chart.meta.clockStr
    });

    this._luckList = chart.daYun || [];
    this._luckByStage = {};
    this._yearByStage = {};

    // 当前阶段默认打开，并选中当前大运与今年流年。
    var currentYear = new Date().getFullYear();
    var birthYear = new Date(chart.meta.timestamp).getFullYear();
    var age = currentYear - birthYear;
    var currentDy = null;
    for (var i = 0; i < this._luckList.length; i++) {
      var d = this._luckList[i];
      if (currentYear >= d.startYear && currentYear <= d.endYear) {
        currentDy = d;
        for (var j = 0; j < (d.liuNian || []).length; j++) {
          if (d.liuNian[j].year === currentYear) { age = d.liuNian[j].age; break; }
        }
        break;
      }
    }
    var curKey = age < 20 ? 'youth' : age < 35 ? 'young' : age < 50 ? 'middle' : 'old';
    if (currentDy) {
      this._luckByStage[curKey] = currentDy.index;
      this._yearByStage[curKey] = currentYear;
    }
    this.setData({ loaded: true, meta: chart.meta, openStageKey: curKey, currentStageKey: curKey });
    this.recompute();
  },

  dyByIndex: function (index) {
    for (var i = 0; i < this._luckList.length; i++) {
      if (this._luckList[i].index === index) return this._luckList[i];
    }
    return null;
  },

  selectedLuckIndex: function (key) {
    if (this._luckByStage[key] != null) return this._luckByStage[key];
    var stages = this._lastStages || [];
    for (var i = 0; i < stages.length; i++) {
      if (stages[i].key === key) return stages[i].selectedLuckIndex;
    }
    return null;
  },

  selectedLuckSegment: function (key) {
    var stages = this._lastStages || [];
    for (var i = 0; i < stages.length; i++) {
      if (stages[i].key !== key) continue;
      var segments = stages[i].luckSegments || [];
      for (var j = 0; j < segments.length; j++) {
        if (segments[j].active) return segments[j];
      }
    }
    return null;
  },

  // 当前阶段所选大运的流年列表（可选叠加）
  yearListForKey: function (key, activeYear) {
    var d = this.dyByIndex(this.selectedLuckIndex(key));
    var segment = this.selectedLuckSegment(key);
    if (!d || !d.liuNian) return [];
    return d.liuNian.filter(function (ln) {
      return !segment || (ln.age >= segment.startAge && ln.age <= segment.endAge);
    }).map(function (ln) {
      return { year: ln.year, age: ln.age, gz: ln.ganZhi, active: ln.year === activeYear };
    });
  },

  layerOpen: function (stageKey, layerKey) {
    var key = stageKey + ':' + layerKey;
    return this.data.openLayers[key] !== false;
  },

  applyLayerOpen: function (stages) {
    var self = this;
    (stages || []).forEach(function (st) {
      if (!st) return;
      if (st.outerLayer) st.outerLayer.open = self.layerOpen(st.key, 'outer');
      if (st.innerLayer) st.innerLayer.open = self.layerOpen(st.key, 'inner');
    });
  },

  toggleStage: function (e) {
    var key = e.currentTarget.dataset.key;
    var next = this.data.openStageKey === key ? '' : key;
    this.setData({ openStageKey: next });
    this.recompute();
  },

  toggleLayer: function (e) {
    var stage = e.currentTarget.dataset.stage;
    var layer = e.currentTarget.dataset.layer;
    if (!stage || !layer) return;
    var key = stage + ':' + layer;
    var next = {};
    for (var k in this.data.openLayers) next[k] = this.data.openLayers[k];
    next[key] = this.data.openLayers[key] === false;
    this.setData({ openLayers: next });
    this.recompute();
  },

  selectStageLuck: function (e) {
    var key = e.currentTarget.dataset.key;
    var index = Number(e.currentTarget.dataset.index);
    if (!key || isNaN(index)) return;
    this._luckByStage[key] = index;
    delete this._yearByStage[key];
    this.recompute();
  },

  // 选某大运卡片里的流年（叠加金色）
  selectStageYear: function (e) {
    var key = e.currentTarget.dataset.key;
    var year = Number(e.currentTarget.dataset.year);
    // 再点当前已选年份=取消叠加
    if (this._yearByStage[key] === year) delete this._yearByStage[key];
    else this._yearByStage[key] = year;
    this.recompute();
  },

  stepStageYear: function (e) {
    var key = e.currentTarget.dataset.key;
    var delta = Number(e.currentTarget.dataset.d);
    var list = this.yearListForKey(key, this._yearByStage[key]);
    if (!list.length) return;
    var cur = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].year === this._yearByStage[key]) { cur = i; break; }
    }
    var next = cur < 0
      ? (delta < 0 ? list.length - 1 : 0)
      : Math.max(0, Math.min(list.length - 1, cur + delta));
    this._yearByStage[key] = list[next].year;
    this.recompute();
  },

  recompute: function () {
    var openKey = this.data.openStageKey;
    var selYear = openKey ? this._yearByStage[openKey] : null;
    var p = portrait.build(this._chart, {
      luckByStage: this._luckByStage,
      yearByStage: this._yearByStage
    });
    this._lastStages = p.stagePortraits || [];
    this.applyLayerOpen(p.stagePortraits || []);

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
      openYearList: openKey ? this.yearListForKey(openKey, selYear) : [],
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
