var bazi = require('../../utils/bazi.js');
var store = require('../../utils/store.js');
var baike = require('../../utils/baike.js');
var prefs = require('../../utils/prefs.js');
var energy = require('../../utils/analyze/energy.js');

// ── 十神单字简写（岁运密集格用） ──
var GAN_WX_I = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 2, 庚: 3, 辛: 3, 壬: 4, 癸: 4 };
var GAN_YIN = { 甲: 0, 乙: 1, 丙: 0, 丁: 1, 戊: 0, 己: 1, 庚: 0, 辛: 1, 壬: 0, 癸: 1 };
var BENQI = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
function shiShenAbbr(dg, g) {
  if (!dg || !g || GAN_WX_I[g] == null) return '';
  var di = GAN_WX_I[dg], gi = GAN_WX_I[g], same = GAN_YIN[dg] === GAN_YIN[g];
  if (gi === di) return same ? '比' : '劫';
  if (gi === (di + 1) % 5) return same ? '食' : '伤';
  if (gi === (di + 2) % 5) return same ? '才' : '财';
  if (gi === (di + 3) % 5) return same ? '杀' : '官';
  return same ? '枭' : '印';
}

// ── 刑冲合害会破：某地支 vs 原局地支 ──
var R_HE = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
var R_CHONG = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
var R_HAI = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']];
var R_PO = [['子', '酉'], ['午', '卯'], ['巳', '申'], ['寅', '亥'], ['辰', '丑'], ['戌', '未']];
var R_XING = [['寅', '巳'], ['巳', '申'], ['丑', '戌'], ['戌', '未'], ['子', '卯']];
var R_ZIXING = { 辰: 1, 午: 1, 酉: 1, 亥: 1 };
var R_HUI = [['寅', '卯', '辰'], ['巳', '午', '未'], ['申', '酉', '戌'], ['亥', '子', '丑']];
function rpair(l, a, b) {
  for (var i = 0; i < l.length; i++) {
    if ((l[i][0] === a && l[i][1] === b) || (l[i][0] === b && l[i][1] === a)) return true;
  }
  return false;
}
function relsOf(br, natal) {
  if (!br) return [];
  var s = {};
  for (var i = 0; i < natal.length; i++) {
    var b = natal[i];
    if (rpair(R_HE, br, b)) s['合'] = 1;
    if (rpair(R_CHONG, br, b)) s['冲'] = 1;
    if (rpair(R_HAI, br, b)) s['害'] = 1;
    if (rpair(R_XING, br, b)) s['刑'] = 1;
    if (br === b && R_ZIXING[br]) s['刑'] = 1;
    if (rpair(R_PO, br, b)) s['破'] = 1;
  }
  for (var h = 0; h < R_HUI.length; h++) {
    var grp = R_HUI[h];
    if (grp.indexOf(br) >= 0) {
      var ok = true;
      for (var k = 0; k < grp.length; k++) {
        if (grp[k] !== br && natal.indexOf(grp[k]) < 0) ok = false;
      }
      if (ok) s['会'] = 1;
    }
  }
  var order = ['合', '会', '冲', '刑', '害', '破'];
  var clsMap = { 合: 'he', 会: 'hui', 冲: 'chong', 刑: 'xing', 害: 'hai', 破: 'po' };
  var out = [];
  for (var o = 0; o < order.length; o++) if (s[order[o]]) out.push({ t: order[o], cls: clsMap[order[o]] });
  return out;
}

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
    liuYueBar: [],
    lyIndex: -1,
    liuRiBar: [],
    lrIndex: -1,
    termCard: null,
    baZiStr: '',
    fs: 'std',
    showSubRows: false,
    // 能量盘
    qMode: 'fill',
    qDaYunList: [],
    qLiuNianList: [],
    qDyIndex: -1,
    qLnIndex: -1,
    qGanCells: [],
    qZhiCells: [],
    qpBase: 50,
    qpNow: 50,
    qHasLuck: false,
    qCurLabel: '原局 · 无岁运'
  },

  onToggleSubRows: function () {
    this.setData({ showSubRows: !this.data.showSubRows });
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
    this._ctx = chart.ctx;
    this._dayGan = chart.meta.dayGan;
    this._natal = chart.pillars.filter(function (p) { return !p.empty && p.zhi; })
      .map(function (p) { return p.zhi.text; });

    // 能量盘大运列表（去童限）
    this._qDy = (chart.daYun || []).filter(function (d) {
      return d.ganZhi && !d.isQian;
    }).map(function (d, i) {
      return {
        index: i, gz: d.ganZhi, gan: d.gan, zhi: d.zhi,
        god: d.shiShenGan, age: d.startAge + '–' + d.endAge,
        _liuNian: d.liuNian || []
      };
    });
    this.setData({ qDaYunList: this._qDy });

    // 大运横条（密集格：干支 + 十神简写 + 刑冲合害会破）
    var dayGan = this._dayGan, natal = this._natal;
    var daYunBar = chart.daYun.map(function (d) {
      var o = {
        index: d.index,
        isQian: d.isQian,
        ganZhi: d.ganZhi,
        gan: d.gan,
        zhi: d.zhi,
        shiShenGan: d.shiShenGan
      };
      if (!d.isQian && d.gan && d.zhi) {
        o.ganAbbr = shiShenAbbr(dayGan, d.gan.text);
        o.zhiAbbr = shiShenAbbr(dayGan, BENQI[d.zhi.text]);
        o.rels = relsOf(d.zhi.text, natal);
      }
      return o;
    });

    this.setData({
      loaded: true,
      fromRecord: options.from === 'record',
      saved: options.from === 'record',
      meta: chart.meta,
      wuXing: chart.wuXing,
      daYunBar: daYunBar,
      // 长辈模式(特大字)默认收起副行；普通密度默认展开
      showSubRows: this.data.fs !== 'xl',
      baZiStr: chart.pillars.map(function (p) { return p.empty ? '时柱未知' : p.ganZhi; }).join('　')
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
    var tab = e.currentTarget.dataset.tab;
    this.setData({ tab: tab });
    this.updateTable();
    if (tab === 'energy' && !this._qInit) {
      this._qInit = true;
      this.qRecompute();
    }
  },

  // ── 能量盘 ──
  onQMode: function (e) {
    this.setData({ qMode: e.currentTarget.dataset.mode });
    this.qRecompute();
  },

  onQDaYun: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    if (idx === this.data.qDyIndex) {
      this.setData({ qDyIndex: -1, qLnIndex: -1, qLiuNianList: [] });
      this.qRecompute();
      return;
    }
    var d = this._qDy[idx];
    var ln = (d._liuNian || []).map(function (x, i) {
      return { index: i, gz: x.ganZhi, gan: x.gan, zhi: x.zhi, god: x.shiShenGan, year: x.year };
    });
    this.setData({ qDyIndex: idx, qLnIndex: -1, qLiuNianList: ln });
    this.qRecompute();
  },

  onQLiuNian: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    this.setData({ qLnIndex: idx === this.data.qLnIndex ? -1 : idx });
    this.qRecompute();
  },

  qRecompute: function () {
    var dyGZ = null, lnGZ = null, label = '原局 · 无岁运';
    if (this.data.qDyIndex >= 0) {
      var d = this._qDy[this.data.qDyIndex];
      dyGZ = d.gz; label = '大运 ' + d.gz;
      if (this.data.qLnIndex >= 0) {
        var ln = this.data.qLiuNianList[this.data.qLnIndex];
        lnGZ = ln.gz; label += ' · 流年 ' + ln.gz + '（' + ln.year + '）';
      }
    }
    var m = energy.build(this._chart, { daYunGZ: dyGZ, liuNianGZ: lnGZ });
    var maxRef = m.maxRef;
    var deco = function (c) {
      var r = Math.min(1, c.val / maxRef);
      c.fill = Math.round(8 + r * 92);
      c.fs = Math.round(40 + r * 54);
      return c;
    };
    this.setData({
      qGanCells: m.ganCells.map(deco),
      qZhiCells: m.zhiCells.map(deco),
      qpBase: m.pBase, qpNow: m.pNow,
      qHasLuck: m.hasLuck, qCurLabel: label
    });
  },

  onDaYunTap: function (e) {
    this.selectDaYun(Number(e.currentTarget.dataset.index));
  },

  selectDaYun: function (index) {
    var dy = this._chart.daYun[index];
    if (!dy) return;
    var dayGan = this._dayGan, natal = this._natal;
    var liuNianBar = dy.liuNian.map(function (n) {
      return {
        index: n.index, year: n.year, age: n.age,
        ganZhi: n.ganZhi, gan: n.gan, zhi: n.zhi, shiShenGan: n.shiShenGan,
        ganAbbr: shiShenAbbr(dayGan, n.gan.text),
        zhiAbbr: shiShenAbbr(dayGan, BENQI[n.zhi.text]),
        rels: relsOf(n.zhi.text, natal)
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
    // 流月横条（与流年同样式）
    var dayGan = this._dayGan, natal = this._natal;
    var liuYueBar = (ln.liuYue || []).map(function (m, i) {
      return {
        index: i, name: m.name, ganZhi: m.ganZhi, gan: m.gan, zhi: m.zhi, shiShenGan: m.shiShenGan,
        ganAbbr: shiShenAbbr(dayGan, m.gan.text),
        zhiAbbr: shiShenAbbr(dayGan, BENQI[m.zhi.text]),
        rels: relsOf(m.zhi.text, natal)
      };
    });
    this._lnYear = ln.year;
    this.setData({
      lnIndex: lnIndex,
      liuYueBar: liuYueBar,
      lyIndex: -1,        // 默认不挂流月柱
      liuRiBar: [],
      lrIndex: -1
    });
    this.updateTable();
  },

  // 流月：点选生成流月柱，并展开该月流日
  onLiuYueTap: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    if (idx === this.data.lyIndex) {
      this.setData({ lyIndex: -1, liuRiBar: [], lrIndex: -1 });
      this.updateTable();
      return;
    }
    var ly = this.data.liuYueBar[idx];
    var dayGan = this._dayGan, natal = this._natal;
    var liuRiBar = bazi.getLiuRi(this._ctx, ly.ganZhi, this._lnYear).map(function (r) {
      r.ganAbbr = shiShenAbbr(dayGan, r.gan.text);
      r.zhiAbbr = shiShenAbbr(dayGan, BENQI[r.zhi.text]);
      r.rels = relsOf(r.zhi.text, natal);
      return r;
    });
    this.setData({ lyIndex: idx, liuRiBar: liuRiBar, lrIndex: -1 });
    this.updateTable();
  },

  // 流日：点选生成流日柱
  onLiuRiTap: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    this.setData({ lrIndex: idx === this.data.lrIndex ? -1 : idx });
    this.updateTable();
  },

  // 基础盘 = 四柱；详盘 = 岁运柱 + 四柱
  // 列序（左→右）：流日 · 流月 · 流年 · 大运 · 年 · 月 · 日 · 时（默认只挂大运+流年）
  updateTable: function () {
    var pillars = this._chart.pillars.slice(0);
    if (this.data.tab === 'detail') {
      var extras = [];
      var dy = this._chart.daYun[this.data.dyIndex];

      // 流日（最左）
      if (this.data.lrIndex >= 0 && this.data.liuRiBar[this.data.lrIndex]) {
        var lr = this.data.liuRiBar[this.data.lrIndex];
        var lrCol = bazi.buildLuckPillar(this._ctx, lr.ganZhi);
        if (lrCol) { lrCol.label = '流日'; lrCol.sub = lr.label; lrCol.extra = true; extras.push(lrCol); }
      }
      // 流月
      if (this.data.lyIndex >= 0 && this.data.liuYueBar[this.data.lyIndex]) {
        var ly = this.data.liuYueBar[this.data.lyIndex];
        var lyCol = bazi.buildLuckPillar(this._ctx, ly.ganZhi);
        if (lyCol) { lyCol.label = '流月'; lyCol.sub = ly.name; lyCol.extra = true; extras.push(lyCol); }
      }
      // 流年
      if (dy) {
        var ln = dy.liuNian[this.data.lnIndex];
        if (ln) extras.push(this.extraColumn(ln, '流年', ''));
        // 大运（贴近八字）
        if (dy.isQian) {
          extras.push({ label: '大运', empty: true });
        } else {
          extras.push(this.extraColumn(dy, '大运', ''));
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

  // 性格画像：天干外显心性构成（随大运流年此消彼长）
  onXiangPi: function () {
    wx.navigateTo({
      url: '/pages/portrait/portrait?input=' + encodeURIComponent(JSON.stringify(this._input))
    });
  },

  // 出生星图
  goAstro: function () {
    wx.navigateTo({
      url: '/pages/astro/astro?input=' + encodeURIComponent(JSON.stringify(this._input))
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
      unknownTime: !!input.unknownTime,
      baZi: chart.pillars.filter(function (p) { return !p.empty; }).map(function (p) { return p.ganZhi; }).join(' '),
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
      title: (meta.name || '八字') + ' · ' + this._chart.pillars.filter(function (p) { return !p.empty; }).map(function (p) { return p.ganZhi; }).join(' '),
      path: '/pages/result/result?input=' + encodeURIComponent(JSON.stringify(this._input))
    };
  }
});
