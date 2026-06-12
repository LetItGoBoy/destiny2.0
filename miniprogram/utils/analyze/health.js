// 健康提示：五行配五脏 + 过旺受克 + 地支六冲 + 调候寒燥
// 仅作传统命理视角的养生参考，不构成医学建议
var base = require('./base.js');

var ORGAN = {
  木: {
    organ: '肝胆',
    parts: '头颈、四肢、筋络、眼睛、神经',
    weak: '木气不足，肝胆系统先天偏弱：易眼涩眼疲劳、筋骨柔韧性差、情绪易郁结不舒。',
    strong: '木气过旺，肝火易亢：注意偏头痛、易怒烦躁、睡眠浅、眼压偏高等肝阳上亢之象。',
    advice: '早睡以养肝血，多做拉伸舒展，戒怒少酒，常望远放松双眼。'
  },
  火: {
    organ: '心·小肠',
    parts: '血液循环、血压、舌、面部',
    weak: '火气不足，心阳偏弱：易手脚冰凉、面色少华、血压偏低、精神不振、循环不畅。',
    strong: '火气过旺，心火易炎：注意口舌生疮、心悸失眠、血压波动、面部痤疮等上火之象。',
    advice: '规律作息以护心，适度有氧运动促循环，少辛辣刺激，午间小憩养心气。'
  },
  土: {
    organ: '脾胃',
    parts: '消化系统、肌肉、口唇',
    weak: '土气不足，脾胃运化偏弱：易食欲不稳、腹胀便溏、消瘦或虚胖、思虑伤脾。',
    strong: '土气过旺，脾胃负担偏重：注意湿气重、身体困重、体重易增、消化迟滞。',
    advice: '三餐定时、细嚼慢咽，少食生冷甜腻，饭后散步以助运化。'
  },
  金: {
    organ: '肺·大肠',
    parts: '呼吸道、皮肤、鼻咽',
    weak: '金气不足，肺卫偏弱：易感冒咳嗽、鼻咽敏感、皮肤干燥过敏、气短乏力。',
    strong: '金气过旺，燥气伤津：注意干咳便秘、皮肤问题、悲忧情绪偏多。',
    advice: '常做深呼吸与有氧锻炼，留意空气质量，秋燥时节多润肺生津之品。'
  },
  水: {
    organ: '肾·膀胱',
    parts: '泌尿生殖、腰膝、骨、耳',
    weak: '水气不足，肾气偏弱：易腰膝酸软、耳鸣健忘、泌尿系统敏感、易显疲态。',
    strong: '水气过旺，寒湿偏盛：注意水肿、畏寒、夜尿偏多、肾系统负担。',
    advice: '腰腹下肢注意保暖，不过度熬夜耗肾精，适量饮水、勿憋尿。'
  }
};

// 地支六冲对应的脏腑扰动
var CHONG_NOTES = {
  子午: { organ: '心·肾', reason: '子午相冲，水火交战，心肾不交', advice: '重点关注睡眠质量、心律与血压，情绪大起大落时尤需静养。' },
  丑未: { organ: '脾胃', reason: '丑未相冲，土气受震', advice: '消化系统易敏感，饮食宜规律清淡，少暴饮暴食。' },
  寅申: { organ: '肝胆·肠胃', reason: '寅申相冲，木金相战', advice: '注意四肢筋骨损伤与肝胆肠胃的小毛病，出行多留意安全。' },
  卯酉: { organ: '肝·肺', reason: '卯酉相冲，金木交战', advice: '肝肺气机易受扰，注意筋骨扭伤与呼吸道，保持情绪舒畅。' },
  辰戌: { organ: '脾胃·皮肤', reason: '辰戌相冲，燥湿相激', advice: '脾胃与皮肤易敏感，忌饮食无度，护好肠胃屏障。' },
  巳亥: { organ: '心血管·泌尿', reason: '巳亥相冲，水火互激', advice: '注意心血管与泌尿循环系统，冷热交替时节多加小心。' }
};

var LEVEL_ORDER = { 高: 0, 中: 1, 低: 2 };

function analyze(ctx, t, tiaoHou) {
  var items = [];
  var sum = 0;
  var wx;
  for (wx in t.elem) sum += t.elem[wx];

  // 可见干支计数（判"缺"）
  var visible = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (var i = 0; i < 4; i++) {
    visible[base.ganWx(ctx.gans[i])]++;
    visible[base.zhiWx(ctx.zhis[i])]++;
  }

  // 各元素状态
  var status = {};
  base.WX_LIST.forEach(function (w) {
    var share = sum > 0 ? t.elem[w] / sum : 0.2;
    if (visible[w] === 0 && share < 0.06) status[w] = '缺';
    else if (share < 0.12) status[w] = '偏弱';
    else if (share <= 0.28) status[w] = '适中';
    else if (share <= 0.38) status[w] = '偏旺';
    else status[w] = '过旺';
  });

  base.WX_LIST.forEach(function (w) {
    var o = ORGAN[w];
    if (status[w] === '缺') {
      items.push({ organ: o.organ, wx: w, cls: base.WX_CLS[w], level: '高', reason: '五行缺' + w + '。' + o.weak, advice: o.advice, parts: o.parts });
    } else if (status[w] === '偏弱') {
      items.push({ organ: o.organ, wx: w, cls: base.WX_CLS[w], level: '中', reason: w + '气偏弱。' + o.weak, advice: o.advice, parts: o.parts });
    } else if (status[w] === '过旺') {
      items.push({ organ: o.organ, wx: w, cls: base.WX_CLS[w], level: '中', reason: w + '气过旺。' + o.strong, advice: o.advice, parts: o.parts });
      // 被它克的元素受累
      var target = base.KE[w];
      var to = ORGAN[target];
      var lvl = (status[target] === '缺' || status[target] === '偏弱') ? '高' : '中';
      items.push({
        organ: to.organ, wx: target, cls: base.WX_CLS[target], level: lvl,
        reason: w + '旺而克' + target + '，' + to.organ + '首当其冲。' + to.weak,
        advice: to.advice, parts: to.parts
      });
    }
  });

  // 地支六冲
  var pairs = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
  pairs.forEach(function (p) {
    var a = p.charAt(0);
    var b = p.charAt(1);
    if (ctx.zhis.indexOf(a) >= 0 && ctx.zhis.indexOf(b) >= 0) {
      var n = CHONG_NOTES[p];
      items.push({ organ: n.organ, wx: '', cls: '', level: '中', reason: n.reason + '。', advice: n.advice, parts: '' });
    }
  });

  // 调候寒燥
  (tiaoHou.healthNotes || []).forEach(function (n) {
    items.push({ organ: n.organ, wx: '', cls: '', level: n.level, reason: n.reason + '。', advice: n.advice, parts: '' });
  });

  // 同脏腑去重（先按等级排序，保留最高的一条）
  var seen = {};
  var deduped = [];
  items.sort(function (a, b) { return LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]; });
  items.forEach(function (it) {
    if (seen[it.organ]) return;
    seen[it.organ] = true;
    deduped.push(it);
  });

  if (!deduped.length) {
    deduped.push({
      organ: '整体', wx: '', cls: '', level: '低',
      reason: '五行大体均衡，无明显先天短板。',
      advice: '体质底子较稳，保持规律作息与适度运动即可。', parts: ''
    });
  }

  return { status: status, items: deduped };
}

module.exports = { analyze: analyze };
