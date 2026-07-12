// 性格画像：原局固定喜忌 + 四阶段心性 + 大运方向 + 流年行为叠加。
// 天干关键词表达可观察的行为方式，地支关键词表达内在心性。
var energy = require('./energy.js');
var base = require('./base.js');
var relations = require('./relations.js');
var traitWords = require('./traitWords.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;
var KE = base.KE;
var SHENG = base.SHENG;

// 临时叠加心性气泡：只用于时间阶段/年份，不作为稳定性格文案。
var YEAR_TRAIT_WORDS = {
  比肩: { pro: ['自主', '硬气', '稳住', '自己来'], con: ['较劲', '固执', '不服软', '单扛'] },
  劫财: { pro: ['敢冲', '有人气', '讲义气', '会争取'], con: ['上头', '攀比', '冲动花钱', '替人扛'] },
  食神: { pro: ['松弛', '好相处', '有口福', '会享受'], con: ['拖延', '贪舒服', '不想卷', '放松过头'] },
  伤官: { pro: ['敢说', '有灵感', '表现力', '出作品'], con: ['嘴快', '不服管', '太锋利', '自律差'] },
  正财: { pro: ['务实', '会规划', '能执行', '重承诺'], con: ['压力大', '太现实', '瞎忙', '怕变动'] },
  偏财: { pro: ['机会感', '会变通', '出手快', '人脉活'], con: ['分心', '花钱快', '投机', '边界松'] },
  正官: { pro: ['自律', '负责', '守分寸', '要名分'], con: ['顾虑多', '放不开', '怕出错', '太拘谨'] },
  七杀: { pro: ['果断', '敢拼', '扛压力', '有目标'], con: ['紧绷', '急躁', '压迫感', '赌一把'] },
  正印: { pro: ['安稳', '好学', '有贵人', '被托底'], con: ['依赖', '懒动', '想太多', '怕变化'] },
  偏印: { pro: ['专注', '洞察', '灵感', '深挖'], con: ['孤僻', '挑剔', '空想', '不落地'] }
};

var TEN_GOD_CAT_IMAGES = {
  '比肩': '/images/ten-gods/cat/01-bijian.png',
  '劫财': '/images/ten-gods/cat/02-jiecai.png',
  '食神': '/images/ten-gods/cat/03-shishen.png',
  '伤官': '/images/ten-gods/cat/04-shangguan.png',
  '偏财': '/images/ten-gods/cat/05-piancai.png',
  '正财': '/images/ten-gods/cat/06-zhengcai.png',
  '七杀': '/images/ten-gods/cat/07-qisha.png',
  '正官': '/images/ten-gods/cat/08-zhengguan.png',
  '偏印': '/images/ten-gods/cat/09-pianyin.png',
  '正印': '/images/ten-gods/cat/10-zhengyin.png'
};

function tenGodCatImage(god) {
  if (!god) return '';
  var key = String(god).split(/\s*\+\s*/)[0];
  return TEN_GOD_CAT_IMAGES[key] || '';
}

function wordCopy(god, kind) {
  if (kind === 'luck') return YEAR_TRAIT_WORDS[god] || {};
  return traitWords[god] || {};
}

function wordText(god, kind, side) {
  var kw = wordCopy(god, kind);
  return ((kw && kw[side]) || []).join('、');
}

function narrativeText(god, kind, side) {
  var t = TEMP[god] || { desc: '', con: '' };
  return side === 'desc' ? t.desc : t.con;
}

// 心性 → 气泡星团数据（原局 src=natal 红蓝 + 岁运叠加 src=luck 金）
function buildTraitBubbles(list, luck, kind) {
  var out = [];
  (list || []).forEach(function (t, idx) {
    var kw = wordCopy(t.god, t.copyKind || kind || 'outer');
    if (!kw) return;
    // 该心性算出的滑标位置(25-75) → lean(0顺…1偏)，驱动这组泡泡优缺涨缩
    var lean = (t.slider != null ? t.slider : 50) / 100;
    var bw = idx === 0 ? 0.95 : 0.78;
    (kw.pro || []).slice(0, 5).forEach(function (w) { out.push({ label: w, kind: 'pro', src: 'natal', w: bw, lean: lean }); });
    (kw.neu || []).slice(0, 3).forEach(function (w) { out.push({ label: w, kind: 'neu', src: 'natal', w: 0.55, lean: lean }); });
    (kw.con || []).slice(0, 5).forEach(function (w) { out.push({ label: w, kind: 'con', src: 'natal', w: bw, lean: lean }); });
    (t.extraCon || []).forEach(function (w) { out.push({ label: w, kind: 'con', src: 'natal', w: bw, lean: lean }); });
  });
  // 岁运叠加（金色）：取一组优缺关键词，叠在主心性之上，不顶替
  // 若岁运十神与原局主心性相同，能量本就一样，不再加多余的圆
  if (luck && luck.god) {
    var lkw = wordCopy(luck.god, 'luck');
    if (lkw) {
      var ll = (luck.slider != null ? luck.slider : 50) / 100;
      var lw = luck.bubbleWeight || 0.7;
      (lkw.pro || []).slice(0, 4).forEach(function (w) { out.push({ label: w, kind: 'pro', src: 'luck', w: lw, lean: ll }); });
      (lkw.con || []).slice(0, 4).forEach(function (w) { out.push({ label: w, kind: 'con', src: 'luck', w: lw, lean: ll }); });
    }
  }
  return out;
}

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

function dominantGod(godEnergy, left, right) {
  return (godEnergy[left] || 0) > (godEnergy[right] || 0) ? left : right;
}

function diseaseSubtype(party, godEnergy) {
  if (party === '食伤') return dominantGod(godEnergy, '伤官', '食神') + '过旺';
  if (party === '印') return dominantGod(godEnergy, '偏印', '正印') + '过旺';
  if (party === '比劫') return dominantGod(godEnergy, '劫财', '比肩') + '过旺';
  if (party === '官杀') return dominantGod(godEnergy, '七杀', '正官') + '过旺';
  if (party === '财') return dominantGod(godEnergy, '偏财', '正财') + '过旺';
  return '';
}

// p: {木:pct,...}；dmEl 日主五行；rootEls: {五行:1} 有本气根的五行集合
// godEnergy: 原局十神能量，用于病重和食伤偏旺的正偏细分。
// 返回 { dir, mode, disease, diseaseEls, subtypes }
function decideXiji(p, dmEl, rootEls, godEnergy) {
  rootEls = rootEls || {};
  godEnergy = godEnergy || {};
  var top = WX[0];
  WX.forEach(function (e) { if (p[e] > p[top]) top = e; });
  var dir = {}, mode, disease = null, subtype = '';
  var ti = 0, shiShang = 0, biJie = 0;
  WX.forEach(function (e) {
    var g = partyGod(dmEl, e);
    if (g === '食伤') { ti += p[e]; shiShang += p[e]; }
    if (g === '比劫') { ti += p[e]; biJie += p[e]; }
  });

  var diseaseEls = WX.filter(function (e) { return (p[e] || 0) >= 40; });
  var subtypes = diseaseEls.map(function (e) {
    return diseaseSubtype(partyGod(dmEl, e), godEnergy);
  }).filter(function (s) { return !!s; });

  // 任何单一五行达到 40% 都先判病重；最高者作为病药基础判断的主病。
  if (diseaseEls.length) {
    // 病重型：围绕病 D 的生克五位
    mode = '病重';
    disease = top;
    subtype = diseaseSubtype(partyGod(dmEl, top), godEnergy);
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
  } else if (ti >= 40) {
    // 非病重结构：体 = 食伤 + 比劫，谁占主导就制衡谁。
    if (shiShang > biJie) {
      subtype = dominantGod(godEnergy, '伤官', '食神') + '偏旺';
      mode = subtype;
      WX.forEach(function (e) {
        dir[e] = partyGod(dmEl, e) === '食伤' ? '-' : '+';
      });
    } else {
      mode = '体旺';
      WX.forEach(function (e) {
        var g = partyGod(dmEl, e);
        dir[e] = (g === '食伤' || g === '财' || g === '官杀') ? '+' : '-';
      });
    }
  } else {
    mode = '体弱';
    WX.forEach(function (e) { var g = partyGod(dmEl, e); dir[e] = (g === '比劫' || g === '印') ? '+' : '-'; });
  }
  return {
    dir: dir,
    mode: mode,
    disease: disease,
    diseaseEls: diseaseEls,
    subtype: subtype,
    subtypes: subtypes
  };
}

// 五行滑标位置：喜(+)→左、忌(-)→右；强度 = |五行占比−20| 限幅 [0,25] → 钳到 [25%,75%]
function sliderPos(d, pct) {
  var mag = Math.min(25, Math.max(10, Math.round(Math.abs(pct - 20) * 1.2)));
  if (d === '+') return 50 - mag;
  if (d === '-') return 50 + mag;
  return 50;
}

// 心性滑标位置：方向仍取喜忌；强度改用该十神在心性聚合池里的能量占比。
// 十神均分基准为 10%，只取超过基准的部分做偏移；凡明确喜/忌，至少偏离中线 10。
var RIGHT_SOFT_CAP_GODS = { 正财: true, 比肩: true, 偏财: true, 食神: true, 正印: true };

function capTraitRight(god, pos) {
  return RIGHT_SOFT_CAP_GODS[god] ? Math.min(pos, 65) : pos;
}

function traitSliderPos(d, godPct, god) {
  var mag = Math.min(25, Math.max(10, Math.round(Math.max(0, godPct - 10))));
  if (d === '+') return 50 - mag;
  if (d === '-') return capTraitRight(god, 50 + mag);
  return 50;
}

// 十神结构识别：用于覆盖滑标方向。强度仍用十神能量占比。
function detectTraitPattern(arr, godPct, stems) {
  function pct(g) { return godPct[g] || 0; }
  function ratio(a, b) {
    var hi = Math.max(a, b), lo = Math.min(a, b);
    return hi > 0 ? lo / hi : 0;
  }
  function stemSum(names) {
    var n = 0;
    (stems || []).forEach(function (c) {
      if (names.indexOf(c.god) >= 0) n += c.val || 0;
    });
    return n;
  }

  var shi = pct('食神'), sha = pct('七杀');
  if (shi >= 18 && sha >= 18 && ratio(shi, sha) >= 0.75) {
    return {
      name: '食神制杀',
      dirByGod: { 食神: '+', 七杀: '+' }
    };
  }

  var stemBody = stemSum(['比肩', '劫财']);
  var stemSha = stemSum(['七杀']);
  var stemJie = stemSum(['劫财']);
  if (stemBody > 0 && stemSha > 0 && ratio(stemBody, stemSha) >= 0.70) {
    if (stemJie > 0) {
      return {
        name: '羊刃驾杀',
        dirByGod: { 劫财: '0', 比肩: '0', 七杀: '0' }
      };
    }
    return {
      name: '身杀两停',
      dirByGod: { 比肩: '+', 劫财: '+', 正财: '+', 偏财: '+', 七杀: '+', 正官: '+' }
    };
  }

  return null;
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

// 十神 → 外显心性（name 心性名，pol 正/偏，lbl 左端顺，rbl 右端偏，desc 综合特质描述）
var TEMP = {
  比肩: { name: '自立', pol: '正', lbl: '自主稳健', rbl: '固执较真',
          desc: '有主见、先想清楚再动，自控有分寸、不盲从；执行力强、能扛事，节奏稳不冒进。重平等、重边界，不爱欠人情、不喜被硬压，守得住自己的付出与积累。',
          con: '固执、接受新意见慢、启动慢；被压时沉默抵抗、不愿服软；对公平和被占便宜敏感，爱暗中较劲。' },
  劫财: { name: '果敢', pol: '偏', lbl: '敢闯仗义', rbl: '冲动破耗',
          desc: '反应快、胜负心强、敢冒险；执行果断、爆发力足，能动就动、不怕硬碰硬；讲义气、重朋友、愿出头，资源来去快、不计较一时得失。',
          con: '容易上头、先动后想、用力过猛；语气冲、情绪上来说重话；为人情冲动替人扛事，冲动花费、轻财重义。' },
  食神: { name: '从容', pol: '正', lbl: '温和有福', rbl: '安逸拖延',
          desc: '温和松弛、知足重感受，顺其自然；说话柔和、会缓和气氛、让人舒服；做事稳缓、持续输出，擅长把能力变成服务、内容与口碑；厚道宽和、好相处。',
          con: '易安逸、动力不足，遇强竞争不主动；话说得软、问题不愿讲透；心软边界不硬，图舒服易拖延、降要求。' },
  伤官: { name: '锋芒', pol: '偏', lbl: '才华锐进', rbl: '锋芒招怨',
          desc: '聪明有料、反应快、爱看出问题本质；表达强、观点犀利、敢说真话；有创造力和突破力，敢打破旧方式，靠能力、技术、表达出头；重欣赏、重自由。',
          con: '易骄傲、自我判断过强；说话不留余地、语气锋利让人被冒犯；不服安排、挑战权威，合作成本高，易招是非。' },
  偏财: { name: '灵活', pol: '偏', lbl: '机变豪爽', rbl: '散漫高估',
          desc: '机会感强、眼光灵活、善于在变化中找收益；爽快直接、会谈资源合作；敢试敢投、灵活切换；豪爽量大、就事论事，能把关系和事分开看，重人脉渠道资金。',
          con: '易高估机会、判断偏乐观、押太大；口头大方、承诺偏快；边界松手头松，钱财进出快、留存不稳。' },
  正财: { name: '务实', pol: '正', lbl: '踏实可靠', rbl: '保守计较',
          desc: '现实感强、重稳定与确定回报，喜欢可算、可持续的结果；讲实际、重效率、表达直接；踏实本分、按计划推进，适合长期经营、慢慢积累；重责任承诺、边界清楚、会管钱守成。',
          con: '偏保守、变化感不足、一板一眼；显得不够圆滑；太在意付出回报对等，易被认为计较。' },
  七杀: { name: '开拓', pol: '偏', lbl: '果决担当', rbl: '紧绷过激',
          desc: '危机感强、警觉性高、重结果与强弱，善于预判风险；说话有力度、敢指出问题；果断敢冲、敢担事、能处理难题，遇压力反被激发；欣赏强者、重实力气场，擅长在复杂局面抢出空间。',
          con: '易紧绷多疑、把普通问题看成威胁；说话太硬给人压力；急躁过猛、做事过头，约束不足易惹是非。' },
  正官: { name: '自律', pol: '正', lbl: '端正负责', rbl: '拘谨多虑',
          desc: '重秩序、身份、名分与责任，重社会认可，走正式合规的判断；温和得体、有分寸、讲场合；稳重负责、按流程推进，愿担正式角色，做事讲标准、讲交代、讲结果。',
          con: '顾虑评价、怕越界、太在意别人看法；说话太稳、不敢表达真实不满；被流程身份束缚、突破力不足。' },
  偏印: { name: '钻研', pol: '偏', lbl: '专精独到', rbl: '多思孤僻',
          desc: '独立判断、善筛选信息、爱自建一套理解，靠非标准专长、技术、研究或特殊经验打开局面；话少含蓄、点到为止；边界感强、精神空间需求高，重深度与独特理解。',
          con: '多疑多思、想太深、把简单事复杂化；话里带刺、让人猜不透；多思少动、想一步到位迟迟不开始，易显孤僻。' },
  正印: { name: '宽厚', pol: '正', lbl: '仁厚稳重', rbl: '依赖迟缓',
          desc: '走正统路径、重基础与体系学习、重长期积累，信善意与经验，先接受再消化；温和有礼、谦虚愿听；稳妥先准备、按正规路径推进，重安全感与持续，适合在平台体系中成长；包容照顾、给人安全感。',
          con: '依赖既有框架、反应偏慢、太在意体面认可；易假客气、藏真实态度；准备过多、怕离舒适区，开拓力不足。' }
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

// 十神 → 流年专用文案（讲这一年适合做什么、容易打算做什么，区别于稳定性格）
// pol 正/偏；lbl 顺端词(喜·左)、rbl 偏端词(忌·右)；desc 用行动建议口吻，不写成固定性格。
var LIUNIAN = {
  比肩: { pol: '正', lbl: '自立合伙', rbl: '较劲破费',
    desc: '今年适合把主动权拿回来，自己定计划、自己推进，也适合找同频的人搭伙做事。你可能会想独立完成一件事，或重新整理朋友圈、合作关系。注意账目分清，别因为讲义气替人扛太多。' },
  劫财: { pol: '偏', lbl: '敢拼旺人脉', rbl: '冲动破财',
    desc: '今年适合借人脉、团队、圈子去开拓，适合竞争、抢机会、把行动速度提起来。你可能会想换圈子、拉团队、做更有冲劲的事。注意别冲动消费、别攀比投入，借钱担保要谨慎。' },
  食神: { pol: '正', lbl: '松快有福', rbl: '贪玩懒散',
    desc: '今年适合做内容、作品、表达、服务，也适合调养身体、学习一门让自己舒服的技能。你可能会想放慢节奏，把日子过得更有滋味。注意别只顾享受和拖延，最好给自己定一个能完成的小目标。' },
  伤官: { pol: '偏', lbl: '才华出彩', rbl: '傲气口舌',
    desc: '今年适合把才华拿出来，做作品、表达观点、学新技能、争取曝光。你可能会想突破旧规则，换一种方式证明自己。注意少争口舌，别一急就顶撞权威，把锋芒落到作品和结果上。' },
  偏财: { pol: '偏', lbl: '财路人脉广', rbl: '投机散财',
    desc: '今年适合拓业务、做副业、谈资源、跑市场，也适合把人脉变成实际机会。你可能会想多尝试几条财路，或把手里的资源流动起来。注意别投机押太大，应酬和开销要控住。' },
  正财: { pol: '正', lbl: '稳进顾家', rbl: '计较操劳',
    desc: '今年适合稳定进账、存钱理财、长期经营，也适合把生活和工作重新整理得更有秩序。你可能会想攒钱、买大件、做长期计划。注意别因为太计较而错过机会，该投入的地方别过度省。' },
  七杀: { pol: '偏', lbl: '闯劲担当', rbl: '焦躁冒险',
    desc: '今年适合攻坚、扛项目、做高压但能成长的事，也适合训练体能、争取更强的平台或权威背书。你可能会想快速突破、证明实力。注意别冒险赌一把，安全、合同和边界要先守住。' },
  正官: { pol: '正', lbl: '名分上进', rbl: '拘谨压力',
    desc: '今年适合求职晋升、考证考编、争取名分和正式身份，也适合立规矩、走流程、把口碑做稳。你可能会想让事情更正规、更被认可。注意别被压力和评价困住，按规则来，但别把自己绷太紧。' },
  偏印: { pol: '偏', lbl: '钻研充电', rbl: '发懒空想',
    desc: '今年适合学习、研究、策划、做幕后准备，也适合独处充电、打磨一门偏专精的能力。你可能会想换一种理解世界的方式，或钻进某个小众方向。注意别只想不做，定期运动和社交，把灵感落地。' },
  正印: { pol: '正', lbl: '得助安稳', rbl: '发懒依赖',
    desc: '今年适合进修、考证、找老师贵人、签长期稳定的安排，也适合修复关系、补足安全感。你可能会想先把基础打牢，再稳稳往前走。注意别准备太久、依赖太多，关键是主动迈出第一步。' }
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
 * @param {object} opts  { luckByStage, yearByStage }
 *   固定四阶段；每个阶段选择一段大运，可选流年天干叠加行为。
 *   两种底色/主心性列表/心结张力等全局板块固定用原局，不随岁运变。
 */
function build(chart, opts) {
  opts = opts || {};
  var dayGan = chart.meta.dayGan;
  var dmEl = base.ganWx(dayGan);
  var m = energy.build(chart, {});
  var P = m.pNow;
  var inten = intensity(P);

  // —— 占比决策树（原局）：岁运不进池，喜忌终身固定 ——
  var natalGodEnergy = {};
  (m.ganCells || []).forEach(function (c) {
    if (!c.isDay) natalGodEnergy[c.god] = (natalGodEnergy[c.god] || 0) + c.val;
  });
  (m.hiddenUnits || []).forEach(function (u) {
    natalGodEnergy[u.god] = (natalGodEnergy[u.god] || 0) + u.val;
  });
  var rootEls = rootElsOf(chart, {});
  var xiji = decideXiji(m.poolXiji || m.pool || {}, dmEl, rootEls, natalGodEnergy);

  // 全局板块固定原局口径
  var lnGan = null;
  var lnZhi = null;

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
  // —— 主心性：始终取原局最强的两股（天干+地支），贯穿一生，不被岁运顶替 ——
  // 大小(顺偏)用含岁运的合并能量喜忌，所以底色不变、但各面随岁运此消彼长。
  var list = [];
  var GAN_W = 1;
  var ZHI_POS = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
  var agg = {};
  function addG(god, el, cls, v) {
    if (!agg[god]) agg[god] = { god: god, el: el, cls: cls, energy: 0 };
    agg[god].energy += v;
  }
  stems.forEach(function (c) { addG(c.god, c.el, c.cls, c.val * GAN_W); });
  (m.hiddenUnits || []).forEach(function (u) { addG(u.god, u.el, base.WX_CLS[u.el], u.val * (ZHI_POS[u.pillar] != null ? ZHI_POS[u.pillar] : 0.6)); });
  var arr = [];
  for (var g in agg) arr.push(agg[g]);
  arr.sort(function (a, b) { return b.energy - a.energy; });
  var maxE = arr.length ? arr[0].energy : 1;
  var totalE = 0, godPct = {};
  arr.forEach(function (it) { totalE += it.energy; });
  arr.forEach(function (it) { godPct[it.god] = totalE > 0 ? it.energy / totalE * 100 : 0; });
  var traitPattern = detectTraitPattern(arr, godPct, stems);
  function traitDir(god, el) {
    if (traitPattern && traitPattern.dirByGod && traitPattern.dirByGod[god]) return traitPattern.dirByGod[god];
    return xiji.dir[el];
  }
  function posIndexOf(label) {
    return { 年: 0, 月: 1, 日: 2, 时: 3 }[label];
  }
  function pillarGanInfo(pillar) {
    var p = chart.pillars[pillar];
    if (!p || p.empty || !p.gan) return null;
    return {
      sourceKind: 'gan',
      pillar: pillar,
      char: p.gan.text,
      god: p.shiShenGan,
      el: base.ganWx(p.gan.text),
      isDay: p.shiShenGan === '日主'
    };
  }
  function pillarMainInfo(pillar) {
    var p = chart.pillars[pillar];
    if (!p || p.empty || !p.zhi) return null;
    var g = LunarUtil.ZHI_HIDE_GAN[p.zhi.text][0];
    return {
      sourceKind: 'zhiMain',
      pillar: pillar,
      char: g,
      god: LunarUtil.SHI_SHEN[dayGan + g],
      el: base.ganWx(g),
      isDay: false
    };
  }
  function samePillarPeer(src) {
    if (src.pillar == null) return null;
    return src.sourceKind === 'gan' ? pillarMainInfo(src.pillar) : pillarGanInfo(src.pillar);
  }
  function godIn(god, list) {
    return list.indexOf(god) >= 0;
  }
  function isKe(controller, target) {
    return controller && target && KE[controller.el] === target.el;
  }
  function samePillarOverride(src, currentDir) {
    if (!src || src.pillar == null || !src.sourceKind) return null;
    var peer = samePillarPeer(src);
    if (!peer || peer.isDay) return null;
    if (!isKe(peer, src)) return null;

    if (src.sourceKind === 'gan' && src.god === '正印' && godIn(peer.god, ['正财', '偏财'])) {
      return { dir: '-', reason: '正印天干被同柱财星克制' };
    }
    if (src.god === '七杀' && godIn(peer.god, ['食神', '伤官'])) {
      return { dir: '+', reason: '七杀被同柱食伤克制' };
    }
    if (src.god === '劫财' && peer.god === '七杀') {
      return { dir: '+', reason: '劫财被同柱七杀克制' };
    }
    if (src.god === '偏印' && peer.god === '偏财') {
      return { dir: '+', reason: '偏印被同柱偏财克制' };
    }
    if (src.god === '伤官' && currentDir === '-' && peer.god === '正印') {
      return { dir: '+', reason: '忌神伤官被同柱正印克制' };
    }
    if (src.god === '正官' && currentDir === '+' && peer.god === '伤官') {
      return { dir: '-', reason: '喜用正官被同柱伤官克制' };
    }
    if (src.god === '正财' && currentDir === '+' && peer.god === '劫财') {
      return { dir: '-', reason: '喜用正财被同柱劫财克制' };
    }
    if (src.god === '食神' && currentDir === '+' && peer.god === '偏印') {
      return { dir: '-', reason: '喜用食神被同柱偏印克制' };
    }
    return null;
  }

  function makeTraitItem(src, idx, max, copyKind) {
    var t = TEMP[src.god] || { name: src.god, pol: '', lbl: '', rbl: '', desc: '', con: '' };
    var rawDir = traitDir(src.god, src.el);
    var override = samePillarOverride(src, rawDir);
    var dir = override ? override.dir : rawDir;
    return {
      god: src.god, name: t.name, pol: t.pol, lbl: t.lbl, rbl: t.rbl,
      catImage: tenGodCatImage(src.god),
      desc: narrativeText(src.god, copyKind, 'desc'),
      con: narrativeText(src.god, copyKind, 'con'),
      descLabel: '优点',
      conLabel: '留意',
      cls: src.cls,
      slider: traitSliderPos(dir, godPct[src.god] || 0, src.god),
      energy: src.energy,
      godPct: Math.round(godPct[src.god] || 0),
      traitDir: dir,
      baseTraitDir: rawDir,
      traitOverride: override ? override.reason : '',
      copyKind: copyKind,
      traitPattern: traitPattern ? traitPattern.name : '',
      dots: energyDots(max > 0 ? src.energy / max : 1),
      isMain: idx === 0,
      source: src.source,
      sourceChar: src.sourceChar,
      sourceKind: src.sourceKind,
      pillar: src.pillar
    };
  }

  var outerSources = [];
  stems.forEach(function (c) {
    if (c.pos === '年' || c.pos === '月') {
      outerSources.push({
        god: c.god, el: c.el, cls: c.cls, energy: c.val,
        source: outerSources.length === 0 ? '外显一' : '外显二',
        sourceChar: c.char,
        sourceKind: 'gan',
        pillar: posIndexOf(c.pos)
      });
    }
  });
  var maxOuter = 0;
  outerSources.forEach(function (it) { if (it.energy > maxOuter) maxOuter = it.energy; });
  var outerList = outerSources.map(function (it, idx) { return makeTraitItem(it, idx, maxOuter, 'outer'); });

  var innerSources = [];
  function addInnerByPillar(pillar, source) {
    for (var i = 0; i < (m.hiddenUnits || []).length; i++) {
      var u = m.hiddenUnits[i];
      if (u.pillar === pillar && u.rank === 0) {
        var pp = chart.pillars[pillar];
        innerSources.push({
          god: u.god, el: u.el, cls: base.WX_CLS[u.el], energy: u.val,
          source: source, sourceChar: pp && pp.zhi ? pp.zhi.text : '',
          sourceKind: 'zhiMain',
          pillar: pillar
        });
        break;
      }
    }
  }
  addInnerByPillar(1, '内显一');
  addInnerByPillar(2, '内显二');
  var maxInner = 0;
  innerSources.forEach(function (it) { if (it.energy > maxInner) maxInner = it.energy; });
  var innerList = innerSources.map(function (it, idx) { return makeTraitItem(it, idx, maxInner, 'inner'); });

  var list = outerList;

  var coreInfo = CORE[dayGan] || { title: dayGan, text: '' };

  // —— 固定四阶段：大运只作为阶段内的岁运选择，不再充当阶段本身 ——
  var SPECIAL_PIAN = { 劫财: true, 伤官: true, 七杀: true, 偏印: true };
  var EXCESS_CONFLICTS = {
    伤官过旺: { 正官: '伤官见官' },
    偏印过旺: { 食神: '枭神夺食' },
    劫财过旺: { 正财: '劫财夺财', 偏财: '劫财夺财' },
    七杀过旺: { 比肩: '七杀制身' }
  };
  function fixedGodDir(god, el) {
    var dir = xiji.dir[el] || '0';
    for (var i = 0; i < (xiji.subtypes || []).length; i++) {
      var hit = EXCESS_CONFLICTS[xiji.subtypes[i]];
      if (hit && hit[god]) return { dir: '-', reason: hit[god] };
    }
    return { dir: dir, reason: '' };
  }
  function stageDir(target, luck, allowPianTurn) {
    // 少年由大运直接主导；20岁以后以阶段十神自身喜忌为底，大运只负责制泄修正。
    var result = allowPianTurn
      ? fixedGodDir(target.god, target.el)
      : fixedGodDir(luck.god, luck.el);
    var excessName = target.god + '过旺';
    var controlled = allowPianTurn && KE[luck.el] === target.el;
    var drained = allowPianTurn && SHENG[target.el] === luck.el;
    if (allowPianTurn && (xiji.subtypes || []).indexOf(excessName) >= 0) {
      if (SPECIAL_PIAN[target.god] && (controlled || drained)) {
        return { dir: '0', reason: '病重主体' + excessName + (controlled ? '受大运克制' : '生大运得泄') + '，先转中性' };
      }
      return { dir: '-', reason: '病重主体' + excessName + '，锁定为忌' };
    }
    if (allowPianTurn && SPECIAL_PIAN[target.god] && xiji.dir[target.el] === '-') {
      if (controlled || drained) {
        return { dir: '+', reason: controlled ? '偏神受大运克制，转为喜用' : '偏神生大运得泄，转为喜用' };
      }
    }
    return result;
  }
  function baseStageSlider(dir, god, side) {
    if (dir === '+') return 35;
    if (dir === '-') return side === 'outer' && !SPECIAL_PIAN[god] ? 50 : 65;
    return 50;
  }
  function overlayYearSlider(pos, yearDir) {
    var shifted = pos + (yearDir === '+' ? -15 : yearDir === '-' ? 15 : 0);
    return Math.max(25, Math.min(75, shifted));
  }
  function sourceOfGan(pillar) {
    var p = chart.pillars[pillar];
    if (!p || p.empty || !p.gan) return null;
    var ch = p.gan.text;
    return { char: ch, god: LunarUtil.SHI_SHEN[dayGan + ch], el: base.ganWx(ch), pillar: pillar, sourceKind: 'gan' };
  }
  function hiddenSource(pillar, ch, rank) {
    var val = 1;
    for (var i = 0; i < (m.hiddenUnits || []).length; i++) {
      var u = m.hiddenUnits[i];
      if (u.pillar === pillar && u.rank === rank) { val = u.val; break; }
    }
    return {
      char: ch,
      god: LunarUtil.SHI_SHEN[dayGan + ch],
      el: base.ganWx(ch),
      energy: val,
      pillar: pillar,
      sourceKind: rank === 0 ? 'zhiMain' : 'zhiVisible'
    };
  }
  var visibleGan = {};
  [0, 1, 3].forEach(function (pillar) {
    var src = sourceOfGan(pillar);
    if (src) visibleGan[src.char] = true;
  });
  function sourcesOfBranch(pillar, luckGanChar) {
    var p = chart.pillars[pillar];
    if (!p || p.empty || !p.zhi) return [];
    var hides = LunarUtil.ZHI_HIDE_GAN[p.zhi.text] || [];
    var seen = {}, out = [];
    hides.forEach(function (ch, rank) {
      if (rank > 0 && !visibleGan[ch] && ch !== luckGanChar) return;
      var src = hiddenSource(pillar, ch, rank);
      if (ch === luckGanChar) src.activation = '大运天干透出';
      if (!seen[src.god]) { seen[src.god] = true; out.push(src); }
    });
    return out;
  }
  function luckGanSource(dy) {
    var ch = dy.ganZhi.charAt(0);
    return { char: ch, god: LunarUtil.SHI_SHEN[dayGan + ch], el: base.ganWx(ch), sourceKind: 'luckGan' };
  }
  function luckZhiSource(dy) {
    var zhi = dy.ganZhi.charAt(1);
    var ch = LunarUtil.ZHI_HIDE_GAN[zhi][0];
    return { char: ch, zhi: zhi, god: LunarUtil.SHI_SHEN[dayGan + ch], el: base.ganWx(ch), sourceKind: 'luckZhi' };
  }
  var natalGodSet = {};
  stems.forEach(function (c) { natalGodSet[c.god] = true; });
  (m.hiddenUnits || []).forEach(function (u) { natalGodSet[u.god] = true; });

  function makeStageItem(src, side, luck, allowPianTurn) {
    var t = TEMP[src.god] || { name: src.god, pol: '', lbl: '', rbl: '', desc: '', con: '' };
    var effective = stageDir(src, luck, allowPianTurn);
    var isExcessShangGuan = src.god === '伤官' && (xiji.subtypes || []).indexOf('伤官过旺') >= 0;
    return {
      god: src.god, name: t.name, pol: t.pol, lbl: t.lbl, rbl: t.rbl,
      catImage: tenGodCatImage(src.god),
      desc: narrativeText(src.god, side, 'desc'),
      con: narrativeText(src.god, side, 'con'),
      descLabel: '优点', conLabel: '留意',
      cls: base.WX_CLS[src.el],
      slider: baseStageSlider(effective.dir, src.god, side),
      traitDir: effective.dir,
      traitOverride: effective.reason,
      activation: src.activation || '',
      extraCon: isExcessShangGuan ? ['对抗权威', '漠视规则'] : [],
      copyKind: side,
      sourceChar: src.char,
      side: side,
      energy: src.energy || 1
    };
  }
  function makeYearOverlay(year, gz) {
    if (!gz || gz.length < 2) return null;
    var ch = gz.charAt(0);
    var god = LunarUtil.SHI_SHEN[dayGan + ch];
    var el = base.ganWx(ch);
    var L0 = LIUNIAN[god] || { lbl: '', rbl: '', desc: '' };
    var effective = fixedGodDir(god, el);
    return {
      god: god,
      name: year + ' · ' + god,
      slider: effective.dir === '+' ? 35 : effective.dir === '-' ? 65 : 50,
      bubbleWeight: 0.7,
      lbl: L0.lbl, rbl: L0.rbl, desc: L0.desc,
      traitDir: effective.dir,
      reason: effective.reason,
      char: ch
    };
  }
  function makeStageLayer(sources, side, luck, overlay, allowPianTurn) {
    if (!sources || !sources.length) return null;
    var items = sources.map(function (src) { return makeStageItem(src, side, luck, allowPianTurn); });
    if (side === 'outer' && overlay) {
      items.forEach(function (it) { it.slider = overlayYearSlider(it.slider, overlay.traitDir); });
    }
    var main = items[0];
    var layer = {};
    for (var k in main) layer[k] = main[k];
    layer.items = items;
    layer.name = items.map(function (it) { return it.name; }).join(' · ');
    layer.title = side === 'outer' ? '人前 · 行为模式' : '内在 · 心性底色';
    layer.help = side === 'outer'
      ? '在表达、选择与做事时自然呈现的行为方式。'
      : '在独处、亲密关系和压力之下更真实的内在倾向。';
    layer.bubbles = buildTraitBubbles(items, side === 'outer' ? overlay : null, side);
    if (side === 'outer' && overlay) layer.luckName = overlay.name;
    return layer;
  }

  var STAGES = [
    { key: 'youth', label: '少年', age: '0-19岁', min: 0, max: 19 },
    { key: 'young', label: '青年', age: '20-34岁', min: 20, max: 34 },
    { key: 'middle', label: '中年', age: '35-49岁', min: 35, max: 49 },
    { key: 'old', label: '老年', age: '50岁以后', min: 50, max: 200 }
  ];
  var currentYear = new Date().getFullYear();
  var birthYear = new Date(chart.meta.timestamp).getFullYear();
  var currentAge = currentYear - birthYear;
  (chart.daYun || []).forEach(function (dy) {
    if (currentYear < dy.startYear || currentYear > dy.endYear) return;
    (dy.liuNian || []).forEach(function (ln) {
      if (ln.year === currentYear) currentAge = ln.age;
    });
  });
  var currentStageKey = currentAge < 20 ? 'youth' : currentAge < 35 ? 'young' : currentAge < 50 ? 'middle' : 'old';
  var luckByStage = opts.luckByStage || {};
  var yearByStage = opts.yearByStage || {};

  function intersectLuck(def) {
    var out = [];
    (chart.daYun || []).forEach(function (dy) {
      var start = dy.isQian ? 0 : dy.startAge;
      var end = dy.endAge;
      var a = Math.max(def.min, start), b = Math.min(def.max, end);
      if (a > b) return;
      out.push({
        index: dy.index,
        label: a + '-' + b + '岁',
        gz: dy.isQian ? '童限' : dy.ganZhi,
        isQian: !!dy.isQian,
        startAge: a,
        endAge: b,
        dy: dy
      });
    });
    return out;
  }
  function selectedSegment(def, segments) {
    var wanted = luckByStage[def.key];
    for (var i = 0; i < segments.length; i++) if (segments[i].index === wanted) return segments[i];
    if (def.key === currentStageKey) {
      for (var j = 0; j < segments.length; j++) {
        if (currentYear >= segments[j].dy.startYear && currentYear <= segments[j].dy.endYear) return segments[j];
      }
    }
    return segments[0] || null;
  }

  var stagePortraits = STAGES.map(function (def, idx) {
    var segments = intersectLuck(def);
    var segment = selectedSegment(def, segments);
    segments.forEach(function (s) { s.active = !!segment && s.index === segment.index; });
    if (!segment || segment.isQian) {
      return {
        key: def.key, label: def.label, age: def.age,
        index: idx + 1, indexText: '0' + (idx + 1),
        ganText: '童', zhiText: '限', ganCls: 'muted', zhiCls: 'muted',
        luckSegments: segments, selectedLuckIndex: segment ? segment.index : null,
        empty: true, qian: true,
        note: '童限阶段不展示行为与心性气泡。',
        summary: '童限不展示心性', outerLayer: null, innerLayer: null
      };
    }

    var dy = segment.dy;
    var dyGanSrc = luckGanSource(dy), dyZhiSrc = luckZhiSource(dy);
    var outerSources, innerSources, allowPianTurn = def.key !== 'youth';
    if (def.key === 'youth') {
      outerSources = natalGodSet[dyGanSrc.god] ? [dyGanSrc] : [sourceOfGan(1)];
      innerSources = natalGodSet[dyZhiSrc.god] ? [dyZhiSrc] : sourcesOfBranch(1);
    } else if (def.key === 'young') {
      outerSources = [sourceOfGan(1)];
      innerSources = sourcesOfBranch(1, dyGanSrc.char);
    } else if (def.key === 'middle') {
      outerSources = [sourceOfGan(1)];
      innerSources = sourcesOfBranch(2, dyGanSrc.char);
    } else {
      outerSources = [sourceOfGan(3)];
      innerSources = sourcesOfBranch(3, dyGanSrc.char);
    }
    outerSources = outerSources.filter(function (s) { return !!s; });
    innerSources = innerSources.filter(function (s) { return !!s; });

    var selYear = yearByStage[def.key];
    var lnGZ = '';
    (dy.liuNian || []).forEach(function (ln) {
      if (ln.year === selYear) lnGZ = ln.ganZhi;
    });
    var overlay = lnGZ ? makeYearOverlay(selYear, lnGZ) : null;
    // 天干看地支得根，地支看天干透出，因此20岁以后两条岁运作用通道交叉。
    if (allowPianTurn && outerSources.length) {
      var luckHides = LunarUtil.ZHI_HIDE_GAN[dy.ganZhi.charAt(1)] || [];
      if (luckHides.indexOf(outerSources[0].char) >= 0) outerSources[0].activation = '大运地支同字通根';
    }
    var outerLuck = allowPianTurn ? dyZhiSrc : dyGanSrc;
    var innerLuck = allowPianTurn ? dyGanSrc : dyZhiSrc;
    var outerLayer = makeStageLayer(outerSources, 'outer', outerLuck, overlay, allowPianTurn);
    var innerLayer = makeStageLayer(innerSources, 'inner', innerLuck, null, allowPianTurn);
    var missingTime = def.key === 'old' && chart.meta.unknownTime;
    if (missingTime) { outerLayer = null; innerLayer = null; }

    return {
      key: def.key, label: def.label, age: def.age,
      index: idx + 1, indexText: '0' + (idx + 1),
      dyIndex: dy.index, selectedLuckIndex: dy.index,
      luckSegments: segments,
      gz: dy.ganZhi,
      ganText: dy.ganZhi.charAt(0), zhiText: dy.ganZhi.charAt(1),
      ganCls: dy.gan ? dy.gan.cls : base.WX_CLS[dyGanSrc.el],
      zhiCls: dy.zhi ? dy.zhi.cls : base.WX_CLS[dyZhiSrc.el],
      luckLabel: segment.label,
      hasYear: !!overlay, luckYear: overlay ? selYear : null,
      empty: missingTime,
      missingTime: missingTime,
      summary: missingTime ? '缺少时柱' : '人前 ' + outerLayer.name + ' · 内在 ' + innerLayer.name,
      note: missingTime
        ? '缺少时柱（出生时辰未知），无法判断老年阶段的时干行为与时支心性。'
        : segment.label + '行「' + dy.ganZhi + '」大运。阶段十神以原局喜忌为底，大运负责通根、透出与制泄；流年天干只叠加行为滑标。',
      outerLayer: outerLayer,
      innerLayer: innerLayer
    };
  });

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
      desc: bt0.desc || '', zhis: lnZhi,
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
        desc: bt.desc || '', zhis: bagg[bg].zhis.join('、'),
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
    outerList: outerList,
    innerList: innerList,
    traitPattern: traitPattern,
    branchList: branchList,
    relations: rels,
    stagePortraits: stagePortraits,
    currentStageKey: currentStageKey,
    xiji: xiji,
    zhengNow: zhengNow, pianNow: 100 - zhengNow,
    hasLuck: m.hasLuck,
    hasTime: !chart.meta.unknownTime
  };
}

module.exports = { build: build };
