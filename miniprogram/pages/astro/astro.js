// 出生星图：出生时刻太阳系 3D 俯瞰（日心系，七政真实相位）
var bazi = require('../../utils/bazi.js');
var astro = require('../../utils/astro.js');
var prefs = require('../../utils/prefs.js');

var BODY_COLOR = {
  太阳: '#FFD27D', 月亮: '#E8E6F0', 地球: '#7FA8F2',
  水星: '#6FB6FF', 金星: '#F0D078', 火星: '#FF8A70', 木星: '#5ECC8F', 土星: '#D9A05B'
};
var BODY_SIZE = { 水星: 3.4, 金星: 5, 地球: 5, 火星: 4.2, 木星: 9, 土星: 7.6 };
var DAY_MS = 86400000;

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

function dateValue(ts) {
  var d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function timeValue(ts) {
  var d = new Date(ts);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function formatViewLabel(ts) {
  var d = new Date(ts);
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function tsFromPicker(dateStr, timeStr) {
  var date = String(dateStr || '').split('-');
  var time = String(timeStr || '12:00').split(':');
  return new Date(
    Number(date[0]),
    Number(date[1]) - 1,
    Number(date[2]),
    Number(time[0]) || 0,
    Number(time[1]) || 0,
    0
  ).getTime();
}

function baZiInputFromTs(ts) {
  var d = new Date(ts);
  return {
    calendar: 'solar',
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes()
  };
}

Page({
  data: {
    loaded: false,
    fs: 'std',
    isNow: false,
    meta: {},
    baZiStr: '',
    baZiView: [],
    list: [],
    selected: null,
    flowing: false,
    paused: false,
    flowLabel: '',
    flowDisplayLabel: '',
    viewDate: '',
    viewTime: '',
    viewLabel: '',
    minDate: '1900-01-01',
    maxDate: '2100-12-31'
  },

  onLoad: function (options) {
    this.setData({ fs: prefs.getFontSize() });

    // 此刻星象模式（首页进入，无出生数据）
    if (options.now) {
      this._birthTs = Date.now();
      this._simTs = this._birthTs;
      this._sky = astro.compute(this._birthTs);
      this.setData(Object.assign({
        loaded: true,
        isNow: true,
        meta: {
          name: '此刻星象',
          genderText: '',
          lunarShort: '',
          chartStr: formatViewLabel(this._birthTs)
        },
        baZiStr: ''
      }, this.buildViewPatch(this._birthTs)));
      this._theta = -0.6;
      this._elev = 0.42;
      this._lastTouchAt = 0;
      this._screenPos = [];
      this.initCanvas();
      return;
    }

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
    try {
      chart = bazi.computeChart(input);
    } catch (e) {
      wx.showToast({ title: '排盘失败', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this._birthTs = chart.meta.timestamp;
    this._simTs = this._birthTs;
    this._sky = astro.compute(this._birthTs);

    this.setData({
      loaded: true,
      meta: chart.meta,
      list: this._sky.list,
      baZiStr: chart.pillars.map(function (p) { return p.ganZhi; }).join('　'),
      baZiView: bazi.colorizeBaZi(chart.pillars.map(function (p) { return p.ganZhi; }).join(' ')),
      viewDate: dateValue(this._birthTs),
      viewTime: timeValue(this._birthTs),
      viewLabel: formatViewLabel(this._birthTs)
    });

    // 相机与交互状态
    this._theta = -0.6;
    this._elev = 0.42;
    this._lastTouchAt = 0;
    this._screenPos = [];
    this.initCanvas();
  },

  onUnload: function () {
    this._stopped = true;
  },
  onHide: function () {
    this._stopped = true;
  },
  onShow: function () {
    if (this._canvas && this._stopped) {
      this._stopped = false;
      this.loop();
    }
  },

  buildViewPatch: function (ts) {
    var baZiStr = '';
    var baZiView = [];
    try {
      baZiStr = bazi.quickBaZi(baZiInputFromTs(ts)).baZi;
      baZiView = bazi.colorizeBaZi(baZiStr);
    } catch (e) { /* keep empty */ }
    return {
      list: this._sky ? this._sky.list : [],
      baZiStr: baZiStr.replace(/ /g, '　'),
      baZiView: baZiView,
      viewDate: dateValue(ts),
      viewTime: timeValue(ts),
      viewLabel: formatViewLabel(ts)
    };
  },

  buildFlowLabel: function (ts) {
    var days = Math.round((ts - this._birthTs) / DAY_MS);
    var absDays = Math.abs(days);
    var span = absDays >= 365 ? (absDays / 365.25).toFixed(1) + ' 年' : absDays + ' 天';
    var prefix = this.data.isNow ? '起点后 ' : (days >= 0 ? '出生后 ' : '出生前 ');
    return formatViewLabel(ts) + ' · ' + prefix + span;
  },

  buildFlowDisplayLabel: function (ts, paused) {
    var label = this.buildFlowLabel(ts);
    return paused ? '已暂停 · ' + label : label;
  },

  setSkyTime: function (ts, extra) {
    this._simTs = ts;
    this._sky = astro.compute(ts);
    var patch = this.buildViewPatch(ts);
    if (extra) {
      for (var k in extra) patch[k] = extra[k];
    }
    this.setData(patch);
  },

  initCanvas: function () {
    var that = this;
    wx.createSelectorQuery().in(this)
      .select('#sky')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0]) return;
        var canvas = res[0].node;
        var dpr = wx.getWindowInfo().pixelRatio || 2;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        that._canvas = canvas;
        that._ctx = ctx;
        that._w = res[0].width;
        that._h = res[0].height;
        // 星空背景点
        that._stars = [];
        for (var i = 0; i < 110; i++) {
          that._stars.push({
            x: Math.random() * that._w,
            y: Math.random() * that._h,
            r: Math.random() * 1.1 + 0.3,
            p: Math.random() * Math.PI * 2
          });
        }
        that._stopped = false;
        that.loop();
      });
  },

  loop: function () {
    var that = this;
    if (this._stopped || !this._canvas) return;
    this.render();
    this._canvas.requestAnimationFrame(function () {
      that.loop();
    });
  },

  // 世界坐标 → 屏幕（方位角旋转 + 仰角投影）
  project: function (x, y, z) {
    var ct = Math.cos(this._theta), st = Math.sin(this._theta);
    var x1 = x * ct - y * st;
    var y1 = x * st + y * ct;
    var ce = Math.cos(this._elev), se = Math.sin(this._elev);
    var sy = y1 * se - z * ce;
    var depth = y1 * ce + z * se;
    var s = 1 - depth / 1400; // 轻透视
    return {
      x: this._w / 2 + x1 * s,
      y: this._h / 2 - 14 + sy * s,
      depth: depth,
      s: s
    };
  },

  // 日距 AU → 画布半径（对数压缩，内行星不挤在一起）
  dispR: function (a) {
    var max = Math.min(this._w, this._h * 1.18) / 2 - 18;
    return 26 + (max - 26) * Math.log(1 + a) / Math.log(11);
  },

  render: function () {
    var ctx = this._ctx;
    var w = this._w, h = this._h;
    var now = Date.now();
    // 默认静止：视角与星体均不动，仅手动拖动或时光流动时改变

    // 时光流动：行星按真实角速度运行（每帧约 1/3 天）
    if (this.data.flowing && !this.data.paused) {
      this._simTs += 0.34 * DAY_MS;
      this._sky = astro.compute(this._simTs);
      this._flowFrame = (this._flowFrame || 0) + 1;
      if (this._flowFrame % 12 === 1) {
        var patch = this.buildViewPatch(this._simTs);
        patch.flowLabel = this.buildFlowLabel(this._simTs);
        patch.flowDisplayLabel = patch.flowLabel;
        this.setData(patch);
      }
    }

    ctx.clearRect(0, 0, w, h);

    // 星空
    for (var i = 0; i < this._stars.length; i++) {
      var st = this._stars[i];
      var tw = 0.45 + 0.4 * Math.sin(now / 900 + st.p);
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#CFC6EE';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var bodies = this._sky.bodies;
    var draws = [];
    this._screenPos = [];

    // 轨道线
    for (var b = 0; b < bodies.length; b++) {
      var rd = this.dispR(bodies[b].a);
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var seg = 0; seg <= 72; seg++) {
        var ag = seg / 72 * Math.PI * 2;
        var pt = this.project(Math.cos(ag) * rd, Math.sin(ag) * rd, 0);
        if (seg === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    // 太阳（中心）
    var sun = this.project(0, 0, 0);
    draws.push({ kind: 'sun', name: '太阳', x: sun.x, y: sun.y, depth: sun.depth, size: 13 * sun.s });
    this._screenPos.push({ name: '太阳', x: sun.x, y: sun.y });

    // 行星
    var earthPt = null;
    for (var p = 0; p < bodies.length; p++) {
      var body = bodies[p];
      var rdp = this.dispR(body.a);
      var px = Math.cos(body.angle) * rdp;
      var py = Math.sin(body.angle) * rdp;
      var pz = body.z * rdp * 3; // 倾角视觉放大
      var pt2 = this.project(px, py, pz);
      if (body.name === '地球') earthPt = { x: px, y: py, z: pz };
      draws.push({
        kind: 'planet', name: body.name, ancient: body.ancient, wx: body.wx,
        x: pt2.x, y: pt2.y, depth: pt2.depth, size: BODY_SIZE[body.name] * pt2.s
      });
      this._screenPos.push({ name: body.name, x: pt2.x, y: pt2.y });
    }

    // 月亮（绕地球，按真实地心黄经定相位）
    if (earthPt) {
      var mr = 13;
      var ml = this._sky.moonLon;
      var mpt = this.project(
        earthPt.x + Math.cos(ml) * mr,
        earthPt.y + Math.sin(ml) * mr,
        earthPt.z + Math.sin(this._sky.moonLat) * mr
      );
      draws.push({ kind: 'planet', name: '月亮', ancient: '月', wx: '', x: mpt.x, y: mpt.y, depth: mpt.depth, size: 2.6 * mpt.s });
      this._screenPos.push({ name: '月亮', x: mpt.x, y: mpt.y });
    }

    // 画家算法：远的先画
    draws.sort(function (a, b) { return a.depth - b.depth; });
    for (var d = 0; d < draws.length; d++) {
      var it = draws[d];
      var color = BODY_COLOR[it.name];
      if (it.kind === 'sun') {
        var grad = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, it.size * 3);
        grad.addColorStop(0, 'rgba(255, 210, 125, 0.95)');
        grad.addColorStop(0.35, 'rgba(255, 190, 100, 0.35)');
        grad.addColorStop(1, 'rgba(255, 190, 100, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.size * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFE3AE';
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.size * 0.62, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // 行星光晕 + 本体
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.size * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2);
      ctx.fill();
      // 土星环
      if (it.name === '土星') {
        ctx.strokeStyle = 'rgba(217, 160, 91, 0.7)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(it.x, it.y, it.size * 1.9, it.size * 0.7, -0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 标签
      if (it.name !== '月亮') {
        ctx.fillStyle = 'rgba(241, 237, 251, 0.82)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        var label = it.name;
        ctx.fillText(label, it.x, it.y + it.size + 13);
      }
    }
  },

  onTouchStart: function (e) {
    this._lastTouchAt = Date.now();
    if (e.touches.length === 1) {
      this._tx = e.touches[0].x;
      this._ty = e.touches[0].y;
      this._moved = false;
    }
  },

  onTouchMove: function (e) {
    this._lastTouchAt = Date.now();
    if (e.touches.length !== 1) return;
    var dx = e.touches[0].x - this._tx;
    var dy = e.touches[0].y - this._ty;
    if (Math.abs(dx) + Math.abs(dy) > 3) this._moved = true;
    this._theta += dx * 0.008;
    this._elev = Math.min(1.45, Math.max(0.08, this._elev + dy * 0.005));
    this._tx = e.touches[0].x;
    this._ty = e.touches[0].y;
  },

  onTouchEnd: function (e) {
    this._lastTouchAt = Date.now();
    if (this._moved || !e.changedTouches.length) return;
    // 时光流动中星体位置随时间变化，不响应点选；暂停后可查看当前位置。
    if (this.data.flowing && !this.data.paused) return;
    // 点选星体
    var x = e.changedTouches[0].x;
    var y = e.changedTouches[0].y;
    var best = null;
    var bestD = 30;
    for (var i = 0; i < this._screenPos.length; i++) {
      var sp = this._screenPos[i];
      var d = Math.sqrt((sp.x - x) * (sp.x - x) + (sp.y - y) * (sp.y - y));
      if (d < bestD) { bestD = d; best = sp.name; }
    }
    if (!best) {
      this.setData({ selected: null });
      return;
    }
    if (best === '地球') {
      this.setData({ selected: { name: '地球', ancient: '坤舆', desc: '所选时刻，我们在这里。', cls: '' } });
      return;
    }
    var hit = null;
    for (var j = 0; j < this.data.list.length; j++) {
      if (this.data.list[j].name === best) { hit = this.data.list[j]; break; }
    }
    if (hit) {
      this.setData({
        selected: {
          name: hit.name,
          ancient: hit.ancient,
          cls: hit.cls,
          desc: '古称「' + hit.ancient + '」' + (hit.wx !== '阳' && hit.wx !== '阴' ? '，五行属' + hit.wx : '') +
            '。所选时刻位于黄经 ' + hit.lonText + '（' + hit.zodiac + '方位）。'
        }
      });
    }
  },

  closeSelected: function () {
    this.setData({ selected: null });
  },

  onDateChange: function (e) {
    this.applyPickerTime(e.detail.value, this.data.viewTime);
  },

  onTimeChange: function (e) {
    this.applyPickerTime(this.data.viewDate, e.detail.value);
  },

  applyPickerTime: function (dateStr, timeStr) {
    var ts = tsFromPicker(dateStr, timeStr);
    if (isNaN(ts)) {
      wx.showToast({ title: '时间格式有误', icon: 'none' });
      return;
    }
    this._flowFrame = 0;
    this.setSkyTime(ts, {
      flowing: false,
      paused: false,
      flowLabel: '',
      flowDisplayLabel: '',
      selected: null
    });
  },

  // 时光流动开关：开始、暂停、继续都停留在当前星象时刻。
  toggleFlow: function () {
    if (!this.data.flowing) {
      this._flowFrame = 0;
      this.setData({
        flowing: true,
        paused: false,
        selected: null,
        flowLabel: this.buildFlowLabel(this._simTs),
        flowDisplayLabel: this.buildFlowDisplayLabel(this._simTs, false)
      });
      return;
    }
    var nextPaused = !this.data.paused;
    this.setData({
      paused: nextPaused,
      flowLabel: this.buildFlowLabel(this._simTs),
      flowDisplayLabel: this.buildFlowDisplayLabel(this._simTs, nextPaused)
    });
  },

  resetTime: function () {
    var ts = this.data.isNow ? Date.now() : this._birthTs;
    if (this.data.isNow) this._birthTs = ts;
    this._flowFrame = 0;
    this.setSkyTime(ts, {
      flowing: false,
      paused: false,
      flowLabel: '',
      flowDisplayLabel: '',
      selected: null
    });
  },

  onShareAppMessage: function () {
    return { title: '此刻星象 · 日月五星的真实位置', path: '/pages/astro/astro?now=1' };
  },

  onShareTimeline: function () {
    return { title: '此刻星象 · 日月五星的真实位置', query: 'now=1' };
  }
});
