// 出生星图：出生时刻太阳系 3D 俯瞰（日心系，七政真实相位）
var bazi = require('../../utils/bazi.js');
var astro = require('../../utils/astro.js');
var prefs = require('../../utils/prefs.js');

var BODY_COLOR = {
  太阳: '#FFD27D', 月亮: '#E8E6F0', 地球: '#7FA8F2',
  水星: '#6FB6FF', 金星: '#F0D078', 火星: '#FF8A70', 木星: '#5ECC8F', 土星: '#D9A05B'
};
var BODY_SIZE = { 水星: 3.4, 金星: 5, 地球: 5, 火星: 4.2, 木星: 9, 土星: 7.6 };

Page({
  data: {
    loaded: false,
    fs: 'std',
    meta: {},
    baZiStr: '',
    list: [],
    selected: null,
    flowing: false,
    flowLabel: ''
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
      baZiStr: chart.pillars.map(function (p) { return p.ganZhi; }).join('　'),
      list: this._sky.list
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
    // 闲置 4 秒后缓慢自转（仅相机视角，星体位置不变）
    if (now - this._lastTouchAt > 4000) this._theta += 0.0022;

    // 时光流动：行星按真实角速度运行（每帧约 1/3 天）
    if (this.data.flowing) {
      this._simTs += 0.34 * 86400000;
      this._sky = astro.compute(this._simTs);
      this._flowFrame = (this._flowFrame || 0) + 1;
      if (this._flowFrame % 12 === 1) {
        var d = new Date(this._simTs);
        var days = Math.round((this._simTs - this._birthTs) / 86400000);
        var span = days >= 365 ? (days / 365.25).toFixed(1) + ' 年' : days + ' 天';
        this.setData({
          flowLabel: d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 出生后 ' + span
        });
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
        var label = it.wx ? it.name + '·' + it.wx : it.name;
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
    // 时光流动中星体位置随时间变化，与出生数据不对应，不响应点选
    if (this.data.flowing) return;
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
      this.setData({ selected: { name: '地球', ancient: '坤舆', desc: '出生那一刻，我们在这里。', cls: '' } });
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
            '。出生时位于黄经 ' + hit.lonText + '（' + hit.zodiac + '方位）。'
        }
      });
    }
  },

  closeSelected: function () {
    this.setData({ selected: null });
  },

  // 时光流动开关：开启后行星按真实角速度运行；关闭即回到出生时刻
  toggleFlow: function () {
    if (this.data.flowing) {
      this._simTs = this._birthTs;
      this._sky = astro.compute(this._birthTs);
      this.setData({ flowing: false, flowLabel: '' });
    } else {
      this._flowFrame = 0;
      this.setData({ flowing: true, selected: null });
    }
  }
});
