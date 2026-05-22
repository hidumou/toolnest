#!/usr/bin/env node
/**
 * 一次性 fixture 生成脚本 —— 不引入新依赖。
 *
 * 输出：
 *   tests/fixtures/sample.png   —— 200×150 PNG，#DDD6FE 浅紫背景，右下 60×40 #0F1E2E 黑块（模拟水印）
 *   tests/fixtures/sample.json
 *   tests/fixtures/sample.invalid.json
 *   tests/fixtures/sample.jwt.txt
 *   tests/fixtures/sample.expired.jwt.txt
 *   tests/fixtures/sample.future.jwt.txt
 *
 * PNG 手写：8 字节签名 + IHDR + IDAT(zlib(scanlines)) + IEND，CRC32 自实现。
 */
import { promises as fs } from 'node:fs';
import { createHmac } from 'node:crypto';
import zlib, { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_DIR = path.resolve(__dirname, '..', 'tests', 'fixtures');

// ---------- CRC32 表 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** 构造 RGB(8) 静态 PNG 字节 */
function makePng(width, height, fillRgb, rect /* {x,y,w,h,rgb} */) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: truecolor (RGB)
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // 像素 raw scanlines（每行前置 0 filter byte）
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const inRect =
        rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const rgb = inRect ? rect.rgb : fillRgb;
      const off = rowStart + 1 + x * 3;
      raw[off] = rgb[0];
      raw[off + 1] = rgb[1];
      raw[off + 2] = rgb[2];
    }
  }
  const idat = deflateSync(raw);

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- JWT 工具 ----------
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeJwt(payload, { secret = 'test-secret', alg = 'HS256' } = {}) {
  const header = { alg, typ: 'JWT' };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = b64url(createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

// ---------- 主流程 ----------
async function main() {
  await fs.mkdir(FIX_DIR, { recursive: true });

  // 1) PNG: 200×150, 背景 #DDD6FE, 右下 60×40 黑色块（x:140..200, y:110..150）
  const png = makePng(200, 150, [0xdd, 0xd6, 0xfe], { x: 140, y: 110, w: 60, h: 40, rgb: [0x0f, 0x1e, 0x2e] });
  await fs.writeFile(path.join(FIX_DIR, 'sample.png'), png);

  // 2) sample.json
  const sampleJson = {
    name: 'ToolNest',
    version: '0.1.0',
    tools: [
      { id: 'timestamp', label: 'Unix 时间戳互转', categories: ['dev', 'utility'] },
      { id: 'watermark', label: '豆包图片去水印', categories: ['image'] },
      { id: 'json', label: 'JSON 格式化', categories: ['dev'] },
    ],
    flags: { local: true, ads: false },
  };
  await fs.writeFile(path.join(FIX_DIR, 'sample.json'), JSON.stringify(sampleJson, null, 2));

  // 3) sample.invalid.json —— 缺逗号 + 多余逗号
  await fs.writeFile(
    path.join(FIX_DIR, 'sample.invalid.json'),
    `{
  "name": "ToolNest"
  "broken": true,
  "extra": [1, 2, 3,],
}
`,
  );

  // 4) 标准 JWT（带过期 exp = 2023 年的某时刻 1700000000）
  const sampleJwt = makeJwt({
    sub: '1234567890',
    name: 'ToolNest Tester',
    iat: 1_650_000_000,
    exp: 1_700_000_000, // 2023-11-14 — 已经在 2026 年的当下过期了
  });
  await fs.writeFile(path.join(FIX_DIR, 'sample.jwt.txt'), sampleJwt);

  // 5) 已过期 JWT（更明确：exp 小于"现在"很多）
  const expiredJwt = makeJwt({
    sub: 'expired-user',
    name: 'Expired',
    iat: 1_500_000_000,
    exp: 1_600_000_000, // 2020-09
  });
  await fs.writeFile(path.join(FIX_DIR, 'sample.expired.jwt.txt'), expiredJwt);

  // 6) 远未来 JWT + nbf 在未来
  const futureExp = Math.floor(new Date('2099-01-01T00:00:00Z').getTime() / 1000);
  const futureNbf = Math.floor(new Date('2050-01-01T00:00:00Z').getTime() / 1000);
  const futureJwt = makeJwt({
    sub: 'future-user',
    name: 'Future',
    iat: Math.floor(Date.now() / 1000),
    nbf: futureNbf,
    exp: futureExp,
  });
  await fs.writeFile(path.join(FIX_DIR, 'sample.future.jwt.txt'), futureJwt);

  // PNG sanity check：扫描 chunk 表，inflate IDAT，验证像素数
  try {
    let off = 8;
    while (off < png.length) {
      const len = png.readUInt32BE(off);
      const type = png.subarray(off + 4, off + 8).toString('ascii');
      if (type === 'IDAT') {
        const inflated = zlib.inflateSync(png.subarray(off + 8, off + 8 + len));
        const expected = 200 * 150 * 3 + 150; // RGB(8) + 1 filter byte/row
        if (inflated.length !== expected) {
          throw new Error(`IDAT size ${inflated.length} != expected ${expected}`);
        }
        break;
      }
      off += 12 + len;
    }
  } catch (e) {
    console.warn('[gen-fixtures] PNG sanity check failed:', (e && e.message) || e);
  }

  console.log('[gen-fixtures] wrote:');
  for (const f of [
    'sample.png',
    'sample.json',
    'sample.invalid.json',
    'sample.jwt.txt',
    'sample.expired.jwt.txt',
    'sample.future.jwt.txt',
  ]) {
    const stat = await fs.stat(path.join(FIX_DIR, f));
    console.log(`  tests/fixtures/${f}  (${stat.size} bytes)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
