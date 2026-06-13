// 用户偏好：显示字号、本人命盘绑定
var FS_KEY = 'tl_fontsize';
var SELF_KEY = 'tl_self';

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

module.exports = {
  getFontSize: getFontSize,
  setFontSize: setFontSize,
  getSelf: getSelf,
  setSelf: setSelf,
  clearSelf: clearSelf
};
