// 疗愈空间：呼吸放松 / 电子木鱼 / 烦恼焚化 / 静心雨声 / 每日抄经
// 留存机制：连续打卡 + 今日心语 + 累计成就
var MERIT_KEY = 'tl_merit';        // 累计功德
var POINTS_KEY = 'tl_points';      // 打卡积分
var STREAK_KEY = 'tl_streak';      // 当前连续天数
var LASTDATE_KEY = 'tl_lastDate';  // 最近一次打卡日期（本地日期串）
var MAXSTREAK_KEY = 'tl_maxStreak';// 历史最长连续
var TOTALDAYS_KEY = 'tl_totalDays';// 累计打卡天数
var SUTRA_KEY = 'tl_sutraDone';    // 累计完成抄经次数
var SUTRADATE_KEY = 'tl_sutraDate';// 今日是否已抄经（日期串）
var MUYU_DATE_KEY = 'tl_muyuDate'; // 今日木鱼计数日期
var MUYU_COUNT_KEY = 'tl_muyuCount';// 今日木鱼次数
var MUYU_CHECKIN_TARGET = 10;
var CHECKIN_POINTS = 10;

// 呼吸节奏：4-4-6（吸气-屏息-呼气），经典减压节奏
var BREATH_PHASES = [
  { name: '吸气', dur: 4000, scale: 1.55 },
  { name: '屏息', dur: 4000, scale: 1.55 },
  { name: '呼气', dur: 6000, scale: 0.9 }
];

// 今日心语：古典格言，按日期轮换（不涉吉凶，仅作静心之语）
var QUOTES = [
  '心无挂碍，无有恐怖。',
  '行到水穷处，坐看云起时。',
  '宠辱不惊，看庭前花开花落。',
  '上善若水，水善利万物而不争。',
  '知人者智，自知者明。',
  '不以物喜，不以己悲。',
  '海纳百川，有容乃大。',
  '静以修身，俭以养德。',
  '宁静致远，淡泊明志。',
  '己所不欲，勿施于人。',
  '岁月不居，时节如流。',
  '千里之行，始于足下。',
  '应无所住，而生其心。',
  '万物静观皆自得。',
  '随缘自适，烦恼即去。',
  '一念放下，万般自在。',
  '春有百花秋有月，夏有凉风冬有雪。',
  '竹密不妨流水过，山高岂碍白云飞。',
  '心若不动，风又奈何。',
  '人闲桂花落，夜静春山空。',
  '不忘初心，方得始终。',
  '种花的人，自己也成了花。',
  '慢慢来，比较快。',
  '此心安处是吾乡。',
  '愿你历尽千帆，归来仍是少年。',
  '行至水深处，坐看云卷舒。',
  '心宽一寸，路宽一丈。',
  '凡所有相，皆是虚妄。',
  '一花一世界，一叶一菩提。',
  '日日是好日，处处莲花开。'
];

// 每日抄经：短句古典文本，按日期轮换（描红式逐字点写）
var SUTRAS = [
  { title: '心经·空相', text: '色即是空，空即是色。' },
  { title: '心经·无碍', text: '心无挂碍，无有恐怖。' },
  { title: '心经·究竟', text: '远离颠倒梦想，究竟涅槃。' },
  { title: '金刚经·如是', text: '应无所住，而生其心。' },
  { title: '金刚经·虚妄', text: '凡所有相，皆是虚妄。' },
  { title: '金刚经·梦幻', text: '一切有为法，如梦幻泡影。' },
  { title: '道德经·若水', text: '上善若水，水利万物而不争。' },
  { title: '道德经·自知', text: '知人者智，自知者明。' },
  { title: '道德经·千里', text: '千里之行，始于足下。' },
  { title: '诫子书·宁静', text: '非淡泊无以明志，非宁静无以致远。' },
  { title: '论语·恕道', text: '己所不欲，勿施于人。' },
  { title: '菜根谭·闲云', text: '宠辱不惊，去留无意。' },
  { title: '六祖坛经·明镜', text: '本来无一物，何处惹尘埃。' },
  { title: '寒山·清心', text: '心月自常明，照彻无遮障。' }
];

