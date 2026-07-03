// 性格画像（外显·天干版）
// 大部分人身上都有不止一种心性，只是配比不同。
// 「两种底色」（守正/求变）取天干地支所有十神（含藏干）统计；
// 「心性构成」取天干（最外显的一层）的十神，每种心性以一条优点(左)←→缺点(右)的轴呈现：
//   方向（偏优/偏缺）随身强身弱而定，幅度 = 失衡度 |P-50|×2 × 该心性在天干的相对能量，
//   故各心性会随大运/流年各自此消彼长，而非同步。措辞保持中立、收敛。
var energy = require('./energy.js');
var base = require('./base.js');
var relations = require('./relations.js');
var traitWords = require('./traitWords.js');
var lunarLib = require('../lunar.js');
var LunarUtil = lunarLib.LunarUtil;
var KE = base.KE;

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
  var kw = traitWords[god];
  if (!kw) return {};
  return kw[kind] || kw.outer || kw;
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

// p: {木:pct,...}；dmEl 日主五行；rootEls: {五行:1} 有本气根的五行集合
// 返回 { dir:{木:'+'/'-',...}, mode, disease }
function decideXiji(p, dmEl, rootEls) {
  rootEls = rootEls || {};
  var top = WX[0];
  WX.forEach(function (e) { if (p[e] > p[top]) top = e; });
  var dir = {}, mode, disease = null;
  var ti = 0, shiShang = 0, biJie = 0;
  WX.forEach(function (e) {
    var g = partyGod(dmEl, e);
    if (g === '食伤') { ti += p[e]; shiShang += p[e]; }
    if (g === '比劫') { ti += p[e]; biJie += p[e]; }
  });

  if (ti >= 40 && shiShang > biJie) {
    mode = '食伤偏旺'; // 输出太过：比劫转为喜用，食伤仍为忌，财官印沿用体旺取法。
    WX.forEach(function (e) { var g = partyGod(dmEl, e); dir[e] = (g === '食伤') ? '-' : '+'; });
  } else if (p[top] >= 40) {
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
    if (ti >= 40) {
      mode = '体旺';   // 喜财官印，忌食伤比劫
      WX.forEach(function (e) {
        var g = partyGod(dmEl, e);
        if (g === '印' && biJie > shiShang) dir[e] = '-';
        else dir[e] = (g === '财' || g === '官杀' || g === '印') ? '+' : '-';
      });
    } else {
      mode = '体弱';   // 喜比劫印，忌财官食伤
      WX.forEach(function (e) { var g = partyGod(dmEl, e); dir[e] = (g === '比劫' || g === '印') ? '+' : '-'; });
    }
  }
  return { dir: dir, mode: mode, disease: disease };
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

function luckSliderPos(d, godPct, god) {
  var mag = Math.min(25, Math.max(10, Math.round(Math.max(0, godPct) * 2)));
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
  var xiji = decideXiji(m.poolXiji || m.pool || {}, dmEl, rootEls);

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

  // —— 岁运叠加心性：取岁运天干十神（流年优先，否则大运），作为另一组气泡叠加 ——
  var luckGan = lnGan || ((opts.daYunGZ && opts.daYunGZ.length >= 2) ? opts.daYunGZ.charAt(0) : null);
  var luckZhi = lnZhi || ((opts.daYunGZ && opts.daYunGZ.length >= 2) ? opts.daYunGZ.charAt(1) : null);
  var luckKind = lnGan ? 'ln' : (opts.daYunGZ ? 'dy' : '');
  var luckTrait = null;
  var luckInnerTrait = null;
  function makeLuckTrait(god, el, energy, char) {
    var L0 = LIUNIAN[god] || { lbl: '', rbl: '', desc: '' };
    var luckEnergy = energy || 0.35;
    var luckPct = totalE > 0 ? luckEnergy / (totalE + luckEnergy) * 100 : 10;
    var luckDir = traitDir(god, el);
    var isDiseaseLuck = xiji.mode === '病重' && el === xiji.disease;
    if (isDiseaseLuck) luckDir = '-';
    return {
      god: god, name: god, cls: base.WX_CLS[el],
      catImage: tenGodCatImage(god),
      slider: isDiseaseLuck ? 75 : luckSliderPos(luckDir, luckPct, god),
      energy: luckEnergy,
      godPct: Math.round(luckPct),
      bubbleWeight: Math.max(0.45, Math.min(1.05, 0.45 + luckPct / 22)),
      lead: '',
      lbl: L0.lbl, rbl: L0.rbl, desc: L0.desc,
      traitDir: luckDir,
      diseaseHit: isDiseaseLuck,
      char: char || ''
    };
  }
  if (luckGan) {
    var lkGod = LunarUtil.SHI_SHEN[dayGan + luckGan];
    var lkEl = base.ganWx(luckGan);
    var luckUnit = null;
    (m.luckGanUnits || []).forEach(function (u) {
      if (u.kind === luckKind && u.char === luckGan) luckUnit = u;
    });
    luckTrait = makeLuckTrait(lkGod, lkEl, luckUnit ? luckUnit.val : 0.35, luckGan);
    luckTrait.dup = list.some(function (t) { return t.god === lkGod; });
  }
  if (luckZhi) {
    var luckMainGan = LunarUtil.ZHI_HIDE_GAN[luckZhi][0];
    var lzGod = LunarUtil.SHI_SHEN[dayGan + luckMainGan];
    var lzEl = base.ganWx(luckMainGan);
    var zhiUnit = null;
    (m.luckZhiUnits || []).forEach(function (u) {
      if (u.kind === luckKind && u.rank === 0 && u.char === luckMainGan) zhiUnit = u;
    });
    luckInnerTrait = makeLuckTrait(lzGod, lzEl, zhiUnit ? zhiUnit.val : 0.35, luckZhi);
  }

  function ganCellAt(pos) {
    for (var i = 0; i < (m.ganCells || []).length; i++) if (m.ganCells[i].pos === pos) return m.ganCells[i];
    return null;
  }
  function hiddenUnitAt(pillar, rank) {
    for (var i = 0; i < (m.hiddenUnits || []).length; i++) {
      var u = m.hiddenUnits[i];
      if (u.pillar === pillar && u.rank === rank) return u;
    }
    return null;
  }
  function hiddenMainAt(pillar) {
    return hiddenUnitAt(pillar, 0);
  }
  var coreInfo = CORE[dayGan] || { title: dayGan, text: '' };
  var natalGanChars = {};
  chart.pillars.forEach(function (p) {
    if (!p.empty && p.gan && p.gan.text) natalGanChars[p.gan.text] = true;
  });

  function layerFromGan(pillarIndex, posLabel) {
    var c = ganCellAt(posLabel);
    if (!c || c.isDay) return null;
    return makeTraitItem({
      god: c.god, el: c.el, cls: c.cls, energy: c.val,
      source: 'stageGan', sourceChar: c.char,
      sourceKind: 'gan', pillar: pillarIndex
    }, 0, c.val || 1, 'outer');
  }
  function layerFromZhi(pillarIndex) {
    var u = hiddenMainAt(pillarIndex);
    if (!u) return null;
    var pp = chart.pillars[pillarIndex];
    var hgs = pp && pp.zhi ? LunarUtil.ZHI_HIDE_GAN[pp.zhi.text] : [];
    return makeTraitItem({
      god: u.god, el: u.el, cls: base.WX_CLS[u.el], energy: u.val,
      source: 'stageZhi', sourceChar: hgs[0] || '',
      sourceKind: 'zhiMain', pillar: pillarIndex
    }, 0, u.val || 1, 'inner');
  }
  function layerFromMonthLing(stage) {
    var pillarIndex = 1;
    var pp = chart.pillars[pillarIndex];
    if (!pp || pp.empty || !pp.zhi) return null;
    var hgs = LunarUtil.ZHI_HIDE_GAN[pp.zhi.text] || [];
    var sources = [];
    for (var r = 0; r < hgs.length; r++) {
      if (r > 0 && !natalGanChars[hgs[r]]) continue;
      var u = hiddenUnitAt(pillarIndex, r);
      if (!u) continue;
      sources.push({
        god: u.god, el: u.el, cls: base.WX_CLS[u.el], energy: u.val,
        source: r === 0 ? '月令本气' : '月令透出',
        sourceChar: hgs[r],
        sourceKind: r === 0 ? 'zhiMain' : 'zhiExtra',
        pillar: pillarIndex,
        rank: r,
        transparent: r > 0
      });
    }
    if (!sources.length) return null;
    var maxEnergy = 0;
    sources.forEach(function (src) { if (src.energy > maxEnergy) maxEnergy = src.energy; });
    var items = sources.map(function (src, idx) {
      return makeTraitItem(src, idx, maxEnergy || src.energy || 1, 'inner');
    });
    var main = items[0];
    var extras = items.slice(1);
    var layer = {};
    for (var k in main) layer[k] = main[k];
    layer.name = [main].concat(extras).map(function (it) { return it.name; }).join(' + ');
    layer.god = [main].concat(extras).map(function (it) { return it.god; }).join(' + ');
    layer.source = 'monthLing';
    layer.sourceKind = 'monthLing';
    layer.bubbleTraits = [main].concat(extras);
    layer.transParents = extras.map(function (it) { return it.sourceChar + '透出为' + it.name; }).join('、');
    if (extras.length) {
      layer.desc = main.desc + ' 透出心性：' + extras.map(function (it) { return it.name + '，' + it.desc; }).join('；');
      layer.con = main.con + ' 透出也要留意：' + extras.map(function (it) { return it.name + '，' + it.con; }).join('；');
    }
    return layer;
  }
  function layerFromDayMaster() {
    return {
      god: '日主',
      name: coreInfo.title,
      catImage: '',
      pol: '',
      lbl: '',
      rbl: '',
      desc: coreInfo.text,
      con: '',
      descLabel: '底色',
      conLabel: '留意',
      cls: base.WX_CLS[base.ganWx(dayGan)],
      slider: 50,
      energy: 1,
      godPct: 0,
      traitDir: 'mid',
      copyKind: 'core',
      source: 'dayMaster',
      sourceKind: 'dayMaster',
      pillar: 2,
      bubbles: []
    };
  }
  function stageLayer(sm) {
    if (sm.sourceKind === 'dayMaster') return layerFromDayMaster();
    if (sm.sourceKind === 'monthLing') return layerFromMonthLing(sm);
    if (sm.sourceKind === 'zhiMain') return layerFromZhi(sm.pillar);
    return layerFromGan(sm.pillar, sm.pos);
  }
  function decorateLayer(stage, layer, luck) {
    if (!layer) return null;
    layer.title = stage.layerTitle;
    layer.help = stage.help;
    layer.bubbles = buildTraitBubbles(layer.sourceKind === 'dayMaster' ? [] : (layer.bubbleTraits || [layer]), luck, layer.copyKind || stage.copyKind || 'outer');
    if (luck) {
      layer.luckName = luck.name;
      layer.luckSlider = luck.slider;
      layer.luckLbl = luck.lbl;
      layer.luckRbl = luck.rbl;
    }
    return layer;
  }
  var stageMetaList = [
    { key: 'life1', label: '幼年', age: '1-8岁', phase: '初', theme: '先天底色 · 贯穿一生', sub: '初光', note: '幼年看最早被世界看见的那层气质。它不只属于小时候，也会像底色一样贯穿一生。', pillar: 0, pos: '年', sourceKind: 'gan', copyKind: 'outer', layerTitle: '先天底色', help: '最先露出来的气质、反应速度和面对外界时的自然姿态。' },
    { key: 'life2', label: '少时', age: '8-16岁', phase: '根', theme: '安全感 · 本能反应', sub: '藏根', note: '少时看内在反应怎么长出来：安全感、依赖方式、遇事先紧还是先松，都在这里开始成形。', pillar: 0, sourceKind: 'zhiMain', copyKind: 'inner', layerTitle: '本能底色', help: '更靠里的情绪底盘和安全感来源，会影响之后很多选择。' },
    { key: 'life3', label: '青春', age: '17-24岁', phase: '萌', theme: '求学试声 · 初入人群', sub: '试声', note: '青春看一个人怎样向外试探边界：想被怎样看见，也会用什么方式证明自己。', pillar: 1, pos: '月', sourceKind: 'gan', copyKind: 'outer', layerTitle: '入世姿态', help: '走向人群时更容易拿出来的表达方式、竞争方式和做事姿态。' },
    { key: 'life4', label: '青年', age: '25-32岁', phase: '令', theme: '月令承接 · 事业起步', sub: '承势', note: '青年看月支这层月令底色：本气一定表达，中气/余气只有透到天干时才加入阶段心性。', pillar: 1, sourceKind: 'monthLing', copyKind: 'inner', layerTitle: '月令底色', help: '月支像长期气候；透出的藏干会变成可见心性，直接混入这一段的气泡。' },
    { key: 'life5', label: '立身', age: '33-40岁', phase: '立', theme: '月令成势 · 立身选择', sub: '成势', note: '立身沿用月支心性，看月令底色如何在自我选择、事业方向和长期关系里真正成势。', pillar: 1, sourceKind: 'monthLing', copyKind: 'inner', layerTitle: '月令成势', help: '这一段继续看月支本气；若月令中气/余气透出，也会作为成势心性进入气泡。' },
    { key: 'life6', label: '成事', age: '41-48岁', phase: '成', theme: '亲密关系 · 长期成果', sub: '定心', note: '成事阶段看长期关系和稳定成果里的真实反应：亲密、合作、家庭与事业如何互相牵动。', pillar: 2, sourceKind: 'zhiMain', copyKind: 'inner', layerTitle: '关系底色', help: '更靠近亲密关系、长期承诺和日常相处里的真实反应。' },
    { key: 'life7', label: '远行', age: '49-56岁', phase: '远', theme: '后程规划 · 经验输出', sub: '远望', note: '远行阶段看后半程怎样重新安排生活，也看经验、资源和影响力怎样被表达出来。', pillar: 3, pos: '时', sourceKind: 'gan', copyKind: 'outer', layerTitle: '后程姿态', help: '后半程更容易显出来的处事方式、表达风格和安排能力。' },
    { key: 'life8', label: '归心', age: '57岁以后', phase: '归', theme: '归宿享福 · 自在晚景', sub: '归处', note: '归心阶段看最终更想回到什么生活状态：怎样享受、怎样放下，也怎样和后辈及世界相处。', pillar: 3, sourceKind: 'zhiMain', copyKind: 'inner', layerTitle: '晚境底色', help: '晚年更自然流露的内在状态，关系到舒适感、归属感和生活节奏。' }
  ];
  var stagePortraits = stageMetaList.map(function (sm, idx) {
    var pp = chart.pillars[sm.pillar];
    if (!pp || pp.empty || !pp.gan || !pp.zhi) {
      return {
        key: sm.key, label: sm.label, age: sm.age, phase: sm.phase, theme: sm.theme,
        sub: sm.sub, note: sm.note, index: idx + 1, indexText: idx < 9 ? '0' + (idx + 1) : String(idx + 1), empty: true
      };
    }
    var layer = stageLayer(sm);
    var luckForLayer = (sm.sourceKind === 'zhiMain' || sm.sourceKind === 'monthLing') ? luckInnerTrait : luckTrait;
    return {
      key: sm.key, label: sm.label, age: sm.age, phase: sm.phase, theme: sm.theme,
      sub: sm.sub, note: sm.note, index: idx + 1, indexText: idx < 9 ? '0' + (idx + 1) : String(idx + 1), empty: false,
      layer: decorateLayer(sm, layer, luckForLayer)
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
      desc = (TEMP[innerGod] || {}).desc || '';
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
      inner: ''
    };
  });

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
    traitBubbles: buildTraitBubbles(outerList, luckTrait, 'outer'),
    outerBubbles: buildTraitBubbles(outerList, luckTrait, 'outer'),
    innerBubbles: buildTraitBubbles(innerList, null, 'inner'),
    luckTrait: luckTrait,
    luckInnerTrait: luckInnerTrait,
    branchList: branchList,
    relations: rels,
    stages: stages,
    stagePortraits: stagePortraits,
    zhengNow: zhengNow, pianNow: 100 - zhengNow,
    hasLuck: m.hasLuck,
    hasTime: !chart.meta.unknownTime
  };
}

module.exports = { build: build };
