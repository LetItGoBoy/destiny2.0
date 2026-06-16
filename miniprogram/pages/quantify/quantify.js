// 八字量化页：逐字能量可视化（充能水位 / 字号大小），叠加大运流年改写
var bazi = require('../../utils/bazi.js');
var energy = require('../../utils/analyze/energy.js');
var prefs = require('../../utils/prefs.js');

Page({
  data: {
    loaded: false,
    fs: 'std',
    meta: {},
    mode: 'fill',            // 'fill' 充能水位 | 'size' 字号大小
    daYunList: [],
    liuNianList: [],
    dyIndex: -1,
    lnIndex: -1,
    ganCells: [],
    zhiCells: [],
    pBase: 50,
    pNow: 50,
    hasLuck: false,
    curLabel: '原局 · 无岁运'
  },

  onLoad: function (options) {
    this.setData({ fs: prefs.getFontSize ? prefs.getFontSize() : 'std' });
    var input = null;
    try { input = JSON.parse(decodeURIComponent(options.input)); } catch (e) { /* noop */ }
    if (!input) {
      wx.showToast({ title: '参数有误', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    var chart;
    try { chart = bazi.computeChart(input); } catch (e) {
      wx.showToast({ title: '计算失败，请重试', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this._chart = chart;

    var dy = (chart.daYun || []).filter(function (d) {
      return d.ganZhi && !d.isQian;
    }).map(function (d, i) {
      return {
        index: i, gz: d.ganZhi, cls: d.gan.cls,
        age: d.startAge + '–' + d.endAge, god: d.shiShenGan,
        _liuNian: d.liuNian || []
      };
    });
    this._dy = dy;
    this.setData({ loaded: true, meta: chart.meta, daYunList: dy });
    this.recompute();
  },

  recompute: function () {
    var dyGZ = null, lnGZ = null, label = '原局 · 无岁运';
    if (this.data.dyIndex >= 0) {
      var d = this._dy[this.data.dyIndex];
      dyGZ = d.gz; label = '大运 ' + d.gz;
      if (this.data.lnIndex >= 0) {
        var ln = this.data.liuNianList[this.data.lnIndex];
        lnGZ = ln.gz; label += ' · 流年 ' + ln.gz + '（' + ln.year + '）';
      }
    }
    var m = energy.build(this._chart, { daYunGZ: dyGZ, liuNianGZ: lnGZ });
    var maxRef = m.maxRef;
    var deco = function (c) {
      var r = Math.min(1, c.val / maxRef);
      c.fill = Math.round(8 + r * 92);     // 充能水位 %
      c.fs = Math.round(40 + r * 54);      // 字号 rpx
      return c;
    };
    this.setData({
      ganCells: m.ganCells.map(deco),
      zhiCells: m.zhiCells.map(deco),
      pBase: m.pBase, pNow: m.pNow,
      hasLuck: m.hasLuck, curLabel: label
    });
  },

  onMode: function (e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  onDaYun: function (e) {
    var idx = +e.currentTarget.dataset.index;
    if (idx === this.data.dyIndex) {
      this.setData({ dyIndex: -1, lnIndex: -1, liuNianList: [] });
      this.recompute();
      return;
    }
    var d = this._dy[idx];
    var ln = (d._liuNian || []).map(function (x, i) {
      return { index: i, gz: x.ganZhi, year: x.year, age: x.age, cls: x.gan.cls, god: x.shiShenGan };
    });
    this.setData({ dyIndex: idx, lnIndex: -1, liuNianList: ln });
    this.recompute();
  },

  onLiuNian: function (e) {
    var idx = +e.currentTarget.dataset.index;
    this.setData({ lnIndex: idx === this.data.lnIndex ? -1 : idx });
    this.recompute();
  }
});
