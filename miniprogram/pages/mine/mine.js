var config = require('../../config.js');
var store = require('../../utils/store.js');
var prefs = require('../../utils/prefs.js');

var PROFILE_KEY = 'tl_profile';
var DEFAULT_AVATAR = '';

Page({
  data: {
    nickname: '',
    avatar: DEFAULT_AVATAR,
    recordCount: 0,
    cloudEnabled: false,
    fs: 'std',
    version: config.version
  },

  onShow: function () {
    var profile = wx.getStorageSync(PROFILE_KEY) || {};
    var that = this;
    this.setData({
      nickname: profile.nickname || '',
      avatar: profile.avatar || DEFAULT_AVATAR,
      cloudEnabled: getApp().globalData.cloudEnabled,
      fs: prefs.getFontSize()
    });
    store.listRecords().then(function (res) {
      that.setData({ recordCount: res.list.length });
    });
  },

  // 切换显示字号（全局生效）
  onFontSize: function (e) {
    var fs = e.currentTarget.dataset.fs;
    prefs.setFontSize(fs);
    this.setData({ fs: fs });
  },

  saveProfile: function () {
    wx.setStorageSync(PROFILE_KEY, {
      nickname: this.data.nickname,
      avatar: this.data.avatar
    });
  },

  onChooseAvatar: function (e) {
    this.setData({ avatar: e.detail.avatarUrl });
    this.saveProfile();
  },

  onNicknameChange: function (e) {
    this.setData({ nickname: e.detail.value });
    this.saveProfile();
  },

  goRecords: function () {
    wx.switchTab({ url: '/pages/records/records' });
  },

  onContact: function () {
    // 若小程序后台已接入客服，可将此入口改为 button open-type="contact"
    wx.showModal({
      title: '联系我们',
      content: '同乐八字\n如有问题或建议，欢迎通过小程序客服或公司渠道与我们联系。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onAbout: function () {
    wx.showModal({
      title: '关于同乐八字',
      content: '同乐八字专注于传统四柱八字文化的数字化呈现，提供真太阳时排盘、大运流年流月推演等功能。\n\n内容仅供传统文化研究与参考。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onSwitchUser: function () {
    var that = this;
    wx.showModal({
      title: '切换用户',
      content: '将清除当前昵称与头像，重新设置个人信息。八字记录不受影响。',
      confirmText: '切换',
      confirmColor: '#A78BFA',
      success: function (res) {
        if (res.confirm) {
          wx.removeStorageSync(PROFILE_KEY);
          that.setData({ nickname: '', avatar: DEFAULT_AVATAR });
          wx.showToast({ title: '请重新设置', icon: 'none' });
        }
      }
    });
  },

  onLogout: function () {
    var that = this;
    wx.showModal({
      title: '退出登录',
      content: '将清除本机上的个人信息与本地八字记录' + (this.data.cloudEnabled ? '（云端记录保留）' : '') + '，确定退出吗？',
      confirmText: '退出',
      confirmColor: '#A78BFA',
      success: function (res) {
        if (res.confirm) {
          wx.removeStorageSync(PROFILE_KEY);
          store.clearLocal();
          prefs.clearSelf();
          that.setData({ nickname: '', avatar: DEFAULT_AVATAR, recordCount: 0 });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  }
});
