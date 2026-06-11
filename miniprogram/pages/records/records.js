var store = require('../../utils/store.js');

Page({
  data: {
    list: [],
    source: 'local',
    loading: true
  },

  onShow: function () {
    this.load();
  },

  load: function () {
    var that = this;
    store.listRecords().then(function (res) {
      that.setData({ list: res.list, source: res.source, loading: false });
    });
  },

  onItemTap: function (e) {
    var rec = this.data.list[e.currentTarget.dataset.index];
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
    var rec = this.data.list[e.currentTarget.dataset.index];
    wx.showActionSheet({
      itemList: ['删除该记录'],
      itemColor: '#B3402A',
      success: function (res) {
        if (res.tapIndex === 0) {
          store.removeRecord(rec._id).then(function () {
            wx.showToast({ title: '已删除', icon: 'success' });
            that.load();
          });
        }
      }
    });
  },

  goIndex: function () {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
