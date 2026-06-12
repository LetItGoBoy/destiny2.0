// 今日个人运势：本人日主 × 当日干支 → 十神能量提示
var lunarLib = require('./lunar.js');
var bazi = require('./bazi.js');
var Lunar = lunarLib.Lunar;
var LunarUtil = lunarLib.LunarUtil;

var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

// 当日天干对本人日主呈现的十神 → 当日能量提示
var ADVICE = {
  比肩: '自我能量强的一天，适合独立推进手头的事；钱财上避免与人攀比争执。',
  劫财: '行动力和胜负欲都旺，适合冲刺目标、跑动办事；消费与合伙决策先放一晚。',
  食神: '身心舒展、灵感在线，适合创作表达、美食社交，给自己留点享受的时间。',
  伤官: '才思敏捷、表现欲强，适合输出想法、展示才华；注意措辞，少与规则硬碰。',
  偏财: '财机灵动，留意身边的机会与人脉，应酬交际有利；忌贪多和冲动投机。',
  正财: '脚踏实地的进财日，适合处理账务、谈薪签单、推进实务，按计划走最稳。',
  七杀: '压力与挑战并存，执行力被充分激发，适合啃硬骨头；遇冲突绕着走更聪明。',
  正官: '规矩与名誉当道，适合对接领导、处理公务、办理正式手续，言行得体加分。',
  偏印: '直觉敏锐、思虑偏深，适合独处钻研、学习充电；别钻牛角尖，出门走走。',
  正印: '有贵人照拂的一天，适合请教前辈、读书蓄能、调养身心，慢就是快。'
};

/**
 * 生成今日运势视图
 * @param {object|null} self 本人命盘快照（含 dayGan），null 表示未绑定
 */
function getDaily(self) {
  var now = new Date();
  var lunar = Lunar.fromDate(now);
  var gz = lunar.getDayInGanZhi();
  var view = {
    dateStr: (now.getMonth() + 1) + '月' + now.getDate() + '日 周' + WEEK[now.getDay()],
    lunarStr: lunar.getMonthInChinese() + '月' + lunar.getDayInChinese(),
    ganZhi: bazi.colorizeBaZi(gz)[0],
    bound: false
  };
  if (self && self.dayGan) {
    view.bound = true;
    view.name = self.name || '本人';
    view.shiShen = LunarUtil.SHI_SHEN[self.dayGan + gz.charAt(0)];
    view.xingYun = bazi.changSheng(self.dayGan, gz.charAt(1));
    view.advice = ADVICE[view.shiShen] || '';
  }
  return view;
}

module.exports = {
  getDaily: getDaily
};
