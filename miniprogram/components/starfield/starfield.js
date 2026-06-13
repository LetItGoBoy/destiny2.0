// 可复用星河展示组件：渲染某时刻太阳系（日心俯瞰），自带缓转与时光流动
var astro = require('../../utils/astro.js');

var BODY_COLOR = {
  太阳: '#FFD27D', 月亮: '#E8E6F0', 地球: '#7FA8F2',
  水星: '#8FD0FF', 金星: '#F2D98A', 火星: '#FF8A70', 木星: '#5ED39A', 土星: '#E0B070'
};
var BODY_SIZE = { 水星: 2.8, 金星: 4.2, 地球: 4.2, 火星: 3.6, 木星: 7.4, 土星: 6.4 };

Component({
  properties: {
    ts: { type: Number, value: 0 },
    flow: { type: Boolean, value: true },
    spin: { type: Boolean, value: true }
  },

  lifetimes: {
    attached: function () {
      this._theta = -0.6;
      this._elev = 0.46;
      this._baseTs = this.data.ts || Date.now();
      this._simTs = this._baseTs;
      this._sky = astro.compute(this._simTs);
      this.initCanvas();
    },
    detached: function () {
      this._stopped = true;
    }
  },

  pageLifetimes: {
    show: function () {
      if (this._canvas && this._stopped) {
        this._stopped = false;
        this.loop();
      }
    },
    hide: function () {
      this._stopped = true;
    }
  },

  methods: {
    initCanvas: function () {
      var that = this;
      this.createSelectorQuery()
        .select('#sf')
        .fields({ node: true, size: true })
        .exec(function (res) {
          if (!res || !res[0] || !res[0].node) return;
          var canvas = res[0].node;
          var dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          var ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);
          that._canvas = canvas;
          that._ctx = ctx;
          that._w = res[0].width;
          that._h = res[0].height;
          that._stars = [];
          for (var i = 0; i < 90; i++) {
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
      // 既不旋转也不流动时，渲染一帧即静止，省电
      if (!this.data.spin && !this.data.flow) return;
      this._canvas.requestAnimationFrame(function () {
        that.loop();
      });
    },

    project: function (x, y, z) {
      var ct = Math.cos(this._theta), st = Math.sin(this._theta);
      var x1 = x * ct - y * st;
      var y1 = x * st + y * ct;
      var ce = Math.cos(this._elev), se = Math.sin(this._elev);
      var sy = y1 * se - z * ce;
      var depth = y1 * ce + z * se;
      var s = 1 - depth / 1400;
      return { x: this._w / 2 + x1 * s, y: this._h / 2 + sy * s, depth: depth, s: s };
    },

    dispR: function (a) {
      var max = Math.min(this._w, this._h * 1.25) / 2 - 14;
      return 20 + (max - 20) * Math.log(1 + a) / Math.log(11);
    },

    render: function () {
      var ctx = this._ctx;
      var w = this._w, h = this._h;
      var now = Date.now();
      var dt = this._lastFrame ? Math.min(now - this._lastFrame, 100) : 16;
      this._lastFrame = now;
      var animate = this.data.spin || this.data.flow;
      if (this.data.spin) this._theta += dt / 1000 * 0.06; // 约 3.4°/秒，缓转
      if (this.data.flow) {
        this._simTs += dt * 86400; // 现实 1 秒 = 命盘 1 天
        this._sky = astro.compute(this._simTs);
      }

      ctx.clearRect(0, 0, w, h);

      // 星点
      for (var i = 0; i < this._stars.length; i++) {
        var stp = this._stars[i];
        ctx.globalAlpha = animate ? (0.4 + 0.4 * Math.sin(now / 900 + stp.p)) : 0.7;
        ctx.fillStyle = '#CFE0FF';
        ctx.beginPath();
        ctx.arc(stp.x, stp.y, stp.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      var bodies = this._sky.bodies;

      // 轨道
      for (var b = 0; b < bodies.length; b++) {
        var rd = this.dispR(bodies[b].a);
        ctx.strokeStyle = 'rgba(150, 170, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var seg = 0; seg <= 64; seg++) {
          var ag = seg / 64 * Math.PI * 2;
          var pt = this.project(Math.cos(ag) * rd, Math.sin(ag) * rd, 0);
          if (seg === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      var draws = [];
      var sun = this.project(0, 0, 0);
      draws.push({ kind: 'sun', name: '太阳', x: sun.x, y: sun.y, depth: sun.depth, size: 11 * sun.s });

      var earthPt = null;
      for (var p = 0; p < bodies.length; p++) {
        var body = bodies[p];
        var rdp = this.dispR(body.a);
        var px = Math.cos(body.angle) * rdp;
        var py = Math.sin(body.angle) * rdp;
        var pz = body.z * rdp * 3;
        var pt2 = this.project(px, py, pz);
        if (body.name === '地球') earthPt = { x: px, y: py, z: pz };
        draws.push({
          kind: 'planet', name: body.name,
          x: pt2.x, y: pt2.y, depth: pt2.depth, size: BODY_SIZE[body.name] * pt2.s
        });
      }

      if (earthPt) {
        var mr = 11;
        var ml = this._sky.moonLon;
        var mpt = this.project(
          earthPt.x + Math.cos(ml) * mr,
          earthPt.y + Math.sin(ml) * mr,
          earthPt.z + Math.sin(this._sky.moonLat) * mr
        );
        draws.push({ kind: 'planet', name: '月亮', x: mpt.x, y: mpt.y, depth: mpt.depth, size: 2.2 * mpt.s });
      }

      draws.sort(function (a, c) { return a.depth - c.depth; });
      for (var d = 0; d < draws.length; d++) {
        var it = draws[d];
        var color = BODY_COLOR[it.name];
        if (it.kind === 'sun') {
          var grad = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, it.size * 3.2);
          grad.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
          grad.addColorStop(0.35, 'rgba(255, 190, 100, 0.32)');
          grad.addColorStop(1, 'rgba(255, 190, 100, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(it.x, it.y, it.size * 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFE9C2';
          ctx.beginPath();
          ctx.arc(it.x, it.y, it.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2);
        ctx.fill();
        if (it.name === '土星') {
          ctx.strokeStyle = 'rgba(224, 176, 112, 0.7)';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.ellipse(it.x, it.y, it.size * 1.9, it.size * 0.7, -0.4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }
});
