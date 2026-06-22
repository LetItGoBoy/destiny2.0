// 性格画像（外显·天干版）
// 大部分人身上都有不止一种心性，只是配比不同。
// 「两种底色」（守正/求变）取天干地支所有十神（含藏干）统计；
// 「心性构成」取天干（最外显的一层）的十神，每种心性以一条优点(左)←→缺点(右)的轴呈现：
//   方向（偏优/偏缺）随身强身弱而定，幅度 = 失衡度 |P-50|×2 × 该心性在天干的相对能量，
//   故各心性会随大运/流年各自此消彼长，而非同步。措辞保持中立、收敛。
var energy = require('./energy.js');
var base = require('./base.js');
var relations = require('./relations.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;

// ── 占比决策树：全池五行占比 → 每个五行 喜(+,左)/忌(-,右) ──
var WX = ['木', '火', '土', '金', '水'];
function wxIdx(e) { return WX.indexOf(e); }
function shengI(i) { return (i + 1) % 5; }   // e 生 的对象
function keI(i) { return (i + 2) % 5; }       // e 克 的对象

// 相对日主的党派（比劫/食伤/财/官杀/印）
function partyGod(dmEl, e) {
  var di = wxIdx(dmEl), ei = wxIdx(e);
  if (ei === di) return '比劫';
  if (ei === shengI(di)) return '食伤';
  if (ei === keI(di)) return '财';
  if (ei === (di + 3) % 5) return '官杀';
  return '印';
}

// p: {木:pct,...}；dmEl 日主五行；rootEls: {五行:1} 有本气根的五行集合
// 返回 { dir:{木:'+'/'-',...}, mode, disease }
function decideXiji(p, dmEl, rootEls) {
  rootEls = rootEls || {};
  var top = WX[0];
  WX.forEach(function (e) { if (p[e] > p[top]) top = e; });
  var dir = {}, mode, disease = null;

  if (p[top] >= 40) {
    // 病重型：围绕病 D 的生克五位
    mode = '病重';
    disease = top;
    var D = top, di = wxIdx(D), diseaseIsBi = (partyGod(dmEl, D) === '比劫');
    var bodyWeak = (p[dmEl] < p[top]) && !diseaseIsBi;
    WX.forEach(function (e) {
      var i = wxIdx(e), v;
      if (e === D) v = '-';                                   // 病本身
      else if (shengI(i) === di) v = '-';                     // 生病：喂病
      else if (keI(i) === di) v = '+';                        // 克病：药
      else if (shengI(di) === i) {                            // 病生：泄口
        if (diseaseIsBi) v = '+';                             // 身旺泄秀
        else if ((partyGod(dmEl, e) === '官杀' || partyGod(dmEl, e) === '食伤') && bodyWeak) v = '-'; // 攻弱身
        else v = '+';
      } else if (keI(di) === i) {                             // 病克：受害者
        v = (p[e] >= 20 && rootEls[e]) ? '+' : '-';          // 有根且能量够→反制成格
      } else v = '-';
      dir[e] = v;
    });
  } else {
    // 均衡型：看体 = 食伤 + 比劫
    var ti = 0;
    WX.forEach(function (e) { var g = partyGod(dmEl, e); if (g === '食伤' || g === '比劫') ti += p[e]; });
    if (ti >= 40) {
      mode = '体旺';   // 喜财官印，忌食伤比劫
      WX.forEach(function (e) { var g = partyGod(dmEl, e); dir[e] = (g === '财' || g === '官杀' || g === '印') ? '+' : '-'; });
    } else {
      mode = '体弱';   // 喜比劫印，忌财官食伤
      WX.forEach(function (e) { var g = partyGod(dmEl, e); dir[e] = (g === '比劫' || g === '印') ? '+' : '-'; });
    }
  }
  return { dir: dir, mode: mode, disease: disease };
}

// 滑标位置：喜(+)→左、忌(-)→右；强度 = |占比−20| 限幅 [0,25] → 钳到 [25%,75%]
function sliderPos(d, pct) {
  var mag = Math.min(25, Math.round(Math.abs(pct - 20) * 1.2));
  if (d === '+') return 50 - mag;
  if (d === '-') return 50 + mag;
  return 50;
}

// 全盘地支（原局+岁运）有本气根的五行集合
function rootElsOf(chart, opts) {
  var s = {};
  function add(zhi) { if (!zhi) return; s[base.ganWx(LunarUtil.ZHI_HIDE_GAN[zhi][0])] = 1; }
  chart.pillars.forEach(function (p) { if (!p.empty && p.zhi) add(p.zhi.text); });
  if (opts.daYunGZ && opts.daYunGZ.length >= 2) add(opts.daYunGZ.charAt(1));
  if (opts.liuNianGZ && opts.liuNianGZ.length >= 2) add(opts.liuNianGZ.charAt(1));
  return s;
}

// 十神 → 地支「内在心性」文案（安全感 / 内在驱动力视角；与天干外显文案区分）
var INNER = {
  比肩: '骨子里要强、不服输，凡事先在心里有了判断才动，自尊扎得很深。独立自主是本能，重平等也重边界，不爱欠人情、不喜欢被人硬压着走，守得住自己的付出与积累；只是对公平和被占便宜比较敏感，也不太愿意主动示弱。',
  劫财: '内心有股不肯认输的冲劲，胜负感强、容易被气氛点燃，渴望被看见、被认可。很讲义气、重朋友，愿意为圈子出头，行动的底气往往来自身边人；只是情绪上来时容易上头、冲动，也容易为人情替别人扛事、被关系牵着走。',
  食神: '内心向往轻松自在，知足、重感受，安全感来自衣食无忧与被善待。待人厚道宽和、体谅别人，对喜欢的事愿意慢慢投入、持续做下去，不喜欢被逼着赶着走；只是容易心软、边界不够硬，日子舒坦了动力也会跟着松下来。',
  伤官: '内心藏着表达和被欣赏的渴望，聪明、有判断，不甘平庸、想活出自己。重自由、重欣赏，不喜欢被人情绑住，也看不上低水平的消耗，越被框住越想挣脱；只是锋芒难收时容易骄傲、不留余地，对自己和别人都要求偏高。',
  偏财: '内心活络、看得开，机会感强、眼光灵活，安全感来自资源与人脉的流动。为人豪爽大方、不计较，喜欢热闹和机会，能把关系和事情分开看，对得失拿得起放得下；只是欲望容易过强、边界偏松，精力和资源都容易铺得太散。',
  正财: '内心求稳务实，现实感强、重确定的回报，安全感来自踏实的积累与可掌控的生活。重责任、重承诺，边界清楚，愿意为长期的人和事持续投入，不太愿意冒没把握的险；只是太看重得失时容易显得保守、计较。',
  七杀: '内心压着股危机感与狠劲，警觉性高、习惯从压力的角度看问题，越有压力越能逼出潜力。欣赏强者、重实力与气场，遇到难题反而被激发；只是容易紧绷、多疑，习惯自我加压、跟自己较劲，需要学着给这股劲松松弦。',
  正官: '内心有一把尺，重秩序、重责任，自我要求高，安稳感来自规则与被认可。为人得体、有分寸，在意身份与体面，做事讲交代、讲结果；只是太在意评价时容易顾虑重重、怕越界、怕出错，思前想后，不太敢表达真实的不满。',
  偏印: '内心敏感、好琢磨，喜欢自己搭一套理解方式，安全感来自独处与精神世界。边界感强、精神空间需求高，不喜欢太黏太浅的关系，凡事先在心里过一遍才放心；只是容易想得太深、把简单的事复杂化，也容易显得孤僻、让人猜不透。',
  正印: '内心渴望被理解与庇护，重情义、重长期积累，安全感来自亲情、归属与依靠。为人温和有礼、包容照顾，愿意维持稳定与和气，习惯先接受再消化；只是容易过度理解别人而委屈自己，行动偏慢，也容易为了不冲突而藏起真实态度。'
};

// 十神 → 外显心性（name 心性名，pol 正/偏，lbl 左端顺，rbl 右端偏，desc 综合特质描述）
var TEMP = {
  比肩: { name: '自立', pol: '正', lbl: '自强果断', rbl: '据理力争',
          desc: '刚健果断、有毅力，不服输、勤奋努力，自我意识强、执行力好，做事靠得住；只是自尊心强、爱面子，认准的事容易据理力争，有时显得死板、多疑，偶尔说话不经思量。' },
  劫财: { name: '果敢', pol: '偏', lbl: '豪爽直率', rbl: '多疑挑剔',
          desc: '自信豪爽、热情直率，不怕困难、敢于竞争，口才好、朋友多，义气足、说做就做；只是容易多疑、对人挑剔，虚荣心强、有时爱攀比，在意外在评价，偶尔会为面子得不偿失。' },
  食神: { name: '从容', pol: '正', lbl: '温和乐善', rbl: '好逸恶劳',
          desc: '温和斯文、思维细腻，宽容善良、乐于奉献，人缘好、有人文情怀，生活里自带一份福气与从容；只是容易爱幻想、想得多做得少，自尊心强时不肯放下架子，日子舒坦了也容易好逸恶劳。' },
  伤官: { name: '锋芒', pol: '偏', lbl: '聪慧灵动', rbl: '恃才傲物',
          desc: '聪明、悟性高，才华横溢、创新能力强，表现欲足、个人魅力突出，追求完美、向往自由；只是锋芒难收时容易恃才傲物、争强好胜，不服管束、爱出风头，热情来得快去得也快，自律上常要费些力气。' },
  偏财: { name: '灵活', pol: '偏', lbl: '豁达大方', rbl: '用心不专',
          desc: '热情豁达、情商高，大方重义、善于交际，处事灵活、拿得起放得下，人缘好、广结善缘；只是欲望容易过强，有时不够克制，精力铺得太散难以专注，对感情和事业都偏向见异思迁。' },
  正财: { name: '务实', pol: '正', lbl: '踏实稳健', rbl: '锱铢必较',
          desc: '勤俭踏实、感情专一，守本分、不惹事，注重细节、善于理财，情绪感知细腻、现实而可靠；只是太过在意得失时容易显得保守小气，凡事计较、缺乏进取，求稳有余而开拓不足。' },
  七杀: { name: '开拓', pol: '偏', lbl: '果敢担当', rbl: '胆大妄为',
          desc: '有魄力、机警伶俐，目标感强、思维缜密，敢想敢干、善于谋略，做事有手段、务实果决；这股劲一旦走偏，容易多疑多虑、好斗冲动，或贪图捷径、行事胆大妄为不计后果，有时也可能走向另一面，变得瞻前顾后、内心纠结内耗。' },
  正官: { name: '自律', pol: '正', lbl: '稳健自律', rbl: '多虑悲观',
          desc: '自律、做事稳健，善于思考、有管理能力，遵守规矩、为人公道，责任心强、值得托付；只是太在意规则时容易悲观多虑，思前想后、不善变通，有时显得胆小怕事、意志不够坚定。' },
  偏印: { name: '钻研', pol: '偏', lbl: '精明善察', rbl: '多疑孤僻',
          desc: '思维独特、领悟力强，善于观察细节、警觉性高，好钻研、有创造力，安静独处时最出灵感；只是想得多了容易向内收，显得孤独不合群，心思深的同时也偏多疑，有时会钻进牛角尖里难以自拔。' },
  正印: { name: '宽厚', pol: '正', lbl: '仁慈善良', rbl: '优柔寡断',
          desc: '仁慈、心地善良，安静平和、有同情心，有修养、有智慧，注重内涵、有精神追求，是让人愿意靠近的温暖；只是容易懒惰、行动力偏弱，依赖性强，有时不思进取，优柔寡断、难下决心。' }
};

// 十神 → 人生阶段「主旋律」（该柱天干在那段岁月的着力点；软措辞，不作硬性预测）
var STAGE = {
  比肩: '主旋律是靠自己站稳。这一程更想凡事自己拿主意、亲力亲为，做事有执行力、能扛事，节奏稳、不冒进；重平等也重边界，不爱欠人情、不喜欢被硬压着走，靠一点点积累守住属于自己的东西。只是启动偏慢，变化来得太快时容易跟不上。',
  劫财: '主旋律是敢闯敢拼、人来人往。这一程胜负心强、反应快，敢冒险也敢顶事，做事果断、有爆发力；重朋友、讲义气，愿意为人出头，圈子感强，资源和机会来去都快。只是容易上头、用力过猛，也容易为人情冲动、替别人扛事。',
  食神: '主旋律是顺势而为、张弛有度。这一程节奏偏舒缓，知足、重感受，不爱紧绷也不喜欢硬抢，擅长把能力慢慢变成内容、服务与口碑；待人厚道宽和、好相处，福气往往不请自来。只是动力容易不足，遇到强竞争时不够主动，也容易图舒坦而拖延。',
  伤官: '主旋律是想突破、想被看见。这一程聪明、反应快，表达力和创造力都强，敢说真话、敢打破旧方式，靠才华、技术与个人魅力出头，最有棱角也最敢表达；重自由、重欣赏，不喜欢被人情和僵化规则绑住。只是锋芒难收时容易骄傲、不留余地，和权威、制度容易起冲突。',
  偏财: '主旋律是机会多、人脉广。这一程眼光灵活、机会感强，善于在变化里找收益，敢试敢投、灵活切换；为人豪爽大方、不计较，能把关系和事情分开看，靠人脉、渠道与资金取势，钱财与缘分来去都比较活络。只是容易高估机会、押得太大，资源进出快、留存不稳。',
  正财: '主旋律是踏实积累、稳扎稳打。这一程现实感强、重确定的回报，做事踏实本分、按计划推进，适合长期经营、慢慢攒下家底；重责任、重承诺，边界清楚，会管钱也守得住成果。只是节奏偏稳、变化感不足，太在意得失时容易显得保守、计较。',
  七杀: '主旋律是压力与机遇并存。这一程危机感强、警觉性高，遇到压力和难题反而更被激发，果断敢冲、敢担事，擅长在复杂局面里抢出空间；欣赏强者、重实力与气场，扛得住时往往也是成长最快的阶段。只是容易紧绷、急躁、用力过猛，需要规则和分寸来约束这股劲。',
  正官: '主旋律是重规矩、担责任。这一程看重秩序、身份与社会认可，做事稳重、按流程推进，愿意承担正式的角色，讲标准、讲交代、讲结果；为人温和得体、有分寸，靠自律和口碑一步步往上走。只是容易顾虑评价、怕越界，行动前思前想后，突破力偏弱。',
  偏印: '主旋律是向内沉淀、钻研专精。这一程靠独立判断和非标准的专长立身，喜欢自己搭一套理解方式，适合用技术、研究或特殊经验打开局面；话不多、边界感强，精神空间需求高，独处时反而最有灵感。只是容易想得太深、多思少动，也容易显得孤僻、不近人情。',
  正印: '主旋律是有庇护、重学习。这一程走正统路径、重基础与长期积累，常得师长、贵人之助，靠信誉与情义在平台和体系里稳稳成长；为人温和有礼、包容照顾，给人安全感。只是行动偏慢、准备过多，容易依赖既有框架，也容易为了不冲突而委屈自己。'
};

// 十神 → 该阶段「内心」一句话（地支本气，简短）
var STAGE_INNER = {
  比肩: '内心要强，想掌握主动',
  劫财: '内心好胜，看重同伴',
  食神: '内心向往轻松自在',
  伤官: '内心不甘平庸、想被看见',
  偏财: '内心活络，看重情义与机会',
  正财: '内心求稳，在意踏实安稳',
  七杀: '内心有压力感，习惯自我加压',
  正官: '内心重规矩，在意对错',
  偏印: '内心好静，爱琢磨',
  正印: '内心念旧，渴望依靠与被理解'
};

// 四柱 → 人生阶段（宫位/分限）
var STAGE_META = {
  年柱: { label: '少年', sub: '出身 · 童年根基' },
  月柱: { label: '青年', sub: '求学 · 事业起步' },
  日柱: { label: '中年', sub: '立身 · 婚姻家庭' },
  时柱: { label: '晚年', sub: '子女 · 晚景归宿' }
};

// 日主天干 → 外在底色（第一印象）
var CORE = {
  甲: { title: '甲木 · 栋梁', text: '像向上生长的大树，第一印象正直、有方向感，认定的事愿意一路扛到底；自带带头的气场。' },
  乙: { title: '乙木 · 藤蔓', text: '像柔韧的花草藤蔓，温和、有弹性，懂得借力与迂回；待人细腻，适应环境的本事很强。' },
  丙: { title: '丙火 · 太阳', text: '像正午的阳光，热情、外放、有感染力，走到哪儿都自带光和热；情绪来得快，也藏不住。' },
  丁: { title: '丁火 · 灯烛', text: '像温暖的灯火，外表温和、内里有光，善于照顾人、洞察人心；安静处事，却很有存在感。' },
  戊: { title: '戊土 · 高山', text: '像厚重的山岳，沉稳、可靠、有包容度，是旁人眼里能托付的那一个；变动面前偏稳健。' },
  己: { title: '己土 · 沃土', text: '像温润的田园，低调、随和、会成全人，心思细密、滋养力强；不爱张扬，韧性藏在里头。' },
  庚: { title: '庚金 · 利刃', text: '像刚硬的钢铁，干脆、果断、讲原则，执行力强、说到做到；锋芒在外，直来直往。' },
  辛: { title: '辛金 · 珠玉', text: '像精致的珠玉，审美好、有分寸、重质感，敏感而要强；在意细节，也在意被怎样对待。' },
  壬: { title: '壬水 · 江河', text: '像奔流的大江，聪明、豪爽、点子多，胸襟开阔、行动快；喜欢自由，不爱被框住。' },
  癸: { title: '癸水 · 雨露', text: '像细润的雨露，安静、聪慧、直觉准，温柔又有渗透力；心思深，外柔而内里有韧劲。' }
};

// 十神 → 流年专用文案（讲当年的状态/想法/行为，区别于贯穿一生的性格词）
// pol 正/偏；lbl 顺端词(喜·左)、rbl 偏端词(忌·右)；desc 顺/偏都写出 + 宜做的事
var LIUNIAN = {
  比肩: { pol: '正', lbl: '自立合伙', rbl: '较劲破费',
    desc: '顺时，自己拿主意、行动独立，朋友走动多、爱热闹，合伙搭伙做事得力；走偏时，爱较劲和人争高下，讲义气替人扛事，钱财容易被分、为朋友破费。宜：找搭档合伙立事、靠自己推进，账目算清、别替人担保。' },
  劫财: { pol: '偏', lbl: '敢拼旺人脉', rbl: '冲动破财',
    desc: '顺时，敢闯敢拼、行动快，朋友帮衬、人脉来财，气氛一来就上；走偏时，冲动消费、合伙吃亏，爱攀比，易被借钱、动赌念，钱来钱去留不住。宜：借人脉团队作战去开拓，管住冲动消费，远离赌与大额借出。' },
  食神: { pol: '正', lbl: '松快有福', rbl: '贪玩懒散',
    desc: '顺时，心态放松、日子有滋味，吃喝玩乐有福气，才艺、表达、口碑都顺；走偏时，贪图享受、爱吃爱喝爱玩，懒散拖延、动力不足，容易把正事放一边。宜：学才艺、做内容、慢工出细活，顺带调养身体，给自己定个小目标别全玩没了。' },
  伤官: { pol: '偏', lbl: '才华出彩', rbl: '傲气口舌',
    desc: '顺时，才华迸发、点子多，敢秀敢说敢闯，技艺长进、个人魅力足；走偏时，恃才傲物、爱抬杠顶撞上司，口无遮拦惹口舌，玩心重静不下来，锋芒太露得罪人。宜：把才华变成作品、技术、表达，考证学新技能，少争对错、对上级客气、管住嘴。' },
  偏财: { pol: '偏', lbl: '财路人脉广', rbl: '投机散财',
    desc: '顺时，财路广、生意活络，交际带来机会，出手大方、说做就做；走偏时，爱投机押得太大，应酬酒色多，钱进得快散也快，感情上易分心。宜：拓业务、做副业、结交资源灵活变现，别投机押大、控住应酬开销。' },
  正财: { pol: '正', lbl: '稳进顾家', rbl: '计较操劳',
    desc: '顺时，进财稳、勤快务实，懂攒钱、有责任心，把日子经营得有条理；走偏时，太抠太计较、为钱操劳，舍不得花也不敢闯，患得患失。宜：踏实积累、理财存钱、长期经营，该花的别太省，适度为机会投入。' },
  七杀: { pol: '偏', lbl: '闯劲担当', rbl: '焦躁冒险',
    desc: '顺时，闯劲足、扛得住事，敢决断、有魄力，常得权威或贵人推一把，是成长快的一年；走偏时，紧张焦虑、易冲动好斗，爱铤而走险、动赌性，惹是非或要防伤病。宜：去攻坚、扛项目、健身竞技，借压力成长、找平台权威背书，别赌别担保，注意安全与休息。' },
  正官: { pol: '正', lbl: '名分上进', rbl: '拘谨压力',
    desc: '顺时，名正言顺、易得提拔认可，做事有章法、守规矩，地位口碑往上走；走偏时，顾虑多、怕担责怕出错，被规矩束住放不开，留意官非口舌、压力上身。宜：求职晋升、考公考证、立规矩争名分，按流程办事别钻空子，照顾好情绪。' },
  偏印: { pol: '偏', lbl: '钻研充电', rbl: '发懒空想',
    desc: '顺时，灵感多、适合学习钻研，能想通很多事，独处充电、专精一门手艺；走偏时，发懒不爱动、多想少做，孤僻钻牛角尖，提不起劲、爱胡思乱想。宜：去钻研学习、做研究策划、独处充电，逼自己动起来，定期运动社交别空想。' },
  正印: { pol: '正', lbl: '得助安稳', rbl: '发懒依赖',
    desc: '顺时，常得长辈、贵人相助，适合进修考证，心里踏实、被托底照顾；走偏时，容易发懒、依赖心重，行动慢、准备过头，安于现状不想动弹。宜：进修考证、找贵人长辈帮、签长约稳中求进，克服懒散、主动迈出第一步。' }
};

function intensity(p) { return Math.round(Math.abs(p - 50) * 2); }

// 某党羽在某 P 下偏优还是偏缺（中立方向）
// party: 'same' 生扶（印比）/ 'diff' 克泄耗（财官食伤）
// 偏旺时克泄耗发挥（偏优），生扶过满（偏缺）；偏弱反之；近中和则均衡。
function direction(party, p) {
  if (intensity(p) < 10) return 'mid';
  var favorable = p >= 50 ? 'diff' : 'same';
  return party === favorable ? 'pro' : 'con';
}

/**
 * @param {object} chart bazi.computeChart 返回值
 * @param {object} opts  { daYunGZ, liuNianGZ }
 */
function build(chart, opts) {
  opts = opts || {};
  var dayGan = chart.meta.dayGan;
  var dmEl = base.ganWx(dayGan);
  var m = energy.build(chart, opts);
  var P = m.pNow;
  var inten = intensity(P);

  // —— 占比决策树：全池五行占比 → 各五行喜忌 ——
  var rootEls = rootElsOf(chart, opts);
  var xiji = decideXiji(m.pool || {}, dmEl, rootEls);

  // 流年干支（显示层只看流年引动）
  var lnGan = (opts.liuNianGZ && opts.liuNianGZ.length >= 2) ? opts.liuNianGZ.charAt(0) : null;
  var lnZhi = (opts.liuNianGZ && opts.liuNianGZ.length >= 2) ? opts.liuNianGZ.charAt(1) : null;

  // 仅取非日主天干（最外显的一层）
  var stems = m.ganCells.filter(function (c) { return !c.isDay; });

  // —— 两种底色：天干地支所有十神（含藏干） ——
  var zb = 0, zn = 0, bt = 0, nt = 0;
  function tallyPol(god, bv, vv) {
    bt += bv; nt += vv;
    var t = TEMP[god];
    if (t && t.pol === '正') { zb += bv; zn += vv; }
  }
  stems.forEach(function (c) { tallyPol(c.god, c.base, c.val); });
  (m.hiddenUnits || []).forEach(function (u) { tallyPol(u.god, u.base, u.val); });
  var zhengNow = nt ? Math.round(zn / nt * 100) : 50;
  var zhengBase = bt ? Math.round(zb / bt * 100) : 50;

  // —— 外显心性（list）——
  // 选了流年：只显示「流年天干」一条当年主旋律；方向由决策树定、强度由占比定（钳 25–75%）。
  // 本命/未选流年：保留原局天干多条，方向同样改用决策树。
  function fullDots() { var d = []; for (var k = 1; k <= 5; k++) d.push({ i: k, on: true }); return d; }
  function energyDots(ratio) { var n = Math.max(1, Math.min(5, Math.round(ratio * 5))); var d = []; for (var k = 1; k <= 5; k++) d.push({ i: k, on: k <= n }); return d; }
  var list = [];
  if (lnGan) {
    // 流年：单条「流年天干」当年主旋律，用流年专用文案
    var lg = LunarUtil.SHI_SHEN[dayGan + lnGan];
    var lgEl = base.ganWx(lnGan);
    var L0 = LIUNIAN[lg] || { pol: '', lbl: '', rbl: '', desc: '' };
    list.push({
      god: lg, name: lg, pol: L0.pol, lbl: L0.lbl, rbl: L0.rbl, desc: L0.desc,
      cls: base.WX_CLS[lgEl],
      slider: sliderPos(xiji.dir[lgEl], (m.pool || {})[lgEl] || 0),
      energy: 1, dots: fullDots(), isMain: true
    });
  } else {
    // 本命：按五行能量排序取前两名心性（含天干+地支藏干，不限天干），各用其主导十神
    var elAgg = {};
    function addEl(god, el, cls, v) {
      if (!elAgg[el]) elAgg[el] = { el: el, cls: cls, energy: 0, gods: {} };
      elAgg[el].energy += v;
      elAgg[el].gods[god] = (elAgg[el].gods[god] || 0) + v;
    }
    stems.forEach(function (c) { addEl(c.god, c.el, c.cls, c.val); });
    (m.hiddenUnits || []).forEach(function (u) { addEl(u.god, u.el, base.WX_CLS[u.el], u.val); });
    var els = [];
    for (var e in elAgg) els.push(elAgg[e]);
    els.sort(function (a, b) { return b.energy - a.energy; });
    var maxEl = els.length ? els[0].energy : 1;
    els.slice(0, 2).forEach(function (it, idx) {
      var domGod = null, domE = -1;            // 该五行里能量最大的具体十神
      for (var gg in it.gods) { if (it.gods[gg] > domE) { domE = it.gods[gg]; domGod = gg; } }
      var t = TEMP[domGod] || { name: domGod, pol: '', lbl: '', rbl: '', desc: '' };
      list.push({
        god: domGod, name: t.name, pol: t.pol, lbl: t.lbl, rbl: t.rbl, desc: t.desc, cls: it.cls,
        slider: sliderPos(xiji.dir[it.el], (m.pool || {})[it.el] || 0),
        energy: it.energy,
        dots: energyDots(maxEl > 0 ? it.energy / maxEl : 1),
        isMain: idx === 0
      });
    });
  }

  // —— 内在心性（branchList）——
  // 选了流年：只显示「流年地支本气十神」一条内在主旋律。
  // 本命/未选流年：保留原局地支本气多条。
  var branchList = [];
  if (lnZhi) {
    var lzMain = LunarUtil.ZHI_HIDE_GAN[lnZhi][0];
    var lzGod = LunarUtil.SHI_SHEN[dayGan + lzMain];
    var lzEl = base.ganWx(lzMain);
    var bt0 = TEMP[lzGod] || { name: lzGod, pol: '' };
    branchList.push({
      god: lzGod, name: bt0.name, pol: bt0.pol, cls: base.WX_CLS[lzEl],
      desc: INNER[lzGod] || '', zhis: lnZhi,
      energy: 1, dots: fullDots(), isMain: true
    });
  } else {
    var bagg = {};
    (m.zhiCells || []).forEach(function (c) {
      if (!bagg[c.god]) bagg[c.god] = { god: c.god, party: c.party, cls: c.cls, energy: 0, zhis: [] };
      bagg[c.god].energy += c.val;
      bagg[c.god].zhis.push(c.char);
    });
    var maxBE = 0, bg;
    for (bg in bagg) { if (bagg[bg].energy > maxBE) maxBE = bagg[bg].energy; }
    for (bg in bagg) {
      var bt = TEMP[bg] || { name: bg, pol: '' };
      branchList.push({
        god: bg, name: bt.name, pol: bt.pol, cls: bagg[bg].cls,
        desc: INNER[bg] || '', zhis: bagg[bg].zhis.join('、'),
        energy: bagg[bg].energy
      });
    }
    branchList.sort(function (a, b) { return b.energy - a.energy; });
    branchList.forEach(function (it, idx) {
      it.dots = energyDots(maxBE > 0 ? it.energy / maxBE : 1);
      it.isMain = idx === 0;
    });
  }

  // —— 心结与张力：地支刑冲合害（原局四支 + 已叠加的岁运地支） ——
  var branches = [];
  chart.pillars.forEach(function (p) {
    if (p.empty || !p.zhi) return;
    branches.push({ zhi: p.zhi.text, label: p.label.charAt(0) });
  });
  if (opts.daYunGZ && opts.daYunGZ.length >= 2) branches.push({ zhi: opts.daYunGZ.charAt(1), label: '大运' });
  if (opts.liuNianGZ && opts.liuNianGZ.length >= 2) branches.push({ zhi: opts.liuNianGZ.charAt(1), label: '流年' });
  var rels = relations.detect(branches);

  // —— 人生四季：四柱分限速览（天干主旋律 + 地支内心） ——
  var zhiGodByPos = {};
  (m.zhiCells || []).forEach(function (c) { zhiGodByPos[c.pos] = c.god; });
  var stages = chart.pillars.map(function (p) {
    var sm = STAGE_META[p.label] || { label: p.label, sub: '' };
    if (p.empty || !p.gan) return { label: sm.label, sub: sm.sub, empty: true };
    var posChar = p.label.charAt(0);          // 年/月/日/时
    var innerGod = zhiGodByPos[posChar];
    var isDay = p.shiShenGan === '日主';
    var theme, themeGod, desc;
    if (isDay) {
      theme = '自己'; themeGod = '日主';
      desc = INNER[innerGod] || '';
    } else {
      var tt = TEMP[p.shiShenGan] || { name: p.shiShenGan };
      theme = tt.name; themeGod = p.shiShenGan;
      desc = STAGE[p.shiShenGan] || '';
    }
    return {
      label: sm.label, sub: sm.sub, empty: false,
      gan: p.gan.text, ganCls: p.gan.cls, zhi: p.zhi.text, zhiCls: p.zhi.cls,
      theme: theme, themeGod: themeGod, desc: desc,
      // 日柱主旋律已用日支内在心性，避免再重复同一十神的「内心」一行
      innerName: isDay ? '' : ((TEMP[innerGod] || {}).name || ''),
      inner: isDay ? '' : (STAGE_INNER[innerGod] || '')
    };
  });

  var coreInfo = CORE[dayGan] || { title: dayGan, text: '' };

  // 盘面
  var paimian = chart.pillars.map(function (p) {
    if (p.empty) return { label: p.label, empty: true };
    return {
      label: p.label,
      gan: p.gan.text, ganCls: p.gan.cls,
      zhi: p.zhi.text, zhiCls: p.zhi.cls,
      god: p.shiShenGan, isDay: p.shiShenGan === '日主'
    };
  });

  return {
    core: {
      gan: dayGan,
      cls: base.WX_CLS[base.ganWx(dayGan)],
      title: coreInfo.title,
      text: coreInfo.text
    },
    paimian: paimian,
    list: list,
    branchList: branchList,
    relations: rels,
    stages: stages,
    zhengNow: zhengNow, pianNow: 100 - zhengNow,
    hasLuck: m.hasLuck,
    hasTime: !chart.meta.unknownTime
  };
}

module.exports = { build: build };
