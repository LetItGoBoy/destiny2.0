// 地支刑冲合害检测 —— 供「内在心性 · 心结与张力」
// 只取对心性有意义的关系：六合 / 三合（全）/ 六冲 / 六害 / 三刑（全）/ 子卯刑 / 自刑。
// 输入活跃地支（原局四支 + 岁运地支），输出去重后的张力条目，措辞取「安全感/内在动力」视角。

var LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
var LIU_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
var LIU_HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
var SAN_HE = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];
var SAN_XING = [['寅', '巳', '申'], ['丑', '戌', '未']];
var ZI_XING = ['辰', '午', '酉', '亥'];   // 自刑

var TYPE_INFO = {
  合: { cls: 'he', tag: '牵绊 · 投入',
        text: '内心有放不下的牵挂，或特别容易上心、投入的领域；随和好协调是本能，但也可能因看重某段关系而难以割舍、容易被牵住。' },
  冲: { cls: 'chong', tag: '动荡 · 求变',
        text: '内心住着两股相反的劲，安稳久了反而不踏实、想动一动；求变、不安于现状，遇事容易反复权衡、内在拉扯。' },
  刑: { cls: 'xing', tag: '内耗 · 自磨',
        text: '容易跟自己较劲、反复琢磨，把情绪往里压，到一定程度才发作；对人际摩擦比较敏感，需要学着给自己松绑。' },
  害: { cls: 'hai', tag: '暗伤 · 设防',
        text: '亲近的关系里容易受暗伤或被误解，一片好意有时换不来理解；因此对信任比较谨慎，习惯留一道防线。' }
};

var TYPE_ORDER = { 合: 0, 冲: 1, 刑: 2, 害: 3 };

/**
 * @param {Array} branches [{ zhi, label }]，label 如 年/月/日/时/大运/流年
 * @returns {Array} 按类型分组 [{ type, cls, tag, text, items:[{zhis,luck}], anyLuck }]
 */
function detect(branches) {
  var zhiSet = {};
  (branches || []).forEach(function (b) {
    if (!b || !b.zhi) return;
    (zhiSet[b.zhi] = zhiSet[b.zhi] || []).push(b.label);
  });

  // 先收集所有原子条目（去重）
  var rawRes = [], seen = {};
  function luckIn(zhis) {
    for (var i = 0; i < zhis.length; i++) {
      var ls = zhiSet[zhis[i]] || [];
      for (var j = 0; j < ls.length; j++) {
        if (ls[j] === '大运' || ls[j] === '流年') return true;
      }
    }
    return false;
  }
  function add(type, zhis) {
    var key = type + ':' + zhis.slice().sort().join('');
    if (seen[key]) return;
    seen[key] = 1;
    rawRes.push({ type: type, zhis: zhis.join(' '), luck: luckIn(zhis) });
  }

  // 六合
  Object.keys(LIU_HE).forEach(function (a) {
    var b = LIU_HE[a];
    if (zhiSet[a] && zhiSet[b]) add('合', [a, b]);
  });
  // 三合（全局）
  SAN_HE.forEach(function (tri) {
    if (tri.every(function (z) { return zhiSet[z]; })) add('合', tri);
  });
  // 六冲
  Object.keys(LIU_CHONG).forEach(function (a) {
    var b = LIU_CHONG[a];
    if (zhiSet[a] && zhiSet[b]) add('冲', [a, b]);
  });
  // 六害
  Object.keys(LIU_HAI).forEach(function (a) {
    var b = LIU_HAI[a];
    if (zhiSet[a] && zhiSet[b]) add('害', [a, b]);
  });
  // 三刑（全局）
  SAN_XING.forEach(function (tri) {
    if (tri.every(function (z) { return zhiSet[z]; })) add('刑', tri);
  });
  // 子卯相刑
  if (zhiSet['子'] && zhiSet['卯']) add('刑', ['子', '卯']);
  // 自刑（同支出现两次及以上）
  ZI_XING.forEach(function (z) {
    if (zhiSet[z] && zhiSet[z].length >= 2) add('刑', [z, z]);
  });

  // 按类型分组，每种只出一次描述
  var grouped = {}, ORDER = ['合', '冲', '刑', '害'];
  rawRes.forEach(function (r) {
    if (!grouped[r.type]) {
      var info = TYPE_INFO[r.type];
      grouped[r.type] = { type: r.type, cls: info.cls, tag: info.tag, text: info.text, items: [], anyLuck: false };
    }
    grouped[r.type].items.push({ zhis: r.zhis, luck: r.luck });
    if (r.luck) grouped[r.type].anyLuck = true;
  });

  return ORDER.filter(function (t) { return grouped[t]; }).map(function (t) { return grouped[t]; });
}

module.exports = { detect: detect };
