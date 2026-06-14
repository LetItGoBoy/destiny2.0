// 批八字共用：五行生克关系与全盘加权统计
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;

var WX_LIST = ['木', '火', '土', '金', '水'];
var SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生
var KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };     // 我克
var WX_CLS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' };

// 十神分组（党羽划分用）
var GOD_GROUP = {
  比肩: '比劫', 劫财: '比劫',
  食神: '食伤', 伤官: '食伤',
  偏财: '财星', 正财: '财星',
  七杀: '官杀', 正官: '官杀',
  偏印: '印星', 正印: '印星'
};

// 地支藏干权重：本气/中气/余气
var HIDE_W = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
// 各柱地支权重：月令当权最重，日支贴身次之
var ZHI_W = [1.0, 2.0, 1.4, 1.0];

function ganWx(g) {
  return LunarUtil.WU_XING_GAN[g];
}
function zhiWx(z) {
  return LunarUtil.WU_XING_ZHI[z];
}

// 元素 x 相对日主元素 dm 的关系
function relation(dm, x) {
  if (x === dm) return '同我';
  if (SHENG[x] === dm) return '生我';
  if (SHENG[dm] === x) return '我生';
  if (KE[dm] === x) return '我克';
  return '克我';
}

// 生我之元素（反查）
function shengWoOf(dm) {
  for (var i = 0; i < WX_LIST.length; i++) {
    if (SHENG[WX_LIST[i]] === dm) return WX_LIST[i];
  }
  return '';
}
// 克我之元素（反查）
function keWoOf(dm) {
  for (var i = 0; i < WX_LIST.length; i++) {
    if (KE[WX_LIST[i]] === dm) return WX_LIST[i];
  }
  return '';
}

/**
 * 全盘加权统计
 * 天干各计 1 分；地支按柱权重 × 藏干比例摊分。
 * elem 含日主本身；same/diff（同党/异党）与十神不计日主。
 * 同时返回 detail 数组，记录每个字的来源、权重公式与得分，供页面展示计算过程。
 */
function tally(gans, zhis, dayGan) {
  var dm = ganWx(dayGan);
  var elem = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  var god = { 比肩: 0, 劫财: 0, 食神: 0, 伤官: 0, 偏财: 0, 正财: 0, 七杀: 0, 正官: 0, 偏印: 0, 正印: 0 };
  var same = 0;
  var diff = 0;
  var detail = [];
  var PLBLS = ['年', '月', '日', '时'];
  var RANKS = ['本', '中', '余'];

  var add = function (g, w, isDayMaster) {
    var wx = ganWx(g);
    elem[wx] += w;
    if (isDayMaster) return;
    god[LunarUtil.SHI_SHEN[dayGan + g]] += w;
    var rel = relation(dm, wx);
    if (rel === '同我' || rel === '生我') same += w;
    else diff += w;
  };

  for (var i = 0; i < 4; i++) {
    var isDay = i === 2;
    var g0 = gans[i];
    var wx0 = ganWx(g0);
    var rel0 = relation(dm, wx0);
    add(g0, 1.0, isDay);
    detail.push({
      pillarIdx: i,
      isGanRow: true,
      label: PLBLS[i] + '干',
      char: g0,
      cls: WX_CLS[wx0],
      godWx: isDay ? '日主' : (LunarUtil.SHI_SHEN[dayGan + g0] + '·' + wx0),
      math: isDay ? '—' : '= 1.00',
      w: isDay ? null : 1.0,
      party: isDay ? 'day' : ((rel0 === '同我' || rel0 === '生我') ? 'same' : 'diff')
    });

    var hides = LunarUtil.ZHI_HIDE_GAN[zhis[i]];
    var ws = HIDE_W[hides.length];
    for (var j = 0; j < hides.length; j++) {
      var hw = ZHI_W[i] * ws[j];
      var g1 = hides[j];
      var wx1 = ganWx(g1);
      var rel1 = relation(dm, wx1);
      add(g1, hw, false);
      detail.push({
        pillarIdx: i,
        isGanRow: false,
        label: PLBLS[i] + '支' + zhis[i] + '(' + RANKS[j] + ')',
        char: g1,
        cls: WX_CLS[wx1],
        godWx: LunarUtil.SHI_SHEN[dayGan + g1] + '·' + wx1,
        math: ZHI_W[i].toFixed(1) + '×' + ws[j].toFixed(1) + ' = ' + hw.toFixed(2),
        w: parseFloat(hw.toFixed(2)),
        party: (rel1 === '同我' || rel1 === '生我') ? 'same' : 'diff'
      });
    }
  }

  return { dm: dm, elem: elem, god: god, same: same, diff: diff, total: same + diff, detail: detail };
}

// 日主在哪些地支有根（藏干同五行）
function findRoots(zhis, dayGan) {
  var dm = ganWx(dayGan);
  var labels = ['年支', '月支', '日支', '时支'];
  var roots = [];
  for (var i = 0; i < 4; i++) {
    var hides = LunarUtil.ZHI_HIDE_GAN[zhis[i]];
    for (var j = 0; j < hides.length; j++) {
      if (ganWx(hides[j]) === dm) {
        roots.push(labels[i] + zhis[i]);
        break;
      }
    }
  }
  return roots;
}

module.exports = {
  WX_LIST: WX_LIST,
  SHENG: SHENG,
  KE: KE,
  WX_CLS: WX_CLS,
  GOD_GROUP: GOD_GROUP,
  ganWx: ganWx,
  zhiWx: zhiWx,
  relation: relation,
  shengWoOf: shengWoOf,
  keWoOf: keWoOf,
  tally: tally,
  findRoots: findRoots
};
