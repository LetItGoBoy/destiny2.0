// 真太阳时修正
// 北京时间为东经120°标准时，真太阳时 = 标准时 + 经度差修正 + 均时差
// 经度差修正：每偏离东经120°一度，相差4分钟（东加西减）
// 均时差（Equation of Time）：地球公转轨道偏心率与黄赤交角引起的偏差，±16分钟以内

/**
 * 均时差（分钟），采用常用近似公式，误差约±20秒，足够排盘使用
 * @param {Date} date 公历日期
 */
function equationOfTime(date) {
  var start = new Date(date.getFullYear(), 0, 1);
  var dayOfYear = Math.floor((date - start) / 86400000) + 1;
  var b = (2 * Math.PI * (dayOfYear - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/**
 * 计算真太阳时
 * @param {Date} date 北京时间
 * @param {number} lng 出生地经度（东经为正）
 * @returns {{ date: Date, offsetMinutes: number }} 修正后时间与总修正分钟数
 */
function toTrueSolarTime(date, lng) {
  var lngMinutes = (lng - 120) * 4;
  var eot = equationOfTime(date);
  var offset = lngMinutes + eot;
  return {
    date: new Date(date.getTime() + Math.round(offset * 60) * 1000),
    offsetMinutes: Math.round(offset)
  };
}

module.exports = {
  equationOfTime: equationOfTime,
  toTrueSolarTime: toTrueSolarTime
};
