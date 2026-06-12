// 疗愈空间：呼吸放松 / 电子木鱼 / 烦恼焚化 / 静心雨声
var MERIT_KEY = 'tl_merit';

// 呼吸节奏：4-4-6（吸气-屏息-呼气），经典减压节奏
var BREATH_PHASES = [
  { name: '吸气', dur: 4000, scale: 1.55 },
  { name: '屏息', dur: 4000, scale: 1.55 },
  { name: '呼气', dur: 6000, scale: 0.9 }
];

Page({
  data: {
    mode: '',            // '' | breath | muyu | burn
    // 呼吸
    breathPhase: '准备',
    breathScale: 0.9,
    breathDur: 1000,
    breathRound: 0,
    // 木鱼
    merit: 0,
    floats: [],
    // 焚化
    worry: '',
    burning: false,
    burned: false,
    // 雨声
    raining: false
  },

  onLoad: function () {
    this.setData({ merit: wx.getStorageSync(MERIT_KEY) || 0 });
    this._audio = null;
    this._rainSource = null;
    this._floatId = 0;
  },

  onHide: function () {
    this.stopAll();
  },

  onUnload: function () {
    this.stopAll();
  },

  stopAll: function () {
    this.stopBreath();
    this.stopRain();
    this.setData({ mode: '', raining: false });
  },

  openMode: function (e) {
    var mode = e.currentTarget.dataset.mode;
    if (mode === 'rain') {
      this.toggleRain();
      return;
    }
    this.setData({ mode: mode, burned: false, burning: false });
    if (mode === 'breath') this.startBreath();
  },

  closeMode: function () {
    this.stopBreath();
    this.setData({ mode: '' });
  },

  noop: function () {},

  // ---- 呼吸放松 ----
  startBreath: function () {
    var that = this;
    this._breathOn = true;
    this.setData({ breathRound: 0, breathPhase: '准备', breathScale: 0.9, breathDur: 1000 });
    var step = function (i) {
      if (!that._breathOn) return;
      var p = BREATH_PHASES[i];
      if (i === 0) that.setData({ breathRound: that.data.breathRound + 1 });
      that.setData({ breathPhase: p.name, breathScale: p.scale, breathDur: p.dur });
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      that._breathTimer = setTimeout(function () {
        step((i + 1) % BREATH_PHASES.length);
      }, p.dur);
    };
    this._breathTimer = setTimeout(function () { step(0); }, 1000);
  },

  stopBreath: function () {
    this._breathOn = false;
    if (this._breathTimer) clearTimeout(this._breathTimer);
  },

  // ---- 电子木鱼 ----
  onMuyuTap: function () {
    var merit = this.data.merit + 1;
    wx.setStorageSync(MERIT_KEY, merit);
    var id = ++this._floatId;
    var floats = this.data.floats.concat([{ id: id, x: Math.floor(Math.random() * 120 - 60) }]);
    this.setData({ merit: merit, floats: floats, muyuHit: id });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    this.playTick();
    var that = this;
    setTimeout(function () {
      that.setData({
        floats: that.data.floats.filter(function (f) { return f.id !== id; })
      });
    }, 900);
  },

  // ---- 烦恼焚化 ----
  onWorryInput: function (e) {
    this.setData({ worry: e.detail.value });
  },

  onBurn: function () {
    if (!this.data.worry.trim() || this.data.burning) return;
    var that = this;
    this.setData({ burning: true });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'medium' });
    setTimeout(function () {
      that.setData({ burning: false, burned: true, worry: '' });
    }, 2000);
  },

  onBurnAgain: function () {
    this.setData({ burned: false, worry: '' });
  },

  // ---- 静心雨声（WebAudio 程序合成，无需音频文件）----
  ensureAudio: function () {
    if (this._audio === false) return null;
    if (this._audio) return this._audio;
    try {
      this._audio = wx.createWebAudioContext();
    } catch (e) {
      this._audio = false;
      return null;
    }
    return this._audio;
  },

  // 木鱼"嗒"声：衰减正弦短音
  playTick: function () {
    var ctx = this.ensureAudio();
    if (!ctx) return;
    try {
      var sr = ctx.sampleRate;
      var len = Math.floor(sr * 0.12);
      var buf = ctx.createBuffer(1, len, sr);
      var ch = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        var t = i / sr;
        ch[i] = Math.sin(2 * Math.PI * 540 * t) * Math.exp(-28 * t) * 0.5;
      }
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
    } catch (e) { /* 设备不支持时静默，仅保留震动反馈 */ }
  },

  toggleRain: function () {
    if (this.data.raining) {
      this.stopRain();
      this.setData({ raining: false });
      return;
    }
    var ctx = this.ensureAudio();
    if (!ctx) {
      wx.showToast({ title: '当前设备不支持音频合成', icon: 'none' });
      return;
    }
    try {
      // 棕色噪声（白噪声积分）听感接近落雨/瀑布
      var sr = ctx.sampleRate;
      var len = sr * 4;
      var buf = ctx.createBuffer(1, len, sr);
      var ch = buf.getChannelData(0);
      var last = 0;
      for (var i = 0; i < len; i++) {
        var white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        ch[i] = last * 3.2;
      }
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var gain = ctx.createGain();
      gain.gain.value = 0.55;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      this._rainSource = src;
      this.setData({ raining: true });
    } catch (e) {
      wx.showToast({ title: '当前设备不支持音频合成', icon: 'none' });
    }
  },

  stopRain: function () {
    if (this._rainSource) {
      try { this._rainSource.stop(); } catch (e) { /* 已停止 */ }
      this._rainSource = null;
    }
  }
});
