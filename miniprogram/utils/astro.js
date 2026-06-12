// 七政（日月五星）出生时刻天文位置
// 行星：JPL 近似轨道根数（Standish 1800-2050，精度约角分级，可视化足够）
// 月亮：低精度月理（主要均差项，精度约 1°）
// 古称对应：辰星=水星(水) 太白=金星(金) 荧惑=火星(火) 岁星=木星(木) 镇星=土星(土)

var DEG = Math.PI / 180;

// [a, e, I, L, ϖ, Ω] 与每儒略世纪变率
var ELEM = {
  水星: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]
  ],
  金星: [
    [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]
  ],
  地球: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]
  ],
  火星: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]
  ],
  木星: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]
  ],
  土星: [
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]
  ]
};

// 行星五行（古称）
var BODY_INFO = {
  水星: { wx: '水', cls: 'shui', ancient: '辰星' },
  金星: { wx: '金', cls: 'jin', ancient: '太白' },
  火星: { wx: '火', cls: 'huo', ancient: '荧惑' },
  木星: { wx: '木', cls: 'mu', ancient: '岁星' },
  土星: { wx: '土', cls: 'tu', ancient: '镇星' }
};

var ZODIAC = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];

function norm360(d) {
  d = d % 360;
  return d < 0 ? d + 360 : d;
}

function jdFromTs(ms) {
  return ms / 86400000 + 2440587.5;
}

function solveKepler(M, e) {
  var E = M + e * Math.sin(M);
  for (var i = 0; i < 8; i++) {
    var dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

// 日心黄道直角坐标（AU）
function helioPos(name, T) {
  var el = ELEM[name];
  var a = el[0][0] + el[1][0] * T;
  var e = el[0][1] + el[1][1] * T;
  var I = (el[0][2] + el[1][2] * T) * DEG;
  var L = (el[0][3] + el[1][3] * T) * DEG;
  var lp = (el[0][4] + el[1][4] * T) * DEG;
  var O = (el[0][5] + el[1][5] * T) * DEG;
  var w = lp - O;
  var M = L - lp;
  M = Math.atan2(Math.sin(M), Math.cos(M));
  var E = solveKepler(M, e);
  var xp = a * (Math.cos(E) - e);
  var yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  var cw = Math.cos(w), sw = Math.sin(w);
  var cO = Math.cos(O), sO = Math.sin(O);
  var cI = Math.cos(I), sI = Math.sin(I);
  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: (sw * sI) * xp + (cw * sI) * yp
  };
}

// 月亮地心黄经/黄纬（低精度）
function moonGeo(T) {
  var Lp = 218.3164477 + 481267.88123421 * T;   // 平黄经
  var D = 297.8501921 + 445267.1114034 * T;     // 平距角
  var M = 357.5291092 + 35999.0502909 * T;      // 太阳平近点角
  var Mp = 134.9633964 + 477198.8675055 * T;    // 月亮平近点角
  var F = 93.272095 + 483202.0175233 * T;       // 升交角距
  var lon = Lp +
    6.288774 * Math.sin(Mp * DEG) +
    1.274027 * Math.sin((2 * D - Mp) * DEG) +
    0.658314 * Math.sin(2 * D * DEG) +
    0.213618 * Math.sin(2 * Mp * DEG) -
    0.185116 * Math.sin(M * DEG) -
    0.114332 * Math.sin(2 * F * DEG);
  var lat = 5.128122 * Math.sin(F * DEG) +
    0.280602 * Math.sin((Mp + F) * DEG) +
    0.277693 * Math.sin((Mp - F) * DEG);
  return { lon: norm360(lon), lat: lat };
}

function zodiacOf(lon) {
  return ZODIAC[Math.floor(norm360(lon) / 30) % 12] + '座';
}

/**
 * 计算出生时刻七政布局
 * @param {number} ts 毫秒时间戳（已按真太阳时校正的排盘时刻）
 * @returns {object} { bodies: 3D 场景体, list: 七政信息列表 }
 */
function compute(ts) {
  var T = (jdFromTs(ts) - 2451545.0) / 36525.0;
  var earth = helioPos('地球', T);

  var bodies = [];
  var list = [];

  // 太阳（地心黄经 = 地球日心黄经 + 180°）
  var sunLon = norm360(Math.atan2(-earth.y, -earth.x) / DEG);
  list.push({ name: '太阳', ancient: '日', wx: '阳', cls: 'sun', lon: sunLon, lonText: sunLon.toFixed(1) + '°', zodiac: zodiacOf(sunLon) });

  // 月亮
  var moon = moonGeo(T);
  list.push({ name: '月亮', ancient: '月', wx: '阴', cls: 'moon', lon: moon.lon, lonText: moon.lon.toFixed(1) + '°', zodiac: zodiacOf(moon.lon) });

  // 五星
  var names = ['水星', '金星', '火星', '木星', '土星'];
  var helio = { 地球: earth };
  names.forEach(function (n) {
    var p = helioPos(n, T);
    helio[n] = p;
    var geoLon = norm360(Math.atan2(p.y - earth.y, p.x - earth.x) / DEG);
    var info = BODY_INFO[n];
    list.push({
      name: n, ancient: info.ancient, wx: info.wx, cls: info.cls,
      lon: geoLon, lonText: geoLon.toFixed(1) + '°', zodiac: zodiacOf(geoLon)
    });
  });

  // 3D 场景：日心系，行星带真实轨道相位
  var order = ['水星', '金星', '地球', '火星', '木星', '土星'];
  order.forEach(function (n) {
    var p = helio[n];
    var r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    bodies.push({
      name: n,
      ancient: n === '地球' ? '地' : BODY_INFO[n].ancient,
      wx: n === '地球' ? '' : BODY_INFO[n].wx,
      a: r,                                  // 实际日距（AU）
      angle: Math.atan2(p.y, p.x),           // 日心黄经（弧度）
      z: p.z / (r || 1)                      // 离面比例
    });
  });

  return { bodies: bodies, list: list, moonLon: moon.lon * DEG, moonLat: moon.lat * DEG };
}

module.exports = { compute: compute };
