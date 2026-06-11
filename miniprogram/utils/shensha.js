// 四柱神煞（采用主流命理通行口径）
// 查法基准：日干、年干、年支、日支、月支
// 大运、流年柱沿用原局基准查询，与主流排盘软件一致

var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 三合局分组：申子辰水局、寅午戌火局、巳酉丑金局、亥卯未木局
var SAN_HE_GROUP = {
  申: 0, 子: 0, 辰: 0,
  寅: 1, 午: 1, 戌: 1,
  巳: 2, 酉: 2, 丑: 2,
  亥: 3, 卯: 3, 未: 3
};

// 以三合局查的神煞：[水局, 火局, 金局, 木局]
var SAN_HE_SHA = [
  { name: '桃花', zhi: ['酉', '卯', '午', '子'] },
  { name: '驿马', zhi: ['寅', '申', '亥', '巳'] },
  { name: '华盖', zhi: ['辰', '戌', '丑', '未'] },
  { name: '将星', zhi: ['子', '午', '酉', '卯'] },
  { name: '劫煞', zhi: ['巳', '亥', '寅', '申'] },
  { name: '灾煞', zhi: ['午', '子', '卯', '酉'] },
  { name: '亡神', zhi: ['亥', '巳', '申', '寅'] }
];

// 以日干（天乙贵人兼以年干）查地支的神煞
var GAN_SHA = {
  天乙贵人: { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '卯巳', 癸: '卯巳', 辛: '午寅' },
  太极贵人: { 甲: '子午', 乙: '子午', 丙: '卯酉', 丁: '卯酉', 戊: '辰戌丑未', 己: '辰戌丑未', 庚: '寅亥', 辛: '寅亥', 壬: '巳申', 癸: '巳申' },
  文昌贵人: { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' },
  禄神: { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' },
  羊刃: { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' },
  金舆: { 甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' },
  红艳: { 甲: '午', 乙: '申', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' },
  国印贵人: { 甲: '戌', 乙: '亥', 丙: '丑', 丁: '寅', 戊: '丑', 己: '寅', 庚: '辰', 辛: '巳', 壬: '未', 癸: '申' }
};

// 以年支查的神煞
var GU_CHEN = { 亥: '寅', 子: '寅', 丑: '寅', 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥' };
var GUA_SU = { 亥: '戌', 子: '戌', 丑: '戌', 寅: '丑', 卯: '丑', 辰: '丑', 巳: '辰', 午: '辰', 未: '辰', 申: '未', 酉: '未', 戌: '未' };
var HONG_LUAN = { 子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌', 午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰' };

// 天德贵人：以月支查干或支
var TIAN_DE = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
// 月德贵人：以月支三合局查干 [水, 火, 金, 木]
var YUE_DE = ['壬', '丙', '庚', '甲'];

// 特殊日柱
var KUI_GANG = { 庚辰: 1, 庚戌: 1, 壬辰: 1, 戊戌: 1 };
var YIN_CHA_YANG_CUO = {
  丙子: 1, 丁丑: 1, 戊寅: 1, 辛卯: 1, 壬辰: 1, 癸巳: 1,
  丙午: 1, 丁未: 1, 戊申: 1, 辛酉: 1, 壬戌: 1, 癸亥: 1
};

function tianXi(yearZhi) {
  // 天喜为红鸾对冲之支
  var luan = HONG_LUAN[yearZhi];
  return ZHI[(ZHI.indexOf(luan) + 6) % 12];
}

/**
 * 查某一柱的神煞
 * @param {object} ctx 原局基准 { yearGan, dayGan, yearZhi, dayZhi, monthZhi }
 * @param {string} gan 该柱天干
 * @param {string} zhi 该柱地支
 * @param {boolean} isDayPillar 是否为原局日柱（魁罡、阴差阳错仅日柱论）
 * @returns {string[]} 神煞名称列表
 */
function getPillarShenSha(ctx, gan, zhi, isDayPillar) {
  var list = [];

  // 天德、月德（以月支查，贵人类放最前）
  var td = TIAN_DE[ctx.monthZhi];
  if (td && (gan === td || zhi === td)) list.push('天德贵人');
  var yd = YUE_DE[SAN_HE_GROUP[ctx.monthZhi]];
  if (gan === yd) list.push('月德贵人');

  // 以日干查（天乙、太极贵人兼以年干查）
  for (var name in GAN_SHA) {
    var table = GAN_SHA[name];
    var hit = table[ctx.dayGan] && table[ctx.dayGan].indexOf(zhi) > -1;
    if (!hit && (name === '天乙贵人' || name === '太极贵人')) {
      hit = table[ctx.yearGan] && table[ctx.yearGan].indexOf(zhi) > -1;
    }
    if (hit) list.push(name);
  }

  // 以年支、日支三合局查
  for (var i = 0; i < SAN_HE_SHA.length; i++) {
    var sha = SAN_HE_SHA[i];
    if (zhi === sha.zhi[SAN_HE_GROUP[ctx.yearZhi]] || zhi === sha.zhi[SAN_HE_GROUP[ctx.dayZhi]]) {
      list.push(sha.name);
    }
  }

  // 以年支查
  if (zhi === GU_CHEN[ctx.yearZhi]) list.push('孤辰');
  if (zhi === GUA_SU[ctx.yearZhi]) list.push('寡宿');
  if (zhi === HONG_LUAN[ctx.yearZhi]) list.push('红鸾');
  if (zhi === tianXi(ctx.yearZhi)) list.push('天喜');

  // 特殊日柱
  if (isDayPillar) {
    if (KUI_GANG[gan + zhi]) list.push('魁罡');
    if (YIN_CHA_YANG_CUO[gan + zhi]) list.push('阴差阳错');
  }

  return list;
}

module.exports = {
  getPillarShenSha: getPillarShenSha
};
