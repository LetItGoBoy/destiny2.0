var config = require('./config.js');

App({
  globalData: {
    cloudEnabled: false,
    pendingInput: null
  },

  onLaunch: function () {
    if (config.cloudEnv && wx.cloud) {
      wx.cloud.init({
        env: config.cloudEnv,
        traceUser: true
      });
      this.globalData.cloudEnabled = true;
    }
  }
});
