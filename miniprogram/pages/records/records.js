var store = require('../../utils/store.js');
var bazi = require('../../utils/bazi.js');
var prefs = require('../../utils/prefs.js');
var celebs = require('../../utils/celebs.js');

var PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'];
// 干支五行配色
var GAN_LIST = [
  { ch: '甲', cls: 'mu' }, { ch: '乙', cls: 'mu' }, { ch: '丙', cls: 'huo' }, { ch: '丁', cls: 'huo' },
  { ch: '戊', cls: 'tu' }, { ch: '己', cls: 'tu' }, { ch: '庚', cls: 'jin' }, { ch: '辛', cls: 'jin' },
  { ch: '壬', cls: 'shui' }, { ch: '癸', cls: 'shui' }
];
var ZHI_LIST = [
  { ch: '子', cls: 'shui' }, { ch: '丑', cls: 'tu' }, { ch: '寅', cls: 'mu' }, { ch: '卯', cls: 'mu' },
  { ch: '辰', cls: 'tu' }, { ch: '巳', cls: 'huo' }, { ch: '午', cls: 'huo' }, { ch: '未', cls: 'tu' },
  { ch: '申', cls: 'jin' }, { ch: '酉', cls: 'jin' }, { ch: '戌', cls: 'tu' }, { ch: '亥', cls: 'shui' }
];
var GAN_SET = '甲乙丙丁戊己庚辛壬癸';

// 姓名拼音字母排序，未署名排最后（按时间倒序）
function sortByName(list) {
  return list.slice(0).sort(function (a, b) {
    var an = a.name || '', bn = b.name || '';
    if (!an && !bn) return (b.createdAt || 0) - (a.createdAt || 0);
    if (!an) return 1;
    if (!bn) return -1;
    try {
      return an.localeCompare(bn, 'zh-Hans-CN-u-co-pinyin');
    } catch (e) {
      return an < bn ? -1 : an > bn ? 1 : 0;
    }
  });
}

