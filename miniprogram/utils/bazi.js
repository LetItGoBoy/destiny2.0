// 八字排盘核心
// 干支/农历/节气/大运流年流月 基于 lunar-javascript
// 子时口径：23点换日（晚子时日柱算次日，流派1）

var lunarLib = require('./lunar.js');
var Solar = lunarLib.Solar;
var Lunar = lunarLib.Lunar;
var LunarMonth = lunarLib.LunarMonth;
var LunarYear = lunarLib.LunarYear;
var LunarUtil = lunarLib.LunarUtil;
var solartime = require('./solartime.js');
var shensha = require('./shensha.js');

var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
var WX_CLS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' };
var LUNAR_MONTH_NAME = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

// 某天干在某地支上的十二长生状态（星运/自坐通用）
function changSheng(gan, zhi) {
  var offset = LunarUtil.CHANG_SHENG_OFFSET[gan];
  var gi = GAN.indexOf(gan);
  var zi = ZHI.indexOf(zhi);
  var idx = offset + (gi % 2 === 0 ? zi : -zi);
  idx = ((idx % 12) + 12) % 12;
  return LunarUtil.CHANG_SHENG[idx];
}

function ganView(gan) {
  var wx = LunarUtil.WU_XING_GAN[gan];
  return { text: gan, wx: wx, cls: WX_CLS[wx] };
}

function zhiView(zhi) {
  var wx = LunarUtil.WU_XING_ZHI[zhi];
  return { text: zhi, wx: wx, cls: WX_CLS[wx] };
}

// 地支藏干及其十神
function hideGanViews(dayGan, zhi) {
  var gans = LunarUtil.ZHI_HIDE_GAN[zhi];
  var list = [];
  for (var i = 0; i < gans.length; i++) {
    var g = gans[i];
    var wx = LunarUtil.WU_XING_GAN[g];
    list.push({ text: g, wx: wx, cls: WX_CLS[wx], shiShen: LunarUtil.SHI_SHEN[dayGan + g] });
  }
  return list;
}

// 构建一柱通用视图（大运、流年也复用）
function buildPillarView(ctx, gan, zhi, isDayPillar) {
  return {
    gan: ganView(gan),
    zhi: zhiView(zhi),
    ganZhi: gan + zhi,
    shiShenGan: isDayPillar ? '日主' : LunarUtil.SHI_SHEN[ctx.dayGan + gan],
    hideGans: hideGanViews(ctx.dayGan, zhi),
    xingYun: changSheng(ctx.dayGan, zhi),
    ziZuo: changSheng(gan, zhi),
    naYin: LunarUtil.NAYIN[gan + zhi],
    xunKong: LunarUtil.getXunKong(gan + zhi),
    shenSha: shensha.getPillarShenSha(ctx, gan, zhi, !!isDayPillar)
  };
}

/**
 * 排盘
 * @param {object} input {
 *   name, gender: 1男|0女, calendar: 'solar'|'lunar',
 *   year, month, day, hour, minute,  // 农历闰月 month 传负数
 *   province, city, lng, useTrueSolar
 * }
 */
