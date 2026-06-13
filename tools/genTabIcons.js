// 生成 tabBar 图标 PNG（浅色底版）
// 普通态 #9AA0B5，选中态 #6D5DF6；抗锯齿由超采样实现
var fs = require('fs');
var zlib = require('zlib');
var path = require('path');

var SIZE = 81;        // 输出像素
var SS = 4;           // 超采样
var OUT = path.join(__dirname, '../miniprogram/images/tab');

// ---- 形状（坐标基于 0..81 画布）----
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function segDist(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  var l2 = dx * dx + dy * dy;
  var t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return dist(px, py, x1 + t * dx, y1 + t * dy);
}
function inDisc(p, s) { return dist(p.x, p.y, s.cx, s.cy) <= s.r; }
function inRing(p, s) { return Math.abs(dist(p.x, p.y, s.cx, s.cy) - s.r) <= s.t / 2; }
function inCap(p, s) { return segDist(p.x, p.y, s.x1, s.y1, s.x2, s.y2) <= s.t / 2; }
function inTri(p, s) {
  var d1 = sign(p, s.a, s.b), d2 = sign(p, s.b, s.c), d3 = sign(p, s.c, s.a);
  var neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  var pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(neg && pos);
}
function sign(p, a, b) { return (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y); }

function test(p, shapes) {
  for (var i = 0; i < shapes.length; i++) {
    var s = shapes[i];
    if (s.k === 'disc' && inDisc(p, s)) return true;
    if (s.k === 'ring' && inRing(p, s)) return true;
    if (s.k === 'cap' && inCap(p, s)) return true;
    if (s.k === 'tri' && inTri(p, s)) return true;
  }
  return false;
}

// 图标定义
var ICONS = {
  // 排盘：星盘（外环 + 内环 + 中心 + 四向刻度）
  paipan: [
    { k: 'ring', cx: 40, cy: 40, r: 30, t: 5 },
    { k: 'ring', cx: 40, cy: 40, r: 16, t: 3.4 },
    { k: 'disc', cx: 40, cy: 40, r: 3.6 },
    { k: 'cap', x1: 40, y1: 4, x2: 40, y2: 16, t: 5 },
    { k: 'cap', x1: 40, y1: 64, x2: 40, y2: 76, t: 5 },
    { k: 'cap', x1: 4, y1: 40, x2: 16, y2: 40, t: 5 },
    { k: 'cap', x1: 64, y1: 40, x2: 76, y2: 40, t: 5 }
  ],
  // 记录：列表（三行 + 前导圆点）
  records: [
    { k: 'disc', cx: 19, cy: 25, r: 4.2 },
    { k: 'disc', cx: 19, cy: 40, r: 4.2 },
    { k: 'disc', cx: 19, cy: 55, r: 4.2 },
    { k: 'cap', x1: 32, y1: 25, x2: 61, y2: 25, t: 6.4 },
    { k: 'cap', x1: 32, y1: 40, x2: 61, y2: 40, t: 6.4 },
    { k: 'cap', x1: 32, y1: 55, x2: 61, y2: 55, t: 6.4 }
  ],
  // 疗愈：心形（两圆 + 倒三角）
  healing: [
    { k: 'disc', cx: 30, cy: 31, r: 13 },
    { k: 'disc', cx: 50, cy: 31, r: 13 },
    { k: 'tri', a: { x: 18, y: 36 }, b: { x: 62, y: 36 }, c: { x: 40, y: 64 } }
  ],
  // 我的：人形（头 + 肩）
  mine: [
    { k: 'disc', cx: 40, cy: 28, r: 13.5 },
    { k: 'cap', x1: 27, y1: 58, x2: 53, y2: 58, t: 34 }
  ]
};

function crc32(buf) {
  var c, table = crc32._t;
  if (!table) {
    table = crc32._t = [];
    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
  }
  c = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  var typeBuf = Buffer.from(type, 'ascii');
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function writePNG(file, rgba, w, h) {
  var sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  var raw = Buffer.alloc((w * 4 + 1) * h);
  for (var y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  var idat = zlib.deflateSync(raw, { level: 9 });
  fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

function render(shapes, hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  var rgba = Buffer.alloc(SIZE * SIZE * 4);
  for (var y = 0; y < SIZE; y++) {
    for (var x = 0; x < SIZE; x++) {
      var hit = 0;
      for (var sy = 0; sy < SS; sy++) {
        for (var sx = 0; sx < SS; sx++) {
          var p = { x: (x + (sx + 0.5) / SS) / SIZE * 81, y: (y + (sy + 0.5) / SS) / SIZE * 81 };
          if (test(p, shapes)) hit++;
        }
      }
      var a = Math.round(255 * hit / (SS * SS));
      var i = (y * SIZE + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
    }
  }
  return rgba;
}

Object.keys(ICONS).forEach(function (name) {
  writePNG(path.join(OUT, name + '.png'), render(ICONS[name], '#9AA0B5'), SIZE, SIZE);
  writePNG(path.join(OUT, name + '-on.png'), render(ICONS[name], '#6D5DF6'), SIZE, SIZE);
  console.log('generated', name);
});
console.log('done');
