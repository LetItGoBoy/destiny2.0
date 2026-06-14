// 详批页：调候 / 旺衰 / 格局 三派合参，输出性格与健康提示
var bazi = require('../../utils/bazi.js');
var analyzer = require('../../utils/analyze/index.js');
var prefs = require('../../utils/prefs.js');

Page({
  data: {
    loaded: false,
    fs: 'std',
    meta: {},
    pillars: [],
    summary: '',
    wangShuai: null,
    tiaoHou: null,
    geJu: null,
    xingGe: null,
    jianKang: null,
    showBreakdown: false
  },

  onToggleBreakdown: function () {
    this.setData({ showBreakdown: !this.data.showBreakdown });
  },

  onLoad: function (options) {
    this.setData({ fs: prefs.getFontSize() });
    var input = null;
    try {
      input = JSON.parse(decodeURIComponent(options.input));
    } catch (e) { /* fallthrough */ }
    if (!input) {
      wx.showToast({ title: '参数有误', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }

    var chart;
    var result;
    try {
      chart = bazi.computeChart(input);
      result = analyzer.analyze(chart);
    } catch (e) {
      wx.showToast({ title: '分析失败，请重试', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }

    this.setData({
      loaded: true,
      meta: chart.meta,
      pillars: chart.pillars.map(function (p) {
        return { label: p.label, gan: p.gan, zhi: p.zhi };
      }),
      summary: result.summary,
      wangShuai: result.wangShuai,
      tiaoHou: result.tiaoHou,
      geJu: result.geJu,
      xingGe: result.xingGe,
      jianKang: result.jianKang
    });
  }
});
