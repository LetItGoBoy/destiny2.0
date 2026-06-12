// 格局派：依《子平真诠》月令取格，兼论专旺/从格
var base = require('./base.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;

// 八格 + 禄刃，性格视角描述
var GE_TEXT = {
  正官格: { desc: '月令秉正官之气，以官护身、以印化官为美。', personality: '端正自律，看重名誉与规则，做事有章法、有底线，是众人信得过的人；但过于求稳时，容易放不开手脚、怕出错。' },
  七杀格: { desc: '月令秉七杀之气，贵在有制（食制、印化），化压力为权柄。', personality: '果断有魄力，抗压能力极强，越是乱局越能站出来主事，自带威严；但脾气急、出手重，需防强势树敌。' },
  正财格: { desc: '月令秉正财之气，身强能任财者富。', personality: '务实勤恳，精打细算，重信守诺，财务观念清晰，过日子的一把好手；但偏保守，面对机会时容易犹豫错失。' },
  偏财格: { desc: '月令秉偏财之气，喜身旺有比肩分担。', personality: '慷慨大方，交际面广，对机会与钱财嗅觉敏锐，善经营懂周转；但心思容易分散，用情用钱都需要专一些。' },
  食神格: { desc: '月令秉食神之气，食神生财最为流通有情。', personality: '温和乐天，懂生活、会享受，口才与品味俱佳，福气藏在从容里；但安逸过头会消磨斗志，需要一点目标感。' },
  伤官格: { desc: '月令秉伤官之气，伤官配印或生财方成大器。', personality: '聪明外露，才华横溢，敢于挑战权威、打破常规，是天生的创作者；但言辞锋利易伤人，心高气傲需收敛。' },
  正印格: { desc: '月令秉正印之气，印绶护身，最喜官星相生。', personality: '仁慈宽厚，好学深思，重情重义，长辈贵人缘佳，精神世界丰盈；但依赖心与惰性并存，行动力需要加强。' },
  偏印格: { desc: '月令秉偏印之气，枭神夺食为忌，见财制枭为宜。', personality: '思维独特，直觉与领悟力过人，偏爱冷门而有深度的领域，常有出人意料的见解；但容易孤僻多疑、想多做少。' },
  建禄格: { desc: '月令为日主临官之地，自坐强根，喜财官食伤吐秀。', personality: '自立自强，不靠祖荫，白手起家型人格，行动力与韧性兼备；但主见极强，不喜受制于人，合作需多些妥协。' },
  月刃格: { desc: '月令为日主羊刃之地，刃旺身强，喜官杀驾刃。', personality: '意志刚强，爆发力十足，关键时刻敢拼敢扛，是冲锋陷阵之才；但性烈冲动，需要官杀般的纪律来驾驭锋芒。' }
};

// 专旺格（从强）
var ZHUAN_WANG = {
  木: { name: '曲直格', personality: '木气专旺，仁心仁术，正直进取，有理想主义色彩，认准方向便一往无前；忌金来伐木，逆势则折。' },
  火: { name: '炎上格', personality: '火气专旺，热情如炬，光明磊落，感染力与行动力俱强，天生的鼓动者；忌水来激火，需防大起大落。' },
  土: { name: '稼穑格', personality: '土气专旺，厚德载物，诚信包容，沉得住气、扛得住事，是众人的定盘星；忌木来疏土，变局中宜守不宜攻。' },
  金: { name: '从革格', personality: '金气专旺，刚毅果决，重义轻利，原则性极强，乱中能断；忌火来克金，锋芒太露易伤己伤人。' },
  水: { name: '润下格', personality: '水气专旺，智虑深沉，圆融善变，顺势而为中自有大格局；忌土来塞水，最怕困守一隅。' }
};

// 从格（从弱）
var CONG_GE = {
  财星: { name: '从财格', personality: '弃命从财，务实灵活，天生亲近市场与资源，善借势经营，财缘随和气而来；忌比劫帮身夺财。' },
  官杀: { name: '从杀格', personality: '弃命从杀，纪律性强，能在强势环境中借力登高，依附明主则贵；忌印比生身反抗大势。' },
  食伤: { name: '从儿格', personality: '弃命从儿，才华横溢，表达欲与创造力旺盛，以才艺安身立命；忌印星夺食，压抑天性则滞。' }
};

function analyze(ctx, t, strength) {
  var dayGan = ctx.dayGan;
  var monthZhi = ctx.zhis[1];

  // 特殊格局优先
  if (strength.special === '从强') {
    var zw = ZHUAN_WANG[t.dm];
    return {
      name: zw.name,
      kind: '专旺格',
      how: '日主' + t.dm + '气专旺一方，全局生扶成势，弃常格而论专旺。',
      desc: zw.personality,
      personality: zw.personality
    };
  }
  if (strength.special === '从弱') {
    var grpScore = { 财星: t.god.正财 + t.god.偏财, 官杀: t.god.正官 + t.god.七杀, 食伤: t.god.食神 + t.god.伤官 };
    var top = '财星';
    if (grpScore.官杀 > grpScore[top]) top = '官杀';
    if (grpScore.食伤 > grpScore[top]) top = '食伤';
    var cg = CONG_GE[top];
    return {
      name: cg.name,
      kind: '从格',
      how: '日主无根无助，' + top + '独旺，弃命相从。',
      desc: cg.personality,
      personality: cg.personality
    };
  }

  // 月令取格：本气为比肩→建禄，劫财→月刃；否则藏干透出者为格，皆不透则以本气为格
  var hides = LunarUtil.ZHI_HIDE_GAN[monthZhi];
  var mainGod = LunarUtil.SHI_SHEN[dayGan + hides[0]];
  var name;
  var how;
  if (mainGod === '比肩') {
    name = '建禄格';
    how = '月令' + monthZhi + '为日主临官禄地，取建禄格。';
  } else if (mainGod === '劫财') {
    name = '月刃格';
    how = '月令' + monthZhi + '为日主羊刃之地，取月刃格。';
  } else {
    var picked = '';
    var pickedGan = '';
    var idx = [0, 1, 3]; // 年/月/时干
    for (var i = 0; i < hides.length && !picked; i++) {
      for (var j = 0; j < idx.length; j++) {
        if (ctx.gans[idx[j]] === hides[i]) {
          picked = LunarUtil.SHI_SHEN[dayGan + hides[i]];
          pickedGan = hides[i];
          break;
        }
      }
    }
    if (picked) {
      name = picked + '格';
      how = '月支' + monthZhi + '藏干' + pickedGan + '透出天干，以' + picked + '立格。';
    } else {
      name = mainGod + '格';
      how = '月支' + monthZhi + '藏干皆不透，以本气' + mainGod + '立格。';
    }
  }

  var txt = GE_TEXT[name] || { desc: '', personality: '' };
  return {
    name: name,
    kind: '正格',
    how: how,
    desc: txt.desc,
    personality: txt.personality
  };
}

module.exports = { analyze: analyze };
