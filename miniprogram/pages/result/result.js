var bazi = require('../../utils/bazi.js');
var store = require('../../utils/store.js');

Page({
  data: {
    tab: 'base',
    loaded: false,
    fromRecord: false,
    saved: false,
    meta: {},
    pillars: [],
    wuXing: [],
    daYunBar: [],
    dyIndex: -1,
    selDaYun: null,
    liuNianBar: [],
    lnIndex: -1,
    selLiuNian: null
  },

  onLoad: function (options) {
    var input = null;
    try {
      input = JSON.parse(decodeURIComponent(options.input));
    } catch (e) { /* fallthrough */ }
    if (!input) {
      wx.showToast({ title: '排盘参数有误', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this._input = input;

    var chart;
    try {
      chart = bazi.computeChart(input);
    } catch (e) {
      wx.showToast({ title: '排盘失败，请检查输入', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this._chart = chart;

    // 大运横条（不含流年，控制 setData 体积）
    var daYunBar = chart.daYun.map(function (d) {
      return {
        index: d.index,
        isQian: d.isQian,
        ganZhi: d.ganZhi,
        gan: d.gan,
        zhi: d.zhi,
        shiShenGan: d.shiShenGan,
        startYear: d.startYear,
        startAge: d.startAge
      };
    });

    this.setData({
      loaded: true,
      fromRecord: options.from === 'record',
      meta: chart.meta,
      pillars: chart.pillars,
      wuXing: chart.wuXing,
      daYunBar: daYunBar
    });

    // 默认选中当前所处大运
    var nowYear = new Date().getFullYear();
    var dyIndex = 0;
    for (var i = 0; i < chart.daYun.length; i++) {
      if (nowYear >= chart.daYun[i].startYear && nowYear <= chart.daYun[i].endYear) {
        dyIndex = i;
        break;
      }
    }
    this.selectDaYun(dyIndex);
  },

  onTab: function (e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  onDaYunTap: function (e) {
    this.selectDaYun(Number(e.currentTarget.dataset.index));
  },

  selectDaYun: function (index) {
    var dy = this._chart.daYun[index];
    if (!dy) return;
    var sel = null;
    if (!dy.isQian) {
      sel = {
        ganZhi: dy.ganZhi, gan: dy.gan, zhi: dy.zhi,
        shiShenGan: dy.shiShenGan, hideGans: dy.hideGans,
        xingYun: dy.xingYun, ziZuo: dy.ziZuo, naYin: dy.naYin,
        shenSha: dy.shenSha,
        rangeText: dy.startYear + ' - ' + dy.endYear + '年 · ' + dy.startAge + '-' + dy.endAge + '岁'
      };
    }
    var liuNianBar = dy.liuNian.map(function (n) {
      return {
        index: n.index, year: n.year, age: n.age,
        ganZhi: n.ganZhi, gan: n.gan, zhi: n.zhi, shiShenGan: n.shiShenGan
      };
    });
    this.setData({
      dyIndex: index,
      selDaYun: sel,
      liuNianBar: liuNianBar
    });

    // 默认选中当前流年（不在该大运区间则选首年）
    var nowYear = new Date().getFullYear();
    var lnIndex = 0;
    for (var i = 0; i < dy.liuNian.length; i++) {
      if (dy.liuNian[i].year === nowYear) {
        lnIndex = i;
        break;
      }
    }
    this.selectLiuNian(index, lnIndex);
  },

  onLiuNianTap: function (e) {
    this.selectLiuNian(this.data.dyIndex, Number(e.currentTarget.dataset.index));
  },

  selectLiuNian: function (dyIndex, lnIndex) {
    var ln = this._chart.daYun[dyIndex].liuNian[lnIndex];
    if (!ln) return;
    this.setData({
      lnIndex: lnIndex,
      selLiuNian: {
        year: ln.year, age: ln.age,
        ganZhi: ln.ganZhi, gan: ln.gan, zhi: ln.zhi,
        shiShenGan: ln.shiShenGan, hideGans: ln.hideGans,
        xingYun: ln.xingYun, ziZuo: ln.ziZuo, naYin: ln.naYin,
        shenSha: ln.shenSha, liuYue: ln.liuYue
      }
    });
  },

  onSave: function () {
    if (this.data.saved) return;
    var that = this;
    var input = this._input;
    var chart = this._chart;
    var record = {
      name: input.name || '',
      gender: input.gender,
      calendar: input.calendar,
      year: input.year, month: input.month, day: input.day,
      hour: input.hour, minute: input.minute,
      province: input.province || '', city: input.city || '',
      lng: input.lng, useTrueSolar: input.useTrueSolar,
      baZi: chart.pillars.map(function (p) { return p.ganZhi; }).join(' '),
      solarStr: chart.meta.clockStr,
      lunarStr: chart.meta.lunarStr
    };
    store.saveRecord(record).then(function (res) {
      that.setData({ saved: true });
      wx.showToast({
        title: res.source === 'cloud' ? '已存入云端记录' : '已存入本地记录',
        icon: 'success'
      });
    });
  },

  onShareAppMessage: function () {
    var meta = this.data.meta;
    return {
      title: (meta.name || '八字') + ' · ' + this.data.pillars.map(function (p) { return p.ganZhi; }).join(' '),
      path: '/pages/result/result?input=' + encodeURIComponent(JSON.stringify(this._input))
    };
  }
});
