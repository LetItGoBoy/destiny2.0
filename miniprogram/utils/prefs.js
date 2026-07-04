// 用户偏好：显示字号、本人命盘绑定、最近排盘历史
var FS_KEY = 'tl_fontsize';
var SELF_KEY = 'tl_self';
var HISTORY_KEY = 'tl_history';
var HISTORY_MAX = 8;

// 字号档位：std 标准 / l 大 / xl 特大（默认大字号，方便阅读）
function getFontSize() {
  return wx.getStorageSync(FS_KEY) || 'l';
}

function setFontSize(v) {
  wx.setStorageSync(FS_KEY, v);
}

// 本人命盘快照 { _id, name, gender, baZi, dayGan, input }
function getSelf() {
  return wx.getStorageSync(SELF_KEY) || null;
}

function setSelf(snapshot) {
  wx.setStorageSync(SELF_KEY, snapshot);
}

function clearSelf() {
  wx.removeStorageSync(SELF_KEY);
}

// 最近排盘历史（本地，无论是否保存都记录；用于首页「最近排盘」）
// 每条 { input, name, gender, baZi, dateStr, ts }
function sigOf(input) {
  if (!input) return '';
  return [input.calendar, input.gender, input.year, input.month, input.day,
    input.unknownTime ? 'x' : (input.hour + ':' + input.minute),
    input.province || '', input.city || ''].join('|');
}

function getHistory() {
  return wx.getStorageSync(HISTORY_KEY) || [];
}

function pushHistory(rec) {
  if (!rec || !rec.input) return;
  var sig = sigOf(rec.input);
  var list = getHistory().filter(function (r) { return sigOf(r.input) !== sig; });
  rec.ts = Date.now();
  list.unshift(rec);
  if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
  try { wx.setStorageSync(HISTORY_KEY, list); } catch (e) { /* 存储满时忽略 */ }
}

function clearHistory() {
  wx.removeStorageSync(HISTORY_KEY);
}

module.exports = {
  getFontSize: getFontSize,
  setFontSize: setFontSize,
  getSelf: getSelf,
  setSelf: setSelf,
  clearSelf: clearSelf,
  getHistory: getHistory,
  pushHistory: pushHistory,
  clearHistory: clearHistory
};
