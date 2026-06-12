var bazi = require('../../utils/bazi.js');
var store = require('../../utils/store.js');
var baike = require('../../utils/baike.js');
var prefs = require('../../utils/prefs.js');

Page({
  data: {
    tab: 'base',
    loaded: false,
    fromRecord: false,
    saved: false,
    meta: {},
    tablePillars: [],
    wuXing: [],
    daYunBar: [],
    dyIndex: -1,
    liuNianBar: [],
    lnIndex: -1,
    selLiuNian: null,
    termCard: null,
    baZiStr: '',
    fs: 'std'
  },

  onLoad: function (options) {
    this.setData({ fs: prefs.getFontSize() });
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
      saved: options.from === 'record',
      meta: chart.meta,
      wuXing: chart.wuXing,
      daYunBar: daYunBar,
      baZiStr: chart.pillars.map(function (p) { return p.ganZhi; }).join('　')
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
    this.updateTable();
  },

  onDaYunTap: function (e) {
    this.selectDaYun(Number(e.currentTarget.dataset.index));
  },

  selectDaYun: function (index) {
    var dy = this._chart.daYun[index];
    if (!dy) return;
    var liuNianBar = dy.liuNian.map(function (n) {
      return {
        index: n.index, year: n.year, age: n.age,
        ganZhi: n.ganZhi, gan: n.gan, zhi: n.zhi, shiShenGan: n.shiShenGan
      };
    });
    this.setData({
      dyIndex: index,
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
      selLiuNian: { year: ln.year, age: ln.age, liuYue: ln.liuYue }
    });
    this.updateTable();
  },

  // 基础盘 = 四柱；详盘 = 选中大运、流年作为最左两柱 + 四柱（六柱同表）
  updateTable: function () {
    var pillars = this._chart.pillars.slice(0);
    if (this.data.tab === 'detail') {
      var extras = [];
      var dy = this._chart.daYun[this.data.dyIndex];
      if (dy) {
        if (dy.isQian) {
          extras.push({ label: '大运', sub: '童限', empty: true });
        } else {
          extras.push(this.extraColumn(dy, '大运', dy.startAge + '-' + dy.endAge + '岁'));
        }
        var ln = dy.liuNian[this.data.lnIndex];
        if (ln) {
          extras.push(this.extraColumn(ln, '流年', ln.year + '年'));
        }
      }
      pillars = extras.concat(pillars);
    }
    this.setData({ tablePillars: pillars });
  },

  // 点击十神/十二长生/神煞/纳音弹出解读卡
  onTermTap: function (e) {
    var card = baike.lookup(e.currentTarget.dataset.term);
    if (!card) return;
    this.setData({ termCard: card });
  },

  closeTermCard: function () {
    this.setData({ termCard: null });
  },

  noop: function () {},

  // 详批：调候/旺衰/格局三派合参
  onXiangPi: function () {
    wx.navigateTo({
      url: '/pages/analysis/analysis?input=' + encodeURIComponent(JSON.stringify(this._input))
    });
  },

  extraColumn: function (p, label, sub) {
    return {
      label: label,
      sub: sub,
      extra: true,
      ganZhi: p.ganZhi, gan: p.gan, zhi: p.zhi,
      shiShenGan: p.shiShenGan, hideGans: p.hideGans,
      xingYun: p.xingYun, ziZuo: p.ziZuo,
      xunKong: p.xunKong, naYin: p.naYin, shenSha: p.shenSha
    };
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
      title: (meta.name || '八字') + ' · ' + this._chart.pillars.map(function (p) { return p.ganZhi; }).join(' '),
      path: '/pages/result/result?input=' + encodeURIComponent(JSON.stringify(this._input))
    };
  }
});
