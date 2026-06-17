// 性格画像：天干外显心性构成，可叠加大运/流年看比例此消彼长
var bazi = require('../../utils/bazi.js');
var portrait = require('../../utils/analyze/portrait.js');
var prefs = require('../../utils/prefs.js');

Page({
  data: {
    loaded: false,
    fs: 'std',
    meta: {},
    core: {},
    paimian: [],
    list: [],
    zhengNow: 50, pianNow: 50,
    hasLuck: false,
    hasTime: true,
    curLabel: '本命 · 未叠加岁运',
    // 岁运选择
    daYunList: [],
    liuNianList: [],
    dyIndex: -1,
    lnIndex: -1
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

    // 大运列表（去童限）
    this._dy = (chart.daYun || []).filter(function (d) {
      return d.ganZhi && !d.isQian;
    }).map(function (d, i) {
      return {
        index: i, gz: d.ganZhi, gan: d.gan, zhi: d.zhi,
        god: d.shiShenGan, age: d.startAge + '–' + d.endAge,
        _liuNian: d.liuNian || []
      };
    });

    this.setData({ loaded: true, meta: chart.meta, daYunList: this._dy });
    this.recompute();
  },

  onDaYun: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    if (idx === this.data.dyIndex) {
      this.setData({ dyIndex: -1, lnIndex: -1, liuNianList: [] });
      this.recompute();
      return;
    }
    var d = this._dy[idx];
    var ln = (d._liuNian || []).map(function (x, i) {
      return { index: i, gz: x.ganZhi, gan: x.gan, zhi: x.zhi, god: x.shiShenGan, year: x.year };
    });
    this.setData({ dyIndex: idx, lnIndex: -1, liuNianList: ln });
    this.recompute();
  },

  onLiuNian: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    this.setData({ lnIndex: idx === this.data.lnIndex ? -1 : idx });
    this.recompute();
  },

  recompute: function () {
    var dyGZ = null, lnGZ = null, label = '本命 · 未叠加岁运';
    if (this.data.dyIndex >= 0) {
      var d = this._dy[this.data.dyIndex];
      dyGZ = d.gz; label = '大运 ' + d.gz;
      if (this.data.lnIndex >= 0) {
        var ln = this.data.liuNianList[this.data.lnIndex];
        lnGZ = ln.gz; label += ' · 流年 ' + ln.gz + '（' + ln.year + '）';
      }
    }
    var p = portrait.build(this._chart, { daYunGZ: dyGZ, liuNianGZ: lnGZ });
    this.setData({
      core: p.core,
      paimian: p.paimian,
      list: p.list,
      zhengNow: p.zhengNow, pianNow: p.pianNow,
      hasLuck: p.hasLuck,
      hasTime: p.hasTime,
      curLabel: label
    });
  },

  noop: function () {}
});
