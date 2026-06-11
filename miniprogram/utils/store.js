// 八字记录存储
// 配置了云开发环境时存微信云数据库（集合 bazi_records，跟随微信账号跨设备）；
// 未配置或云端出错时自动降级为本地存储。

var LOCAL_KEY = 'tl_bazi_records';
var COLLECTION = 'bazi_records';

function cloudEnabled() {
  var app = getApp();
  return !!(app && app.globalData.cloudEnabled);
}

function localList() {
  return wx.getStorageSync(LOCAL_KEY) || [];
}

function localSave(list) {
  wx.setStorageSync(LOCAL_KEY, list);
}

/**
 * 保存一条记录
 * @param {object} record 排盘输入 + 摘要信息
 * @returns {Promise<{source: 'cloud'|'local'}>}
 */
function saveRecord(record) {
  record.createdAt = Date.now();
  if (cloudEnabled()) {
    return wx.cloud.database().collection(COLLECTION)
      .add({ data: record })
      .then(function () { return { source: 'cloud' }; })
      .catch(function () { return saveLocal(record); });
  }
  return saveLocal(record);
}

function saveLocal(record) {
  record._id = 'local_' + record.createdAt + '_' + Math.floor(Math.random() * 10000);
  var list = localList();
  list.unshift(record);
  if (list.length > 200) list = list.slice(0, 200);
  localSave(list);
  return Promise.resolve({ source: 'local' });
}

/**
 * 记录列表（按创建时间倒序）
 * @returns {Promise<{list: Array, source: 'cloud'|'local'}>}
 */
function listRecords() {
  if (cloudEnabled()) {
    return wx.cloud.database().collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
      .then(function (res) { return { list: res.data, source: 'cloud' }; })
      .catch(function () { return { list: localList(), source: 'local' }; });
  }
  return Promise.resolve({ list: localList(), source: 'local' });
}

/**
 * 删除一条记录
 */
function removeRecord(id) {
  if (cloudEnabled() && String(id).indexOf('local_') !== 0) {
    return wx.cloud.database().collection(COLLECTION).doc(id).remove();
  }
  var list = localList().filter(function (r) { return r._id !== id; });
  localSave(list);
  return Promise.resolve();
}

/**
 * 清空本地记录（云端记录不受影响）
 */
function clearLocal() {
  wx.removeStorageSync(LOCAL_KEY);
}

module.exports = {
  saveRecord: saveRecord,
  listRecords: listRecords,
  removeRecord: removeRecord,
  clearLocal: clearLocal
};
