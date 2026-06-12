// 详批总调度：旺衰定喜忌、调候看寒燥、格局观人格，三派合参
var base = require('./base.js');
var strengthMod = require('./strength.js');
var tiaohouMod = require('./tiaohou.js');
var gejuMod = require('./geju.js');
var healthMod = require('./health.js');
var characterMod = require('./character.js');

/**
 * @param {object} chart bazi.computeChart 的返回值
 */
function analyze(chart) {
  var gans = chart.pillars.map(function (p) { return p.gan.text; });
  var zhis = chart.pillars.map(function (p) { return p.zhi.text; });
  var ctx = {
    gans: gans,
    zhis: zhis,
    dayGan: chart.meta.dayGan,
    gender: chart.meta.gender
  };

  var t = base.tally(gans, zhis, ctx.dayGan);
  var wangShuai = strengthMod.analyze(ctx, t);
  var tiaoHou = tiaohouMod.analyze(ctx, t);
  var geJu = gejuMod.analyze(ctx, t, wangShuai);
  var jianKang = healthMod.analyze(ctx, t, tiaoHou);
  var xingGe = characterMod.analyze(ctx, t, wangShuai, geJu, jianKang.status);

  // 总评
  var summary = '日主' + ctx.dayGan + '（' + t.dm + '），' +
    (wangShuai.special ? wangShuai.special + '之局' : wangShuai.level) + '，取' + geJu.name + '；' +
    '气候' + tiaoHou.climate + '，' + tiaoHou.deLi + '。';
  if (wangShuai.xiYong.length) {
    summary += '喜用在' + wangShuai.xiYong.map(function (c) { return c.wx; }).join('、') + '。';
  }

  return {
    summary: summary,
    wangShuai: wangShuai,
    tiaoHou: tiaoHou,
    geJu: geJu,
    xingGe: xingGe,
    jianKang: jianKang
  };
}

module.exports = { analyze: analyze };
