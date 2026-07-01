var bazi = require('../../utils/bazi.js');
var cities = require('../../utils/cities.js');
var store = require('../../utils/store.js');
var prefs = require('../../utils/prefs.js');

var THIS_YEAR = new Date().getFullYear();
var START_YEAR = 1901;

Page({
  data: {
    name: '',
    gender: 1,
    calendar: 'solar',
    solarDate: '1990-06-15',
    maxDate: THIS_YEAR + '-12-31',
    time: '12:00',
    unknownTime: true,           // 默认不知道出生时辰（不排时柱）
    // 农历选择器
    lunarRange: [[], [], []],
    lunarIndex: [0, 0, 0],
    lunarText: '',
    // 出生地选择器
    regionRange: [[], []],
    regionIndex: [0, 0],
    regionText: '',
    useTrueSolar: true,
    recent: [],
    fs: 'std',
    casting: false,
    zhiRing: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  },

  onLoad: function () {
    // 农历年列表
    this._lunarYears = [];
    for (var y = START_YEAR; y <= THIS_YEAR; y++) this._lunarYears.push(y);
    this._lunarSel = [1990 - START_YEAR, 0, 0];
    this.rebuildLunarRange(true);

    // 省市列表
    this._provinces = cities;
    var provNames = cities.map(function (p) { return p.name; });
    var cityNames = cities[0].cities.map(function (c) { return c.name; });
    this.setData({
      regionRange: [provNames, cityNames],
      regionText: cities[0].name + ' ' + cities[0].cities[0].name
    });
  },

  onShow: function () {
    var that = this;
    this.setData({
      casting: false,
      fs: prefs.getFontSize()
    });
    store.listRecords().then(function (res) {
      var recent = res.list.slice(0, 3).map(function (r) {
        r.bz = bazi.colorizeBaZi(r.baZi);
        return r;
      });
      that.setData({ recent: recent });
    });
  },

  // 此刻星象 → 打开当前时刻星图
  goAstroNow: function () {
    wx.navigateTo({ url: '/pages/astro/astro?now=1' });
  },

  // 长辈模式：一键把全站字号切到「特大」，再点切回「大」
  toggleElder: function () {
    var next = this.data.fs === 'xl' ? 'l' : 'xl';
    prefs.setFontSize(next);
    this.setData({ fs: next });
    wx.showToast({
      title: next === 'xl' ? '已开启长辈模式 · 字更大' : '已退出长辈模式',
      icon: 'none'
    });
  },

  onNameInput: function (e) {
    this.setData({ name: e.detail.value });
  },

  onGenderTap: function (e) {
    this.setData({ gender: Number(e.currentTarget.dataset.gender) });
  },

  onCalendarTap: function (e) {
    this.setData({ calendar: e.currentTarget.dataset.calendar });
  },

  onSolarDateChange: function (e) {
    this.setData({ solarDate: e.detail.value });
  },

  onTimeChange: function (e) {
    this.setData({ time: e.detail.value });
  },

  // 是否知道出生时辰（开关：开=已知，关=未知）
  onKnowTimeChange: function (e) {
    this.setData({ unknownTime: !e.detail.value });
  },

  // ---- 农历选择器 ----
  rebuildLunarRange: function (init) {
    var sel = this._lunarSel;
    var year = this._lunarYears[sel[0]];
    var months = bazi.getLunarMonths(year);
    if (sel[1] > months.length - 1) sel[1] = months.length - 1;
    var days = bazi.getLunarDays(year, months[sel[1]].value);
    if (sel[2] > days.length - 1) sel[2] = days.length - 1;
    this._lunarMonths = months;
    this._lunarDays = days;
    var range = [
      this._lunarYears.map(function (y) { return y + '年'; }),
      months.map(function (m) { return m.label; }),
      days.map(function (d) { return d.label; })
    ];
    var text = year + '年 ' + months[sel[1]].label + months[sel[2]].label;
    this.setData({
      lunarRange: range,
      lunarIndex: sel.slice(0),
      lunarText: init ? text : this.data.lunarText
    });
    return text;
  },

  onLunarColumnChange: function (e) {
    this._lunarSel[e.detail.column] = e.detail.value;
    if (e.detail.column < 2) this.rebuildLunarRange(false);
  },

  onLunarChange: function (e) {
    this._lunarSel = e.detail.value.slice(0);
    var text = this.rebuildLunarRange(false);
    this.setData({ lunarText: text });
  },

  // ---- 出生地选择器 ----
  onRegionColumnChange: function (e) {
    if (e.detail.column === 0) {
      var prov = this._provinces[e.detail.value];
      this.setData({
        'regionRange[1]': prov.cities.map(function (c) { return c.name; })
      });
    }
  },

  onRegionChange: function (e) {
    var idx = e.detail.value;
    var prov = this._provinces[idx[0]];
    var city = prov.cities[Math.min(idx[1], prov.cities.length - 1)];
    this.setData({
      regionIndex: idx,
      regionText: prov.name + ' ' + city.name
    });
  },

  onTrueSolarChange: function (e) {
    this.setData({ useTrueSolar: e.detail.value });
  },

  // 收集表单为排盘入参
  collectInput: function () {
    var d = this.data;
    var time = d.time.split(':');
    var input = {
      name: d.name.trim(),
      gender: d.gender,
      calendar: d.calendar,
      unknownTime: d.unknownTime,
      hour: d.unknownTime ? null : Number(time[0]),
      minute: d.unknownTime ? null : Number(time[1]),
      useTrueSolar: d.unknownTime ? false : d.useTrueSolar
    };
    if (d.calendar === 'solar') {
      var sd = d.solarDate.split('-');
      input.year = Number(sd[0]);
      input.month = Number(sd[1]);
      input.day = Number(sd[2]);
    } else {
      input.year = this._lunarYears[this._lunarSel[0]];
      input.month = this._lunarMonths[this._lunarSel[1]].value;
      input.day = this._lunarDays[this._lunarSel[2]].value;
    }
    var prov = this._provinces[d.regionIndex[0]];
    var city = prov.cities[Math.min(d.regionIndex[1], prov.cities.length - 1)];
    input.province = prov.name;
    input.city = city.name;
    input.lng = city.lng;
    return input;
  },

  // 先播起盘动画，再跳转
  castThenGo: function (url) {
    if (this.data.casting) return;
    this.setData({ casting: true });
    var that = this;
    setTimeout(function () {
      wx.navigateTo({
        url: url,
        complete: function () {
          setTimeout(function () { that.setData({ casting: false }); }, 160);
        }
      });
    }, 720);
  },

  // ---- 排盘（进结果页）----
  onPaiPan: function () {
    var input = this.collectInput();
    this.castThenGo('/pages/result/result?input=' + encodeURIComponent(JSON.stringify(input)));
  },

  // ---- 一键性格画像（跳过排盘，直达解读）----
  onQuickXiangPi: function () {
    var input = this.collectInput();
    this.castThenGo('/pages/portrait/portrait?input=' + encodeURIComponent(JSON.stringify(input)));
  },

  // ---- 模块入口 ----
  goMatch: function () {
    wx.showToast({ title: '功能即将上线', icon: 'none' });
  },

  goRecord: function (e) {
    var rec = this.data.recent[e.currentTarget.dataset.index];
    var input = {
      name: rec.name, gender: rec.gender, calendar: rec.calendar,
      year: rec.year, month: rec.month, day: rec.day,
      hour: rec.hour, minute: rec.minute, unknownTime: rec.unknownTime,
      province: rec.province, city: rec.city, lng: rec.lng,
      useTrueSolar: rec.useTrueSolar
    };
    wx.navigateTo({
      url: '/pages/result/result?from=record&input=' + encodeURIComponent(JSON.stringify(input))
    });
  },

  goRecords: function () {
    wx.switchTab({ url: '/pages/records/records' });
  }
});
