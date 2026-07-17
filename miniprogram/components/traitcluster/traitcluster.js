// 心性气泡星团：所有来源聚成一团；颜色表达词性，大小表达能量，可拖动。
var PRO = { fill: '#F7DCD9', line: '#E6A89F', text: '#B23A2E' }; // 力量（淡红）
var NEU = { fill: '#F3E8C9', line: '#D8C38E', text: '#78623A' }; // 本色（淡金）
var CON = { fill: '#DCE8F7', line: '#9CBEE6', text: '#2C6BB0' }; // 留意（淡蓝）

Component({
  properties: {
    bubbles: { type: Array, value: [] },  // 每个泡泡自带 lean(由算法算出的滑标位置)
    refreshKey: { type: String, value: '' }
  },
  data: {
    dragging: false
  },

  lifetimes: {
    attached: function () { this.initCanvas(); },
    detached: function () {
      this._stopped = true;
      this._running = false;
    }
  },

  observers: {
    'bubbles': function () {
      this.refreshCluster();
    },
    'refreshKey': function () {
      this.refreshCluster();
    }
  },

  methods: {
    refreshCluster: function () {
      if (!this._ready) return;
      this.build();
      this.startLoop();
    },

    initCanvas: function () {
      var that = this;
      this.createSelectorQuery()
        .select('#tc')
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
          that._ready = true;
          that._stopped = false;
          that.build();
          that.startLoop();
        });
    },

    build: function () {
      var W = this._w, H = this._h;
      var items = this.data.bubbles || [];
      var that = this;
      // 每次换命盘、年龄段或年份都清空旧节点，避免病重词残留到下一组星团。
      this._nodes = [];
      if (this._ctx) this._ctx.clearRect(0, 0, W, H);
      this._nodes = items.map(function (it, i) {
        var a = (i / Math.max(1, items.length)) * 6.28;
        var spread = Math.min(W, H) * 0.20;
        return {
          label: it.label,
          kind: it.kind,
          w: it.w || 0.6,
          lean: it.lean == null ? 0.5 : it.lean,
          fromYear: !!it.fromYear,
          pal: it.kind === 'con' ? CON : (it.kind === 'neu' ? NEU : PRO),
          r: that.targetR(it.kind, it.w || 0.6, it.lean == null ? 0.5 : it.lean),
          x: W / 2 + Math.cos(a) * spread,
          y: H / 2 + Math.sin(a) * spread,
          vx: 0, vy: 0
        };
      });
      this._settledFrames = 0;
    },

    // 来源能量决定基础大小；滑标只对力量与留意做轻量增减，本色词保持基础大小。
    targetR: function (kind, w, lean) {
      var energy = Math.max(0.32, Math.min(1, w || 0.6));
      var normalized = (energy - 0.32) / 0.68;
      var baseR = 18 + normalized * 14;
      var tilt = (Math.max(0.25, Math.min(0.75, lean == null ? 0.5 : lean)) - 0.5) * 0.7;
      var factor = kind === 'con' ? 1 + tilt : (kind === 'pro' ? 1 - tilt : 1);
      return Math.max(17, Math.min(38, baseR * factor));
    },

    startLoop: function () {
      if (this._stopped || this._running || !this._canvas) return;
      this._running = true;
      this._settledFrames = 0;
      this.loop();
    },

    loop: function () {
      if (this._stopped || !this._canvas) {
        this._running = false;
        return;
      }
      var motion = this.physics();
      this.draw();
      this._settledFrames = motion < 0.08 && !this._drag ? this._settledFrames + 1 : 0;
      if (this._settledFrames >= 20) {
        this._running = false;
        return;
      }
      var that = this;
      this._canvas.requestAnimationFrame(function () { that.loop(); });
    },

    physics: function () {
      var W = this._w, H = this._h, ns = this._nodes || [];
      var cx = W / 2, cy = H / 2;
      var motion = 0;
      for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        var tr = this.targetR(n.kind, n.w, n.lean);
        n.r += (tr - n.r) * 0.12;        // 平滑涨缩
        if (n.fix) continue;
        n.vx += (cx - n.x) * 0.006;
        n.vy += (cy - n.y) * 0.006;
        n.vx *= 0.84; n.vy *= 0.84;
        n.x += n.vx; n.y += n.vy;
        motion = Math.max(motion, Math.abs(n.vx) + Math.abs(n.vy) + Math.abs(tr - n.r));
      }
      for (var it = 0; it < 10; it++) {
        for (var a = 0; a < ns.length; a++) {
          for (var b = a + 1; b < ns.length; b++) {
            var p = ns[a], q = ns[b];
            var dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
            var min = this.collisionR(p) + this.collisionR(q);
            if (d < min) {
              var ov = min - d, ux = dx / d, uy = dy / d;
              motion = Math.max(motion, ov);
              if (p.fix) { q.x += ux * ov; q.y += uy * ov; }
              else if (q.fix) { p.x -= ux * ov; p.y -= uy * ov; }
              else { p.x -= ux * ov / 2; p.y -= uy * ov / 2; q.x += ux * ov / 2; q.y += uy * ov / 2; }
            }
          }
        }
        for (var k = 0; k < ns.length; k++) {
          var m = ns[k];
          if (m.fix) continue;
          var mr = this.collisionR(m);
          if (m.x < mr) m.x = mr; if (m.x > W - mr) m.x = W - mr;
          if (m.y < mr) m.y = mr; if (m.y > H - mr) m.y = H - mr;
        }
      }
      return motion;
    },

    collisionR: function (node) {
      return node.fromYear ? node.r * 1.1 : node.r;
    },

    bubblePath: function (ctx, node) {
      if (!node.fromYear) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, 6.28);
        return;
      }
      var half = node.r * 0.86;
      var corner = Math.max(6, node.r * 0.32);
      var left = node.x - half, right = node.x + half;
      var top = node.y - half, bottom = node.y + half;
      ctx.beginPath();
      ctx.moveTo(left + corner, top);
      ctx.lineTo(right - corner, top);
      ctx.quadraticCurveTo(right, top, right, top + corner);
      ctx.lineTo(right, bottom - corner);
      ctx.quadraticCurveTo(right, bottom, right - corner, bottom);
      ctx.lineTo(left + corner, bottom);
      ctx.quadraticCurveTo(left, bottom, left, bottom - corner);
      ctx.lineTo(left, top + corner);
      ctx.quadraticCurveTo(left, top, left + corner, top);
      ctx.closePath();
    },

    draw: function () {
      var ctx = this._ctx, ns = this._nodes || [];
      ctx.clearRect(0, 0, this._w, this._h);
      for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        ctx.fillStyle = n.pal.fill;
        this.bubblePath(ctx, n); ctx.fill();
        ctx.strokeStyle = n.pal.line; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = n.pal.text;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var L = n.label.length;
        if (L <= 3) {
          ctx.font = '700 ' + Math.max(11, Math.min(16, n.r * (L <= 2 ? 0.52 : 0.42))) + 'px sans-serif';
          ctx.fillText(n.label, n.x, n.y);
        } else {
          var fs = Math.max(10, n.r * 0.42);
          ctx.font = '700 ' + fs + 'px sans-serif';
          ctx.fillText(n.label.slice(0, 2), n.x, n.y - fs * 0.55);
          ctx.fillText(n.label.slice(2), n.x, n.y + fs * 0.55);
        }
      }
    },

    pick: function (x, y) {
      var ns = this._nodes || [];
      for (var i = ns.length - 1; i >= 0; i--) {
        var n = ns[i];
        if (Math.hypot(n.x - x, n.y - y) < this.collisionR(n)) return n;
      }
      return null;
    },
    onTouchStart: function (e) {
      var t = e.touches[0]; if (!t) return;
      this._drag = this.pick(t.x, t.y);
      if (this._drag) {
        this._drag.fix = true;
        this.startLoop();
        if (!this.data.dragging) this.setData({ dragging: true });
      } else if (this.data.dragging) {
        this.setData({ dragging: false });
      }
    },
    onTouchMove: function (e) {
      if (!this._drag) return;
      var t = e.touches[0]; if (!t) return;
      this._drag.x = t.x; this._drag.y = t.y; this._drag.vx = 0; this._drag.vy = 0;
      this.startLoop();
    },
    onTouchEnd: function () {
      if (this._drag) { this._drag.fix = false; this._drag = null; }
      if (this.data.dragging) this.setData({ dragging: false });
      this.startLoop();
    }
  }
});
