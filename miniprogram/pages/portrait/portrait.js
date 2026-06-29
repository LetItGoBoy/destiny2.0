// 性格画像：天干外显心性构成，可叠加大运/流年看比例此消彼长
var bazi = require('../../utils/bazi.js');
var portrait = require('../../utils/analyze/portrait.js');
var prefs = require('../../utils/prefs.js');

Page({
  data: {
    loaded: false,
    fs: 'std',
    tab: 'trait',         // 模块：trait=主心性(贯穿一生) / season=性格四季
    meta: {},
    core: {},
    paimian: [],
    list: [],
    traitBubbles: [],
    outerList: [],
    innerList: [],
    outerBubbles: [],
    innerBubbles: [],
    luckTrait: null,
    branchList: [],
    relations: [],
    stages: [],
    zhengNow: 50, pianNow: 50,
    hasLuck: false,
    hasTime: true,
    curLabel: '原局 · 未叠加时间阶段',
    traitNote: '',
    // 岁运选择
    daYunList: [],
    liuNianList: [],
    dyIndex: -1,
    lnIndex: -1,
    // 底部时光条
    panelOpen: false,
    curYear: null,        // 当前流年（null=本命/未选流年）
    barGz: '',            // 时光条上的干支摘要
    barYearShow: '',      // 时光条上显示的年份
    barActive: false      // 流年是否已激活
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

    // 年份 → {dy, ln} 映射，供流年快进
    this._yearMap = {};
    var minY = Infinity, maxY = -Infinity, self = this;
    this._dy.forEach(function (d) {
      (d._liuNian || []).forEach(function (x, i) {
        self._yearMap[x.year] = { dy: d.index, ln: i };
        if (x.year < minY) minY = x.year;
        if (x.year > maxY) maxY = x.year;
      });
    });
    this._yearMin = minY === Infinity ? null : minY;
    this._yearMax = maxY === -Infinity ? null : maxY;

    this.setData({ loaded: true, meta: chart.meta, daYunList: this._dy });
    this.recompute();
  },

  // 切换模块：主心性 / 性格四季
  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab: tab, panelOpen: false });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  // 在面板中点选大运（仅大运，清掉流年）
  onDaYun: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    if (idx === this.data.dyIndex) {
      this.setData({ dyIndex: -1, lnIndex: -1, liuNianList: [], curYear: null });
      this.recompute();
      return;
    }
    var d = this._dy[idx];
    var ln = (d._liuNian || []).map(function (x, i) {
      return { index: i, gz: x.ganZhi, gan: x.gan, zhi: x.zhi, god: x.shiShenGan, year: x.year };
    });
    this.setData({ dyIndex: idx, lnIndex: -1, liuNianList: ln, curYear: null });
    this.recompute();
  },

  // 在面板中点选流年
  onLiuNian: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    var off = idx === this.data.lnIndex;
    var year = off ? null : this.data.liuNianList[idx].year;
    this.setData({ lnIndex: off ? -1 : idx, curYear: year });
    this.recompute();
  },

  // 跳到某一年（自动定位所属大运）
  selectYear: function (year) {
    var m = this._yearMap[year];
    if (!m) return;
    var d = this._dy[m.dy];
    var ln = (d._liuNian || []).map(function (x, i) {
      return { index: i, gz: x.ganZhi, gan: x.gan, zhi: x.zhi, god: x.shiShenGan, year: x.year };
    });
    this.setData({ dyIndex: m.dy, lnIndex: m.ln, liuNianList: ln, curYear: year });
    this.recompute();
  },

  // 时光条逐年快进
  stepYear: function (e) {
    if (this._yearMin == null) return;
    var delta = Number(e.currentTarget.dataset.d);
    var base;
    if (this.data.curYear == null) {
      var today = new Date().getFullYear();
      base = Math.min(this._yearMax, Math.max(this._yearMin, today));   // 首次落到今年
    } else {
      base = this.data.curYear + delta;
    }
    base = Math.min(this._yearMax, Math.max(this._yearMin, base));
    this.selectYear(base);
  },

  backToNatal: function () {
    this.setData({ dyIndex: -1, lnIndex: -1, liuNianList: [], curYear: null });
    this.recompute();
  },

  openPanel: function () {
    var self = this;
    this.setData({ panelOpen: true });
    // 小心机：滚到「外显心性」，让滑标停在面板上方可视区
    wx.createSelectorQuery().select('#sec-tiangan').boundingClientRect().selectViewport().scrollOffset().exec(function (res) {
      var rect = res[0], scroll = res[1];
      if (rect && scroll) {
        wx.pageScrollTo({ scrollTop: scroll.scrollTop + rect.top - 16, duration: 300 });
      }
    });
  },

  closePanel: function () {
    this.setData({ panelOpen: false });
  },

  recompute: function () {
    var dyGZ = null, lnGZ = null, label = '原局 · 未叠加时间阶段';
    var barGz = '', barActive = false;
    if (this.data.dyIndex >= 0) {
      var d = this._dy[this.data.dyIndex];
      dyGZ = d.gz; label = '十年阶段'; barGz = d.gz;
      if (this.data.lnIndex >= 0) {
        var ln = this.data.liuNianList[this.data.lnIndex];
        lnGZ = ln.gz; label += ' · ' + ln.year + ' 年';
        barGz = d.gz + ' · ' + ln.gz; barActive = true;
      }
    }
    var barYearShow = this.data.curYear != null ? this.data.curYear
      : (this._yearMin != null ? Math.min(this._yearMax, Math.max(this._yearMin, new Date().getFullYear())) : '');

    // 当前显示了什么的说明
    var traitNote;
    if (this.data.dyIndex < 0) {
      traitNote = '红蓝气泡是你的原局心性。外显看别人容易看见的样子；内显看更底层的反应惯性。点下方「阶段」挂上时间变化，外显区会多出一组金色气泡，提示当下被引动的心性。';
    } else if (this.data.lnIndex < 0) {
      traitNote = '金色气泡是当前十年阶段叠加出来的外显心性；红蓝原局心性仍在，滑标会随这段时间的状态此消彼长。再点一个年份看具体某年。';
    } else {
      var lnItem = this.data.liuNianList[this.data.lnIndex];
      traitNote = '金色气泡是「' + lnItem.year + ' 年」叠加进来的当年外显心性；红蓝原局心性始终都在，只是各面大小会随当下状态变化。';
    }

    var p = portrait.build(this._chart, { daYunGZ: dyGZ, liuNianGZ: lnGZ });
    this.setData({
      core: p.core,
      paimian: p.paimian,
      list: p.list,
      traitBubbles: p.traitBubbles,
      outerList: p.outerList,
      innerList: p.innerList,
      outerBubbles: p.outerBubbles,
      innerBubbles: p.innerBubbles,
      luckTrait: p.luckTrait,
      branchList: p.branchList,
      relations: p.relations,
      stages: p.stages,
      zhengNow: p.zhengNow, pianNow: p.pianNow,
      hasLuck: p.hasLuck,
      hasTime: p.hasTime,
      curLabel: label,
      traitNote: traitNote,
      barGz: barGz,
      barYearShow: barYearShow,
      barActive: barActive
    });
  },

  noop: function () {}
});
