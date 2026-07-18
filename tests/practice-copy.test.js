const test = require('node:test');
const assert = require('node:assert/strict');

const practiceCopy = require('../miniprogram/utils/practiceCopy.js');

test('修炼路径完整且不重名', () => {
  assert.equal(practiceCopy.tracks.length, 7);
  assert.equal(new Set(practiceCopy.tracks.map((item) => item.key)).size, 7);

  practiceCopy.tracks.forEach((item) => {
    ['key', 'name', 'title', 'desc', 'action', 'reflection'].forEach((field) => {
      assert.equal(typeof item[field], 'string');
      assert.ok(item[field].trim(), `${item.key}.${field} 不应为空`);
    });
  });
});

test('人生课题均能映射到有效修炼路径', () => {
  ['印', '官杀', '财', '比劫', '食伤', '体旺', '体弱'].forEach((lesson) => {
    const key = practiceCopy.lessonTrack[lesson];
    assert.ok(key, `${lesson} 缺少修炼映射`);
    assert.equal(practiceCopy.findTrack(key).key, key);
  });
});
