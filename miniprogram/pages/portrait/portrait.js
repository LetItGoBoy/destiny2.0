var bazi = require('../../utils/bazi.js');
var portrait = require('../../utils/analyze/portrait.js');
var prefs = require('../../utils/prefs.js');

function polVerdictOf(zheng) {
  if (zheng >= 58) return '你更偏「守正」：遇事先求稳、讲规则、重积累，可靠是你的默认姿态；变化来临时习惯先想清楚再动。';
  if (zheng <= 42) return '你更偏「求变」：不安于重复，天然想突破、想表达，机会感比稳定感更让你安心；顺境里冲劲十足。';
  return '你在守正与求变之间较为均衡：能稳能闯，会按场合切换姿态，既守得住基本盘，也接得住新机会。';
}

var PATTERN_NOTES = {
  食神制杀: '温和的输出与强悍的压力势均力敌、互相制衡：能把危机感转成章法，是很有张力的组合。',
  羊刃驾杀: '刚劲与魄力互相咬合：敢扛硬仗、关键时刻压得住阵，但需要分寸来驾驭这股狠劲。',
  身杀两停: '自我与挑战势均力敌：抗压耐打，压力越大越能被激发，越有目标越有力。'
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
    luckSegments: [],
    luckPortrait: null,
    selectedLuckIndex: null,
    currentLuckIndex: null,
    hasPrevLuck: false,
    hasNextLuck: false,
    selectedYear: null,
    openYearList: [],
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
    this._luckList = chart.daYun || [];
    this._selectedLuckIndex = null;
    this._selectedYear = new Date().getFullYear();

    prefs.pushHistory({
      input: input,
      name: chart.meta.name,
      gender: chart.meta.gender,
      baZi: chart.pillars.filter(function (p) { return !p.empty; }).map(function (p) { return p.ganZhi; }).join(' '),
      dateStr: chart.meta.clockStr
    });

    this.setData({ loaded: true, meta: chart.meta });
    this.recompute();
  },

  dyByIndex: function (index) {
    for (var i = 0; i < this._luckList.length; i++) {
      if (this._luckList[i].index === index) return this._luckList[i];
    }
    return null;
  },

  yearListForSelected: function (activeYear) {
    var daYun = this.dyByIndex(this._selectedLuckIndex);
    if (!daYun || daYun.isQian || !daYun.liuNian) return [];
    return daYun.liuNian.map(function (item) {
      return {
        year: item.year,
        age: item.age,
        gz: item.ganZhi,
        active: item.year === activeYear
      };
    });
  },

  selectLuck: function (e) {
    var index = Number(e.currentTarget.dataset.index);
    if (isNaN(index) || index === this._selectedLuckIndex) return;
    this._selectedLuckIndex = index;
    this._selectedYear = null;
    this.recompute();
  },

  stepLuck: function (e) {
    var delta = Number(e.currentTarget.dataset.d);
    var list = this.data.luckSegments || [];
    if (!list.length || !delta) return;
    var current = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].index === this._selectedLuckIndex) {
        current = i;
        break;
      }
    }
    var next = Math.max(0, Math.min(list.length - 1, current + delta));
    if (next === current) return;
    this._selectedLuckIndex = list[next].index;
    this._selectedYear = null;
    this.recompute();
  },

  selectYear: function (e) {
    var year = Number(e.currentTarget.dataset.year);
    if (isNaN(year)) return;
    this._selectedYear = this._selectedYear === year ? null : year;
    this.recompute();
  },

  stepYear: function (e) {
    var delta = Number(e.currentTarget.dataset.d);
    var list = this.yearListForSelected(this._selectedYear);
    if (!list.length) return;
    var current = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].year === this._selectedYear) {
        current = i;
        break;
      }
    }
    var next = current < 0
      ? (delta < 0 ? list.length - 1 : 0)
      : Math.max(0, Math.min(list.length - 1, current + delta));
    this._selectedYear = list[next].year;
    this.recompute();
  },

  recompute: function () {
    var result = portrait.build(this._chart, {
      selectedLuckIndex: this._selectedLuckIndex,
      selectedYear: this._selectedYear
    });
    this._selectedLuckIndex = result.selectedLuckIndex;
    this._selectedYear = result.selectedYear;
    var selectedPosition = 0;
    for (var i = 0; i < (result.luckSegments || []).length; i++) {
      if (result.luckSegments[i].index === result.selectedLuckIndex) {
        selectedPosition = i;
        break;
      }
    }

    this.setData({
      core: result.core,
      traitPattern: result.traitPattern
        ? { name: result.traitPattern.name, note: PATTERN_NOTES[result.traitPattern.name] || '' }
        : null,
      zhengNow: result.zhengNow,
      pianNow: result.pianNow,
      polVerdict: polVerdictOf(result.zhengNow),
      hasTime: result.hasTime,
      luckSegments: result.luckSegments || [],
      luckPortrait: result.luckPortrait,
      selectedLuckIndex: result.selectedLuckIndex,
      currentLuckIndex: result.currentLuckIndex,
      hasPrevLuck: selectedPosition > 0,
      hasNextLuck: selectedPosition < (result.luckSegments || []).length - 1,
      selectedYear: result.selectedYear,
      openYearList: this.yearListForSelected(result.selectedYear),
      relations: result.relations || []
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