function computeChart(input) {
  // 0. 时辰未知：内部以正午起盘（仅用于年月日柱与大运推导），不显示时柱、不做真太阳修正
  var noTime = !!input.unknownTime || input.hour == null;
  var hh = noTime ? 12 : input.hour;
  var mm = noTime ? 0 : input.minute;

  // 1. 统一换算为公历钟表时间
  var clockDate;
  if (input.calendar === 'lunar') {
    var ld = Lunar.fromYmdHms(input.year, input.month, input.day, hh, mm, 0);
    var sd = ld.getSolar();
    clockDate = new Date(sd.getYear(), sd.getMonth() - 1, sd.getDay(), hh, mm, 0);
  } else {
    clockDate = new Date(input.year, input.month - 1, input.day, hh, mm, 0);
  }

  // 2. 真太阳时修正（时辰未知时不修正）
  var useTrueSolar = !noTime && !!(input.useTrueSolar && typeof input.lng === 'number');
  var chartDate = clockDate;
  var offsetMinutes = 0;
  if (useTrueSolar) {
    var t = solartime.toTrueSolarTime(clockDate, input.lng);
    chartDate = t.date;
    offsetMinutes = t.offsetMinutes;
  }

  // 3. 起盘
  var solar = Solar.fromDate(chartDate);
  var lunar = solar.getLunar();
  var ec = lunar.getEightChar();
  ec.setSect(1); // 23点换日

  var ctx = {
    yearGan: ec.getYearGan(),
    dayGan: ec.getDayGan(),
    yearZhi: ec.getYearZhi(),
    dayZhi: ec.getDayZhi(),
    monthZhi: ec.getMonthZhi()
  };

  // 4. 四柱
  var labels = ['年柱', '月柱', '日柱', '时柱'];
  var gans = [ec.getYearGan(), ec.getMonthGan(), ec.getDayGan(), ec.getTimeGan()];
  var zhis = [ec.getYearZhi(), ec.getMonthZhi(), ec.getDayZhi(), ec.getTimeZhi()];
  var pillars = [];
  var wuXingCount = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  var pillarN = noTime ? 3 : 4; // 时辰未知则只计年月日三柱
  for (var i = 0; i < pillarN; i++) {
    var p = buildPillarView(ctx, gans[i], zhis[i], i === 2);
    p.label = labels[i];
    pillars.push(p);
    wuXingCount[p.gan.wx]++;
    wuXingCount[p.zhi.wx]++;
  }
  if (noTime) pillars.push({ label: '时柱', sub: '未知', empty: true, unknown: true });
  var wuXingList = ['木', '火', '土', '金', '水'].map(function (wx) {
    return { wx: wx, cls: WX_CLS[wx], count: wuXingCount[wx] };
  });

  // 5. 大运 / 流年 / 流月
  var yun = ec.getYun(input.gender ? 1 : 0);
  var daYunRaw = yun.getDaYun();
  var daYunList = [];
  for (var d = 0; d < daYunRaw.length; d++) {
    var dy = daYunRaw[d];
    var gz = dy.getGanZhi();
    var item = {
      index: d,
      startYear: dy.getStartYear(),
      endYear: dy.getEndYear(),
      startAge: dy.getStartAge(),
      endAge: dy.getEndAge(),
      isQian: !gz // 起运前（童限）
    };
    if (gz) {
      var pv = buildPillarView(ctx, gz.charAt(0), gz.charAt(1), false);
      for (var k in pv) item[k] = pv[k];
    } else {
      item.ganZhi = '童限';
    }
    // 流年
    var liuNianRaw = dy.getLiuNian();
    var liuNianList = [];
    for (var n = 0; n < liuNianRaw.length; n++) {
      var ln = liuNianRaw[n];
      var lgz = ln.getGanZhi();
      var lnItem = buildPillarView(ctx, lgz.charAt(0), lgz.charAt(1), false);
      lnItem.index = n;
      lnItem.year = ln.getYear();
      lnItem.age = ln.getAge();
      // 流月
      var liuYueRaw = ln.getLiuYue();
      var liuYueList = [];
      for (var m = 0; m < liuYueRaw.length; m++) {
        var ly = liuYueRaw[m];
        var ygz = ly.getGanZhi();
        liuYueList.push({
          name: ly.getMonthInChinese() + '月',
          ganZhi: ygz,
          gan: ganView(ygz.charAt(0)),
          zhi: zhiView(ygz.charAt(1)),
          shiShenGan: LunarUtil.SHI_SHEN[ctx.dayGan + ygz.charAt(0)]
        });
      }
      lnItem.liuYue = liuYueList;
      liuNianList.push(lnItem);
    }
    item.liuNian = liuNianList;
    daYunList.push(item);
  }

  // 6. 元数据
  var timeZhiName = ec.getTimeZhi() + '时';
  var meta = {
    name: input.name || '',
    gender: input.gender ? 1 : 0,
    genderText: input.gender ? '男' : '女',
    shengXiao: lunar.getYearShengXiaoByLiChun(),
    unknownTime: noTime,
    clockStr: noTime ? formatDateOnly(clockDate) + ' 时辰未知' : formatDate(clockDate),
    chartStr: formatDate(chartDate),
    timestamp: chartDate.getTime(),
    chartTime: pad(chartDate.getHours()) + ':' + pad(chartDate.getMinutes()),
    lunarStr: lunar.toString() + (noTime ? '' : ' ' + timeZhiName),
    lunarShort: lunar.getMonthInChinese() + '月' + lunar.getDayInChinese() + (noTime ? '' : ' ' + timeZhiName),
    useTrueSolar: useTrueSolar,
    offsetMinutes: offsetMinutes,
    location: (input.province || '') + (input.city && input.city !== input.province ? ' ' + input.city : ''),
    lng: input.lng,
    qiYun: '出生后' + yun.getStartYear() + '年' + yun.getStartMonth() + '个月' + yun.getStartDay() + '天起运',
    qiYunDate: yun.getStartSolar().toYmd(),
    dayGan: ctx.dayGan,
    dayGanWx: LunarUtil.WU_XING_GAN[ctx.dayGan]
  };

  return {
    meta: meta,
    pillars: pillars,
    wuXing: wuXingList,
    daYun: daYunList,
    ctx: ctx
  };
}