// 成就清单（累计型，达成即点亮）
function buildAchievements(stat) {
  var defs = [
    { key: 's3', icon: '🌱', name: '初心', desc: '连续打卡 3 天', ok: stat.maxStreak >= 3 },
    { key: 's7', icon: '🪷', name: '七日', desc: '连续打卡 7 天', ok: stat.maxStreak >= 7 },
    { key: 's30', icon: '🏔', name: '坚持', desc: '连续打卡 30 天', ok: stat.maxStreak >= 30 },
    { key: 'm100', icon: '🔔', name: '功德百', desc: '累计功德 100', ok: stat.merit >= 100 },
    { key: 'm1000', icon: '✨', name: '功德千', desc: '累计功德 1000', ok: stat.merit >= 1000 },
    { key: 'p100', icon: '🎁', name: '小福袋', desc: '累计积分 100', ok: stat.points >= 100 },
    { key: 'c1', icon: '🖌', name: '提笔', desc: '完成抄经 1 次', ok: stat.sutra >= 1 },
    { key: 'c10', icon: '📜', name: '勤书', desc: '完成抄经 10 次', ok: stat.sutra >= 10 },
    { key: 'd30', icon: '🌕', name: '满月', desc: '累计打卡 30 天', ok: stat.totalDays >= 30 }
  ];
  return defs;
}

// 本地日期串（年-月-日，按设备本地时区）
function dateStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