// 按排盘时间（创建时间）倒序
function sortByTime(list) {
  return list.slice(0).sort(function (a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

Page({
  data: {
    keyword: '',
    shown: [],
    total: 0,
    source: 'local',
    loading: true,
    fs: 'std',
    listTab: 'user',                        // user 用户列表 / celeb 名人库
    sortMode: 'name',                       // name 字母（默认）/ time 排盘时间
    // 筛选
    showFilter: false,
    genderFilter: -1,                       // -1 不限 / 1 男 / 0 女
    slots: ['', '', '', '', '', '', '', ''], // 年干,年支,月干,月支,日干,日支,时干,时支
    activeSlot: -1,
    filterCount: 0,
    pillarLabels: PILLAR_LABELS,
    ganList: GAN_LIST,
    zhiList: ZHI_LIST
  },

  onShow: function () {
    this.setData({ fs: prefs.getFontSize() });
    // 其他页面（如首页名人库入口）通过 storage 标记请求直接打开名人库 tab
    var wantCeleb = false;
    try {
      wantCeleb = wx.getStorageSync('open_celeb_tab');
      if (wantCeleb) wx.removeStorageSync('open_celeb_tab');
    } catch (e) {}
    if (wantCeleb && this.data.listTab !== 'celeb') {
      this.buildCelebs();
      this.setData({ listTab: 'celeb' });
    }
    this.load();
  },

  load: function () {
    var that = this;
    var self = prefs.getSelf();
    var selfId = self ? self._id : null;
    store.listRecords().then(function (res) {
      that._all = res.list.map(function (r) {
        r.bz = bazi.colorizeBaZi(r.baZi);
        r.pillarArr = (r.baZi || '').split(' ');
        r.isSelf = r._id === selfId;
        r.dayGan = (r.pillarArr[2] || '').charAt(0);
        r.dayCls = (r.bz[2] && r.bz[2][0]) ? r.bz[2][0].cls : '';
        return r;
      });
      that.setData({ source: res.source, loading: false, total: that._all.length });
      that.apply();
    });
  },

  onSearch: function (e) {
    this.setData({ keyword: e.detail.value });
    this.apply();
  },

  onClear: function () {
    this.setData({ keyword: '' });
    this.apply();
  },

  // 名人库（懒构建，仅算四柱）
  buildCelebs: function () {
    if (this._celebAll) return;
    var list = [];
    for (var i = 0; i < celebs.length; i++) {
      var c = celebs[i];
      var input = {
        name: c.name, gender: c.gender, calendar: 'solar',
        year: c.year, month: c.month, day: c.day, hour: 12, minute: 0,
        useTrueSolar: false
      };
      try {
        var q = bazi.quickBaZi(input);
        var bz = bazi.colorizeBaZi(q.baZi);
        var pillarArr = q.baZi.split(' ');
        list.push({
          _id: 'celeb_' + i, _celeb: true,
          name: c.name, gender: c.gender, baZi: q.baZi,
          bz: bz, pillarArr: pillarArr,
          dayGan: q.dayGan,
          dayCls: (bz[2] && bz[2][0]) ? bz[2][0].cls : '',
          solarStr: c.field + ' · ' + c.year + '年' + c.month + '月' + c.day + '日',
          createdAt: 0, input: input
        });
      } catch (e) { /* 跳过无法起盘的日期 */ }
    }
    this._celebAll = list;
  },

  onListTab: function (e) {
    var t = e.currentTarget.dataset.t;
    if (t === this.data.listTab) return;
    if (t === 'celeb') this.buildCelebs();
    this.setData({ listTab: t });
    this.apply();
  },

  onToggleFilter: function () {
    this.setData({ showFilter: !this.data.showFilter });
  },

  onSortMode: function (e) {
    this.setData({ sortMode: e.currentTarget.dataset.m });
    this.apply();
  },

  // 性别（再点取消）
  onGender: function (e) {
    var g = Number(e.currentTarget.dataset.g);
    this.setData({ genderFilter: this.data.genderFilter === g ? -1 : g });
    this.apply();
  },

  // 点选柱位插槽：空槽→激活待填；已填→清空并激活以便重填
  onSlotTap: function (e) {
    var i = Number(e.currentTarget.dataset.slot);
    var slots = this.data.slots.slice();
    if (slots[i]) {
      slots[i] = '';
      this.setData({ slots: slots, activeSlot: i });
      this.apply();
    } else {
      this.setData({ activeSlot: this.data.activeSlot === i ? -1 : i });
    }
  },

  // 点选干支填入激活槽（类型须匹配：干槽填天干、支槽填地支）
  onGzTap: function (e) {
    var ch = e.currentTarget.dataset.ch;
    var slot = this.data.activeSlot;
    if (slot < 0) { wx.showToast({ title: '请先点上方柱位', icon: 'none' }); return; }
    var slotIsGan = slot % 2 === 0;
    var chIsGan = GAN_SET.indexOf(ch) > -1;
    if (slotIsGan !== chIsGan) {
      wx.showToast({ title: slotIsGan ? '该位请选天干' : '该位请选地支', icon: 'none' });
      return;
    }
    var slots = this.data.slots.slice();
    slots[slot] = ch;
    this.setData({ slots: slots, activeSlot: -1 });
    this.apply();
  },

  onReset: function () {
    this.setData({
      genderFilter: -1,
      slots: ['', '', '', '', '', '', '', ''],
      activeSlot: -1
    });
    this.apply();
  },

  // 当前数据源（用户列表 / 名人库）
  activeList: function () {
    return this.data.listTab === 'celeb' ? (this._celebAll || []) : (this._all || []);
  },

  // 应用：姓名模糊 + 性别 + 逐柱干支聚合
  apply: function () {
    var kw = (this.data.keyword || '').trim();
    var g = this.data.genderFilter;
    var slots = this.data.slots;
    var all = this.activeList();

    var cnt = (g !== -1 ? 1 : 0);
    for (var s = 0; s < 8; s++) if (slots[s]) cnt++;

    var res = all.filter(function (r) {
      if (g !== -1 && r.gender !== g) return false;
      if (kw && (r.name || '').indexOf(kw) === -1) return false;
      for (var i = 0; i < 8; i++) {
        if (!slots[i]) continue;
        var pillar = r.pillarArr[Math.floor(i / 2)] || '';
        if (pillar.charAt(i % 2) !== slots[i]) return false;
      }
      return true;
    });

    var sorted = this.data.sortMode === 'time' ? sortByTime(res) : sortByName(res);
    this.setData({ shown: sorted, filterCount: cnt, total: all.length });
  },

  findById: function (id) {
    var all = this.activeList();
    for (var i = 0; i < all.length; i++) {
      if (all[i]._id === id) return all[i];
    }
    return null;
  },

  onItemTap: function (e) {
    var rec = this.findById(e.currentTarget.dataset.id);
    if (!rec) return;
    var input = rec.input || {
      name: rec.name, gender: rec.gender, calendar: rec.calendar,
      year: rec.year, month: rec.month, day: rec.day,
      hour: rec.hour, minute: rec.minute, unknownTime: rec.unknownTime,
      province: rec.province, city: rec.city, lng: rec.lng,
      useTrueSolar: rec.useTrueSolar
    };
    var prefix = rec._celeb ? '' : 'from=record&';
    wx.navigateTo({
      url: '/pages/result/result?' + prefix + 'input=' + encodeURIComponent(JSON.stringify(input))
    });
  },

  onItemLongPress: function (e) {
    var that = this;
    var rec = this.findById(e.currentTarget.dataset.id);
    if (!rec || rec._celeb) return;
    var selfItem = rec.isSelf ? '取消本人命盘' : '设为本人命盘';
    wx.showActionSheet({
      itemList: [selfItem, '修改姓名', '删除该记录'],
      itemColor: '#A78BFA',
      success: function (res) {
        if (res.tapIndex === 0) that.toggleSelf(rec);
        if (res.tapIndex === 1) that.editName(rec);
        if (res.tapIndex === 2) that.deleteRec(rec);
      }
    });
  },

  toggleSelf: function (rec) {
    if (rec.isSelf) {
      prefs.clearSelf();
      wx.showToast({ title: '已取消绑定', icon: 'none' });
    } else {
      prefs.setSelf({
        _id: rec._id,
        name: rec.name || '',
        gender: rec.gender,
        baZi: rec.baZi,
        dayGan: (rec.pillarArr[2] || '').charAt(0),
        input: {
          name: rec.name, gender: rec.gender, calendar: rec.calendar,
          year: rec.year, month: rec.month, day: rec.day,
          hour: rec.hour, minute: rec.minute, unknownTime: rec.unknownTime,
          province: rec.province, city: rec.city, lng: rec.lng,
          useTrueSolar: rec.useTrueSolar
        }
      });
      wx.showToast({ title: '已设为本人命盘', icon: 'success' });
    }
    this.load();
  },

  editName: function (rec) {
    var that = this;
    wx.showModal({
      title: '修改姓名',
      editable: true,
      content: rec.name || '',
      placeholderText: '请输入姓名',
      confirmColor: '#A78BFA',
      success: function (res) {
        if (!res.confirm) return;
        var name = (res.content || '').trim();
        store.updateRecord(rec._id, { name: name }).then(function () {
          if (rec.isSelf) {
            var self = prefs.getSelf();
            if (self) {
              self.name = name;
              self.input.name = name;
              prefs.setSelf(self);
            }
          }
          wx.showToast({ title: '已修改', icon: 'success' });
          that.load();
        });
      }
    });
  },

  deleteRec: function (rec) {
    var that = this;
    wx.showModal({
      title: '删除记录',
      content: '确定删除「' + (rec.name || '未署名') + ' · ' + rec.baZi + '」吗？',
      confirmText: '删除',
      confirmColor: '#F2A7C3',
      success: function (res) {
        if (!res.confirm) return;
        store.removeRecord(rec._id).then(function () {
          if (rec.isSelf) prefs.clearSelf();
          wx.showToast({ title: '已删除', icon: 'success' });
          that.load();
        });
      }
    });
  },

  goIndex: function () {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onShareAppMessage: function () {
    return { title: '同乐八字 · 名人命盘库', path: '/pages/records/records' };
  },

  onShareTimeline: function () {
    return { title: '同乐八字 · 名人命盘库' };
  }
});
