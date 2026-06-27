// 心性气泡星团：优点(含中性)聚上团、缺点聚下团；淡底实心圆，贴合不重叠，可拖动。
var PRO = { fill: '#DCE8F7', line: '#9CBEE6', text: '#2C6BB0' }; // 优 / 中（淡蓝）
var CON = { fill: '#F7DCD9', line: '#E6A89F', text: '#B23A2E' }; // 缺（淡红）

Component({
  properties: {
    bubbles: { type: Array, value: [] }
  },

  lifetimes: {
    attached: function () { this.initCanvas(); },
    detached: function () { this._stopped = true; }
  },

  observers: {
    'bubbles': function () { if (this._ready) this.build(); }
  },

  methods: {
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
          that.loop();
        });
    },

    build: function () {
      var W = this._w, H = this._h;
      var items = this.data.bubbles || [];
      var that = this;
      this._nodes = items.map(function (it, i) {
        var con = it.kind === 'con';
        var a = (i / Math.max(1, items.length)) * 6.28;
        var cy = con ? H * 0.72 : H * 0.30;
        return {
          label: it.label,
          con: con,
          pal: con ? CON : PRO,
          r: that.radius(it),
          x: W / 2 + Math.cos(a) * 40,
          y: cy + Math.sin(a) * 30,
          vx: 0, vy: 0
        };
      });
    },

    radius: function (it) {
      var base = 13 + (it.w || 0.6) * 15;
      return it.kind === 'con' ? base * 0.92 : base;
    },

    loop: function () {
      if (this._stopped || !this._canvas) return;
      this.physics();
      this.draw();
      var that = this;
      this._canvas.requestAnimationFrame(function () { that.loop(); });
    },

    physics: function () {
      var W = this._w, H = this._h, ns = this._nodes || [];
      var cx = W / 2, topY = H * 0.30, botY = H * 0.72;
      for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        if (n.fix) continue;
        var gy = n.con ? botY : topY;
        n.vx += (cx - n.x) * 0.006;
        n.vy += (gy - n.y) * 0.012;
        n.vx *= 0.84; n.vy *= 0.84;
        n.x += n.vx; n.y += n.vy;
      }
      for (var it = 0; it < 5; it++) {
        for (var a = 0; a < ns.length; a++) {
          for (var b = a + 1; b < ns.length; b++) {
            var p = ns[a], q = ns[b];
            var dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01, min = p.r + q.r;
            if (d < min) {
              var ov = min - d, ux = dx / d, uy = dy / d;
              if (p.fix) { q.x += ux * ov; q.y += uy * ov; }
              else if (q.fix) { p.x -= ux * ov; p.y -= uy * ov; }
              else { p.x -= ux * ov / 2; p.y -= uy * ov / 2; q.x += ux * ov / 2; q.y += uy * ov / 2; }
            }
          }
        }
        for (var k = 0; k < ns.length; k++) {
          var m = ns[k];
          if (m.fix) continue;
          if (m.x < m.r) m.x = m.r; if (m.x > W - m.r) m.x = W - m.r;
          if (m.y < m.r) m.y = m.r; if (m.y > H - m.r) m.y = H - m.r;
        }
      }
    },

    draw: function () {
      var ctx = this._ctx, ns = this._nodes || [];
      ctx.clearRect(0, 0, this._w, this._h);
      for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        ctx.fillStyle = n.pal.fill;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.28); ctx.fill();
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
        if (Math.hypot(n.x - x, n.y - y) < n.r) return n;
      }
      return null;
    },
    onTouchStart: function (e) {
      var t = e.touches[0]; if (!t) return;
      this._drag = this.pick(t.x, t.y);
      if (this._drag) this._drag.fix = true;
    },
    onTouchMove: function (e) {
      if (!this._drag) return;
      var t = e.touches[0]; if (!t) return;
      this._drag.x = t.x; this._drag.y = t.y; this._drag.vx = 0; this._drag.vy = 0;
    },
    onTouchEnd: function () {
      if (this._drag) { this._drag.fix = false; this._drag = null; }
    }
  }
});