// 以本地日期为锚的稳定日序号（用于按日轮换内容）
function dayIndex() {
  var d = new Date();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

Page({
  data: {
    mode: '',            // '' | breath | muyu | burn | sutra
    // 留存：心语 / 打卡 / 成就
    todayQuote: '',
    streak: 0,
    checkedToday: false,
    points: 0,
    totalDays: 0,
    sutraCount: 0,
    achievements: [],
    achGot: 0,
    // 呼吸
    breathPhase: '准备',
    breathScale: 0.9,
    breathDur: 1000,
    breathRound: 0,
    // 木鱼
    merit: 0,
    muyuTodayCount: 0,
    muyuCheckinTarget: MUYU_CHECKIN_TARGET,
    floats: [],
    // 焚化
    worry: '',
    burning: false,
    burned: false,
    // 雨声
    raining: false,
    // 抄经
    sutraTitle: '',
    sutraChars: [],      // [{ch, punct, ink}]
    sutraInk: 0,         // 已描字数
    sutraTotal: 0,       // 需描总字数（不含标点）
    sutraDone: false,
    sutraTodayDone: false
  },

  onLoad: function () {
    this._audio = null;
    this._rainSource = null;
    this._floatId = 0;
    this.refreshStats();
  },

  onShow: function () {
    this.refreshStats();
  },

  onHide: function () {
    this.stopAll();
  },

  onUnload: function () {
    this.stopAll();
  },

  // 读取并计算留存数据（心语、连续天数、成就）
  refreshStats: function () {
    var merit = wx.getStorageSync(MERIT_KEY) || 0;
    var points = wx.getStorageSync(POINTS_KEY) || 0;
    var streak = wx.getStorageSync(STREAK_KEY) || 0;
    var last = wx.getStorageSync(LASTDATE_KEY) || '';
    var maxStreak = wx.getStorageSync(MAXSTREAK_KEY) || 0;
    var totalDays = wx.getStorageSync(TOTALDAYS_KEY) || 0;
    var sutra = wx.getStorageSync(SUTRA_KEY) || 0;
    var sutraDate = wx.getStorageSync(SUTRADATE_KEY) || '';
    var muyuDate = wx.getStorageSync(MUYU_DATE_KEY) || '';
    var muyuTodayCount = muyuDate === dateStr() ? (wx.getStorageSync(MUYU_COUNT_KEY) || 0) : 0;

    var today = dateStr();
    var yest = dateStr(new Date(Date.now() - 86400000));
    // 连续是否仍然有效：今天或昨天打过卡才延续，否则显示为 0（已中断）
    var alive = (last === today || last === yest);
    var dispStreak = alive ? streak : 0;

    var stat = { merit: merit, points: points, maxStreak: maxStreak, totalDays: totalDays, sutra: sutra };
    var achs = buildAchievements(stat);
    var got = 0;
    for (var i = 0; i < achs.length; i++) if (achs[i].ok) got++;

    this.setData({
      merit: merit,
      points: points,
      streak: dispStreak,
      checkedToday: last === today,
      muyuTodayCount: muyuTodayCount,
      muyuCheckinTarget: MUYU_CHECKIN_TARGET,
      totalDays: totalDays,
      sutraCount: sutra,
      achievements: achs,
      achGot: got,
      todayQuote: QUOTES[dayIndex() % QUOTES.length],
      sutraTodayDone: sutraDate === today
    });
  },

  // 打卡：每日一次，仅由木鱼当日达标触发，断一天归零
  doCheckin: function () {
    var today = dateStr();
    var last = wx.getStorageSync(LASTDATE_KEY) || '';
    if (last === today) return false; // 今天已打卡
    var yest = dateStr(new Date(Date.now() - 86400000));
    var streak = wx.getStorageSync(STREAK_KEY) || 0;
    streak = (last === yest) ? streak + 1 : 1;
    var maxStreak = Math.max(wx.getStorageSync(MAXSTREAK_KEY) || 0, streak);
    var totalDays = (wx.getStorageSync(TOTALDAYS_KEY) || 0) + 1;
    wx.setStorageSync(LASTDATE_KEY, today);
    wx.setStorageSync(STREAK_KEY, streak);
    wx.setStorageSync(MAXSTREAK_KEY, maxStreak);
    wx.setStorageSync(TOTALDAYS_KEY, totalDays);
    wx.setStorageSync(POINTS_KEY, (wx.getStorageSync(POINTS_KEY) || 0) + CHECKIN_POINTS);
    this.refreshStats();
    wx.showToast({ title: '已打卡 · 积分 +' + CHECKIN_POINTS + ' · 连续 ' + streak + ' 天', icon: 'none' });
    return true;
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
    if (mode === 'sutra') this.startSutra();
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
      if (i === 0) {
        var r = that.data.breathRound + 1;
        that.setData({ breathRound: r });
      }
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
    var today = dateStr();
    var muyuDate = wx.getStorageSync(MUYU_DATE_KEY) || '';
    var count = muyuDate === today ? (wx.getStorageSync(MUYU_COUNT_KEY) || 0) + 1 : 1;
    wx.setStorageSync(MUYU_DATE_KEY, today);
    wx.setStorageSync(MUYU_COUNT_KEY, count);
    var id = ++this._floatId;
    var floats = this.data.floats.concat([{ id: id, x: Math.floor(Math.random() * 120 - 60) }]);
    this.setData({ merit: merit, muyuTodayCount: count, floats: floats, muyuHit: id });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    this.playTick();
    if (count >= MUYU_CHECKIN_TARGET) this.doCheckin();
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

  // ---- 每日抄经（描红逐字点写）----
  startSutra: function () {
    var s = SUTRAS[dayIndex() % SUTRAS.length];
    var chars = [];
    var total = 0;
    var PUNCT = '，。、；：！？「」“”·…—';
    for (var i = 0; i < s.text.length; i++) {
      var ch = s.text.charAt(i);
      var isP = PUNCT.indexOf(ch) > -1;
      if (!isP) total++;
      chars.push({ ch: ch, punct: isP, ink: false });
    }
    this.setData({
      sutraTitle: s.title,
      sutraChars: chars,
      sutraInk: 0,
      sutraTotal: total,
      sutraDone: false
    });
  },

  onSutraChar: function (e) {
    if (this.data.sutraDone) return;
    var i = Number(e.currentTarget.dataset.i);
    var chars = this.data.sutraChars;
    if (chars[i].punct || chars[i].ink) return;
    var key = 'sutraChars[' + i + '].ink';
    var ink = this.data.sutraInk + 1;
    var patch = {};
    patch[key] = true;
    patch.sutraInk = ink;
    this.setData(patch);
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    if (ink >= this.data.sutraTotal) this.finishSutra();
  },

  finishSutra: function () {
    var today = dateStr();
    var already = wx.getStorageSync(SUTRADATE_KEY) === today;
    if (!already) {
      var cnt = (wx.getStorageSync(SUTRA_KEY) || 0) + 1;
      wx.setStorageSync(SUTRA_KEY, cnt);
      wx.setStorageSync(SUTRADATE_KEY, today);
      // 抄经亦计入功德
      wx.setStorageSync(MERIT_KEY, (wx.getStorageSync(MERIT_KEY) || 0) + 10);
    }
    this.setData({ sutraDone: true });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'medium' });
    this.refreshStats();
  },

  resetSutra: function () {
    this.startSutra();
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
  },

  onShareAppMessage: function () {
    return { title: '疗愈空间 · 木鱼抄经，慢下来给心一点空隙', path: '/pages/healing/healing' };
  },

  onShareTimeline: function () {
    return { title: '疗愈空间 · 木鱼抄经，慢下来给心一点空隙' };
  }
});