// 按需构建一柱完整视图（流月/流日列复用），ctx 来自 computeChart 返回
function buildLuckPillar(ctx, ganZhi) {
  if (!ganZhi || ganZhi.length < 2) return null;
  return buildPillarView(ctx, ganZhi.charAt(0), ganZhi.charAt(1), false);
}

// 计算某流年中某节气月（以流月干支匹配）的所有流日（轻量列表，供平铺）
function getLiuRi(ctx, liuYueGanZhi, year) {
  if (!liuYueGanZhi || !year) return [];
  var s = Solar.fromYmd(year, 1, 1);
  var list = [];
  var started = false;
  for (var k = 0; k < 430; k++) {
    var cur = s.next(k);
    var lun = cur.getLunar();
    if (lun.getMonthInGanZhi() === liuYueGanZhi) {
      started = true;
      var dgz = lun.getDayInGanZhi();
      list.push({
        index: list.length,
        ganZhi: dgz,
        gan: ganView(dgz.charAt(0)),
        zhi: zhiView(dgz.charAt(1)),
        shiShenGan: LunarUtil.SHI_SHEN[ctx.dayGan + dgz.charAt(0)],
        label: cur.getMonth() + '/' + cur.getDay()
      });
    } else if (started) {
      break;
    }
  }
  return list;
}

// 仅计算四柱（名人库列表用，避免整盘大运流年的开销）
function quickBaZi(input) {
  var clockDate;
  if (input.calendar === 'lunar') {
    var ld = Lunar.fromYmdHms(input.year, input.month, input.day, input.hour || 12, input.minute || 0, 0);
    var sd = ld.getSolar();
    clockDate = new Date(sd.getYear(), sd.getMonth() - 1, sd.getDay(), input.hour || 12, input.minute || 0, 0);
  } else {
    clockDate = new Date(input.year, input.month - 1, input.day, input.hour || 12, input.minute || 0, 0);
  }
  var solar = Solar.fromDate(clockDate);
  var lunar = solar.getLunar();
  var ec = lunar.getEightChar();
  ec.setSect(1);
  var gans = [ec.getYearGan(), ec.getMonthGan(), ec.getDayGan(), ec.getTimeGan()];
  var zhis = [ec.getYearZhi(), ec.getMonthZhi(), ec.getDayZhi(), ec.getTimeZhi()];
  var baZi = gans[0] + zhis[0] + ' ' + gans[1] + zhis[1] + ' ' + gans[2] + zhis[2] + ' ' + gans[3] + zhis[3];
  return { baZi: baZi, dayGan: gans[2] };
}

function formatDate(date) {
  return date.getFullYear() + '年' + pad(date.getMonth() + 1) + '月' + pad(date.getDate()) + '日 ' +
    pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function formatDateOnly(date) {
  return date.getFullYear() + '年' + pad(date.getMonth() + 1) + '月' + pad(date.getDate()) + '日';
}

// ---- 农历选择器辅助 ----

// 某农历年的月份列表（含闰月，value 闰月为负）
function getLunarMonths(year) {
  var leap = LunarYear.fromYear(year).getLeapMonth();
  var list = [];
  for (var m = 1; m <= 12; m++) {
    list.push({ label: LUNAR_MONTH_NAME[m - 1] + '月', value: m });
    if (leap === m) {
      list.push({ label: '闰' + LUNAR_MONTH_NAME[m - 1] + '月', value: -m });
    }
  }
  return list;
}

var LUNAR_DAY_NAME = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

// 某农历月的日列表
function getLunarDays(year, month) {
  var count = LunarMonth.fromYm(year, month).getDayCount();
  var list = [];
  for (var d = 1; d <= count; d++) {
    list.push({ label: LUNAR_DAY_NAME[d - 1], value: d });
  }
  return list;
}

// 把八字字符串（如 '庚午 己卯 己卯 乙亥'）转为带五行色的视图，供记录列表渲染
function colorizeBaZi(str) {
  if (!str) return [];
  return str.split(' ').map(function (gz) {
    return [ganView(gz.charAt(0)), zhiView(gz.charAt(1))];
  });
}

module.exports = {
  computeChart: computeChart,
  quickBaZi: quickBaZi,
  buildLuckPillar: buildLuckPillar,
  getLiuRi: getLiuRi,
  getLunarMonths: getLunarMonths,
  getLunarDays: getLunarDays,
  changSheng: changSheng,
  colorizeBaZi: colorizeBaZi
};
