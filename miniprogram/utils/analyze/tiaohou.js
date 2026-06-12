// 调候派：依《穷通宝鉴》十干十二月调候用神简表，察寒暖燥湿
var base = require('./base.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;

// 调候用神简表（首字为主用，余为佐）
var TABLE = {
  甲: { 寅: '丙癸', 卯: '庚丙丁戊己', 辰: '庚丁壬', 巳: '癸丁庚', 午: '癸丁庚', 未: '癸丁庚', 申: '庚丁壬', 酉: '庚丙丁', 戌: '庚甲丁壬癸', 亥: '庚丁丙戊', 子: '丁庚丙', 丑: '丁庚丙' },
  乙: { 寅: '丙癸', 卯: '丙癸', 辰: '癸丙戊', 巳: '癸', 午: '癸丙', 未: '癸丙', 申: '丙癸己', 酉: '癸丙丁', 戌: '癸辛', 亥: '丙戊', 子: '丙', 丑: '丙' },
  丙: { 寅: '壬庚', 卯: '壬己', 辰: '壬甲', 巳: '壬庚癸', 午: '壬庚', 未: '壬庚', 申: '壬戊', 酉: '壬癸', 戌: '甲壬', 亥: '甲戊庚壬', 子: '壬戊己', 丑: '壬甲' },
  丁: { 寅: '甲庚', 卯: '庚甲', 辰: '甲庚', 巳: '甲庚', 午: '壬庚癸', 未: '甲壬庚', 申: '甲庚丙戊', 酉: '甲庚丙戊', 戌: '甲庚戊', 亥: '甲庚', 子: '甲庚', 丑: '甲庚' },
  戊: { 寅: '丙甲癸', 卯: '丙甲癸', 辰: '甲丙癸', 巳: '甲丙癸', 午: '壬甲丙', 未: '癸丙甲', 申: '丙癸甲', 酉: '丙癸', 戌: '甲丙癸', 亥: '甲丙', 子: '丙甲', 丑: '丙甲' },
  己: { 寅: '丙庚甲', 卯: '甲癸丙', 辰: '丙癸甲', 巳: '癸丙', 午: '癸丙', 未: '癸丙', 申: '丙癸', 酉: '丙癸', 戌: '甲丙癸', 亥: '丙甲戊', 子: '丙甲戊', 丑: '丙甲戊' },
  庚: { 寅: '戊甲壬丙丁', 卯: '丁甲庚丙', 辰: '甲丁壬癸', 巳: '壬戊丙丁', 午: '壬癸', 未: '丁甲', 申: '丁甲', 酉: '丁甲丙', 戌: '甲壬', 亥: '丁丙', 子: '丁甲丙', 丑: '丙丁甲' },
  辛: { 寅: '己壬庚', 卯: '壬甲', 辰: '壬甲', 巳: '壬甲癸', 午: '壬己癸', 未: '壬庚甲', 申: '壬甲戊', 酉: '壬甲', 戌: '壬甲', 亥: '壬丙', 子: '丙戊壬甲', 丑: '丙壬戊己' },
  壬: { 寅: '庚丙戊', 卯: '戊辛庚', 辰: '甲庚', 巳: '壬辛庚癸', 午: '癸庚辛', 未: '辛甲', 申: '戊丁', 酉: '甲庚', 戌: '甲丙', 亥: '戊丙庚', 子: '戊丙', 丑: '丙丁甲' },
  癸: { 寅: '辛丙', 卯: '庚辛', 辰: '丙辛甲', 巳: '辛', 午: '庚辛壬癸', 未: '庚辛壬癸', 申: '丁', 酉: '辛丙', 戌: '辛甲壬癸', 亥: '庚辛戊丁', 子: '丙辛', 丑: '丙丁' }
};

// 月支基础寒热值（正为暖燥，负为寒湿）
var MONTH_HEAT = { 寅: 0, 卯: 0.5, 辰: 0.5, 巳: 1.5, 午: 2, 未: 1.5, 申: 0.5, 酉: 0, 戌: 0.5, 亥: -1.5, 子: -2, 丑: -1.5 };
var SEASON = { 寅: '春', 卯: '春', 辰: '春', 巳: '夏', 午: '夏', 未: '夏', 申: '秋', 酉: '秋', 戌: '秋', 亥: '冬', 子: '冬', 丑: '冬' };

// 气候失衡对身体的提示
var CLIMATE_HEALTH = {
  过寒: [
    { organ: '肾·循环', level: '高', reason: '命局寒湿偏重，阳气不展', advice: '注意保暖（尤其腰腹与下肢），多晒太阳、规律运动，少食生冷，谨防手脚冰凉与关节冷痛。' }
  ],
  偏寒: [
    { organ: '肾·脾胃', level: '中', reason: '命局略偏寒湿', advice: '体质偏寒，秋冬注意御寒，温热饮食为宜，坚持运动以助气血流通。' }
  ],
  偏燥: [
    { organ: '肺·皮肤', level: '中', reason: '命局略偏燥热', advice: '体质偏热，注意补水润燥，少熬夜少辛辣，留意咽喉与皮肤的小毛病。' }
  ],
  过燥: [
    { organ: '心·肝·皮肤', level: '高', reason: '命局燥热偏重，火气有余', advice: '易上火急躁，注意滋阴降火：多饮水、清淡饮食、保证睡眠，留意血压、口腔溃疡与皮肤敏感。' }
  ]
};

function analyze(ctx, t) {
  var dayGan = ctx.dayGan;
  var monthZhi = ctx.zhis[1];
  var yongStr = (TABLE[dayGan] && TABLE[dayGan][monthZhi]) || '';

  // 寒热打分：月令基础 + 盘面火水力量差
  var fire = 0;
  var water = 0;
  for (var i = 0; i < 4; i++) {
    var gwx = base.ganWx(ctx.gans[i]);
    if (gwx === '火') fire++;
    if (gwx === '水') water++;
    var zwx = base.zhiWx(ctx.zhis[i]);
    if (zwx === '火') fire++;
    if (zwx === '水') water++;
  }
  var heat = MONTH_HEAT[monthZhi] + 0.45 * (fire - water);
  var climate;
  if (heat <= -2) climate = '过寒';
  else if (heat <= -0.8) climate = '偏寒';
  else if (heat < 0.8) climate = '平和';
  else if (heat < 2) climate = '偏燥';
  else climate = '过燥';

  // 调候用神在盘中是否出现
  var yong = [];
  var firstStatus = '';
  for (var y = 0; y < yongStr.length; y++) {
    var g = yongStr.charAt(y);
    var status = '不见';
    for (var a = 0; a < 4; a++) {
      if (ctx.gans[a] === g) { status = '透干'; break; }
    }
    if (status === '不见') {
      for (var b = 0; b < 4; b++) {
        var hides = LunarUtil.ZHI_HIDE_GAN[ctx.zhis[b]];
        if (hides.indexOf(g) >= 0) { status = '藏支'; break; }
      }
    }
    if (y === 0) firstStatus = status;
    yong.push({
      gan: g,
      wx: base.ganWx(g),
      cls: base.WX_CLS[base.ganWx(g)],
      role: y === 0 ? '主' : '佐',
      status: status
    });
  }

  var deLi;
  if (firstStatus === '透干') deLi = '调候得力';
  else if (firstStatus === '藏支') deLi = '调候半得力';
  else {
    var anyTou = yong.some(function (it) { return it.status !== '不见'; });
    deLi = anyTou ? '调候稍得力' : '调候乏力';
  }

  var climateDesc = {
    过寒: '生于' + SEASON[monthZhi] + '而水寒土冻，全局寒气偏重，最需火来暖局。',
    偏寒: '命局略偏寒湿，得火则秀。',
    平和: '寒暖大体适中，气候不构成明显短板。',
    偏燥: '命局略偏燥热，得水则润。',
    过燥: '生于' + SEASON[monthZhi] + '而火炎土燥，全局燥气偏重，最需水来润局。'
  }[climate];

  var lines = [];
  lines.push('生于' + monthZhi + '月（' + SEASON[monthZhi] + '令），' + climateDesc);
  if (yong.length) {
    lines.push('《穷通宝鉴》以 ' + yong.map(function (it) { return it.gan + '（' + it.role + '）'; }).join('、') + ' 为调候用神。');
    lines.push('本局主用神' + (firstStatus === '不见' ? '未现' : firstStatus) + '，' + deLi + '。');
  }

  return {
    climate: climate,
    season: SEASON[monthZhi],
    yong: yong,
    deLi: deLi,
    lines: lines,
    healthNotes: CLIMATE_HEALTH[climate] || []
  };
}

module.exports = { analyze: analyze };
