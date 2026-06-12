var store = require('../../utils/store.js');
var bazi = require('../../utils/bazi.js');
var prefs = require('../../utils/prefs.js');

var GZ_CHARS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
var PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'];

// 输入是否为干支查询（1-2 个干支字符，如「庚」「午」「庚午」）
function isGanZhiQuery(kw) {
  if (!kw || kw.length > 2) return false;
  for (var i = 0; i < kw.length; i++) {
    if (GZ_CHARS.indexOf(kw.charAt(i)) === -1) return false;
  }
  return true;
}

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

Page({
  data: {
    keyword: '',
    mode: 'name',
    pillarFilter: -1,
    shown: [],
    groups: [],
    total: 0,
    source: 'local',
    loading: true,
    fs: 'std'
  },

  onShow: function () {
    this.setData({ fs: prefs.getFontSize() });
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
    this.setData({ keyword: '', pillarFilter: -1 });
    this.apply();
  },

  // 切换柱位筛选（全部/年柱/月柱/日柱/时柱）
  onPillarFilter: function (e) {
    this.setData({ pillarFilter: Number(e.currentTarget.dataset.pillar) });
    this.apply();
  },

  // 应用搜索：干支 → 按柱位聚合（可筛选具体柱位）；其他 → 姓名模糊匹配 + 字母排序
  apply: function () {
    var kw = (this.data.keyword || '').trim();
    var all = this._all || [];
    if (kw && isGanZhiQuery(kw)) {
      var filter = this.data.pillarFilter;
      var groups = [];
      for (var i = 0; i < 4; i++) {
        if (filter >= 0 && i !== filter) continue;
        var items = [];
        for (var j = 0; j < all.length; j++) {
          var p = all[j].pillarArr[i] || '';
          if (p.indexOf(kw) > -1) items.push(all[j]);
        }
        if (items.length) {
          groups.push({
            title: PILLAR_LABELS[i],
            kw: kw,
            count: items.length,
            items: sortByName(items)
          });
        }
      }
      this.setData({ mode: 'ganzhi', groups: groups, shown: [] });
    } else {
      var items2 = all;
      if (kw) {
        items2 = all.filter(function (r) {
          return (r.name || '').indexOf(kw) > -1;
        });
      }
      this.setData({ mode: 'name', shown: sortByName(items2), groups: [], pillarFilter: -1 });
    }
  },

  findById: function (id) {
    var all = this._all || [];
    for (var i = 0; i < all.length; i++) {
      if (all[i]._id === id) return all[i];
    }
    return null;
  },

  onItemTap: function (e) {
    var rec = this.findById(e.currentTarget.dataset.id);
    if (!rec) return;
    var input = {
      name: rec.name, gender: rec.gender, calendar: rec.calendar,
      year: rec.year, month: rec.month, day: rec.day,
      hour: rec.hour, minute: rec.minute,
      province: rec.province, city: rec.city, lng: rec.lng,
      useTrueSolar: rec.useTrueSolar
    };
    wx.navigateTo({
      url: '/pages/result/result?from=record&input=' + encodeURIComponent(JSON.stringify(input))
    });
  },

  onItemLongPress: function (e) {
    var that = this;
    var rec = this.findById(e.currentTarget.dataset.id);
    if (!rec) return;
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

  // 绑定/取消本人命盘（用于首页今日运势）
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
          hour: rec.hour, minute: rec.minute,
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
  }
});
