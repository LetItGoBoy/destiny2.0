// 修炼路径文案：页面负责交互，这里只维护可复用的练习内容与课题映射。
var TRACKS = [
  {
    key: 'action',
    name: '行动',
    title: '先完成一个最小动作',
    desc: '思考可以帮助你看清方向，但今天不要等到完全确定。',
    action: '挑一件拖着没开始的事，只做能在十分钟内完成的第一步。',
    reflection: '开始之前，我把哪件事想复杂了？'
  },
  {
    key: 'calm',
    name: '定心',
    title: '把事实和猜测分开',
    desc: '压力大时，大脑容易把预感当成已经发生的结论。',
    action: '把困扰写成两列：已经发生的事实，以及自己担心会发生的事。',
    reflection: '今天真正能处理的，只有哪一项？'
  },
  {
    key: 'boundary',
    name: '边界',
    title: '清楚地说一次不',
    desc: '边界不是拒绝关系，而是让自己的承诺保持可信。',
    action: '面对一个不想接下的请求，直接说“这次我做不了”，不做补偿性解释。',
    reflection: '拒绝之后，事情真的像我担心的那样糟吗？'
  },
  {
    key: 'cooperate',
    name: '合作',
    title: '让别人完成一部分',
    desc: '能承担不等于所有事情都必须亲自完成。',
    action: '挑一件可分出去的小事，说明结果标准，然后允许对方用自己的方法完成。',
    reflection: '我最难放手的，是结果、过程，还是控制感？'
  },
  {
    key: 'restraint',
    name: '节制',
    title: '延迟一个冲动决定',
    desc: '真正的选择，不需要在情绪最高的时候立刻完成。',
    action: '遇到消费、承诺或争论冲动时，至少等三十分钟再决定。',
    reflection: '三十分钟后，我真正想要的有没有变化？'
  },
  {
    key: 'expression',
    name: '表达',
    title: '先交付，再证明',
    desc: '观点让人看见你，结果才让人真正相信你。',
    action: '把一个最想表达的观点，变成一页文字、一个作品或一个可验证的结果。',
    reflection: '如果不争对错，我还能用什么结果说明自己？'
  },
  {
    key: 'confidence',
    name: '自信',
    title: '独立做一个小决定',
    desc: '自信不是确信自己永远正确，而是愿意承担选择的结果。',
    action: '选一件风险很小的事，不征求评价，自己决定并完整做完。',
    reflection: '今天哪一个结果证明，我比想象中更能承担？'
  }
];

var LESSON_TRACK = {
  印: 'action',
  官杀: 'calm',
  财: 'restraint',
  比劫: 'cooperate',
  食伤: 'expression',
  体旺: 'cooperate',
  体弱: 'confidence'
};

function findTrack(key) {
  for (var i = 0; i < TRACKS.length; i++) {
    if (TRACKS[i].key === key) return TRACKS[i];
  }
  return TRACKS[0];
}

module.exports = {
  tracks: TRACKS,
  lessonTrack: LESSON_TRACK,
  findTrack: findTrack
};
