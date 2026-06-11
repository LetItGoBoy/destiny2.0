var TYPES = {
  marriage: {
    title: '婚配',
    ico: '囍',
    icoCls: 'red',
    desc: '双盘合婚，从生肖合化、日柱干支合冲、五行互补等维度，解读两人姻缘相合之处。',
    features: ['双人八字并排对比', '生肖合化 · 日柱合冲', '五行互补分析', '综合契合度评分']
  },
  partner: {
    title: '合作伙伴配',
    ico: '合',
    icoCls: 'gold',
    desc: '事业相合分析，从用神互补、十神格局、五行生扶等维度，评估合作共事的契合程度。',
    features: ['双人八字并排对比', '十神格局互参', '五行生扶 · 用神互补', '事业相合度评分']
  }
};

Page({
  data: {
    info: TYPES.marriage
  },

  onLoad: function (options) {
    var info = TYPES[options.type] || TYPES.marriage;
    this.setData({ info: info });
    wx.setNavigationBarTitle({ title: info.title });
  },

  onNotify: function () {
    wx.showToast({ title: '上线后将在小程序内通知', icon: 'none' });
  },

  goBack: function () {
    wx.navigateBack();
  }
});
