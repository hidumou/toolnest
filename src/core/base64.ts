/**
 * Base64 编解码核心。字符串走 TextEncoder + 分块；文件走 ArrayBuffer + 分块。
 */

const CHUNK = 0x8000; // 32K，避免 String.fromCharCode 爆栈

function bytesToBase64(bytes: Uint8Array, urlSafe: boolean): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    bin += String.fromCharCode.apply(null, Array.from(sub) as number[]);
  }
  let b64 = btoa(bin);
  if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return b64;
}

function base64ToBytes(s: string, urlSafe: boolean): Uint8Array {
  let str = s.trim().replace(/\s+/g, '');
  if (urlSafe) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = str.length % 4;
    if (pad) str += '='.repeat(4 - pad);
  }
  // 自动补 padding
  if (!urlSafe && str.length % 4 !== 0 && !/=$/.test(str)) {
    str += '='.repeat(4 - (str.length % 4));
  }
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeText(s: string, urlSafe: boolean): string {
  const bytes = new TextEncoder().encode(s);
  return bytesToBase64(bytes, urlSafe);
}

export function decodeText(s: string, urlSafe: boolean): string {
  const bytes = base64ToBytes(s, urlSafe);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function isLikelyBase64(s: string): boolean {
  const t = s.trim().replace(/\s+/g, '');
  if (t.length === 0) return false;
  // 标准或 url-safe 字符集
  return /^[A-Za-z0-9+/_=-]+$/.test(t) && t.length % 4 !== 1;
}

export async function encodeFile(file: File, urlSafe: boolean): Promise<string> {
  // 现代写法：Blob.arrayBuffer() 是 Promise API，比 FileReader 简洁。
  // 兜底：极旧浏览器仍可走 FileReader（pnpm build 目标默认是 modern browsers，所以这里直接现代写法）
  const buf = await file.arrayBuffer();
  return bytesToBase64(new Uint8Array(buf), urlSafe);
}

/** 嗅探常见文件头返回 MIME / 扩展名 */
function sniffMime(bytes: Uint8Array): { mime: string; ext: string } {
  const b = bytes;
  const has = (sig: number[], off = 0) => sig.every((v, i) => b[off + i] === v);
  if (has([0x89, 0x50, 0x4e, 0x47])) return { mime: 'image/png', ext: 'png' };
  if (has([0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (has([0x47, 0x49, 0x46, 0x38])) return { mime: 'image/gif', ext: 'gif' };
  if (has([0x25, 0x50, 0x44, 0x46])) return { mime: 'application/pdf', ext: 'pdf' };
  if (has([0x50, 0x4b, 0x03, 0x04])) return { mime: 'application/zip', ext: 'zip' };
  if (has([0x49, 0x44, 0x33]) || (b[0] === 0xff && (b[1] ?? 0) >> 5 === 0b111))
    return { mime: 'audio/mpeg', ext: 'mp3' };
  if (has([0x66, 0x74, 0x79, 0x70], 4)) return { mime: 'video/mp4', ext: 'mp4' };
  if (has([0x52, 0x49, 0x46, 0x46]) && has([0x57, 0x45, 0x42, 0x50], 8))
    return { mime: 'image/webp', ext: 'webp' };
  // 是否像 UTF-8 文本？
  try {
    const txt = new TextDecoder('utf-8', { fatal: true }).decode(b.slice(0, 200));
    // 含可打印 ASCII 比例高
    if (/^[\x09\x0A\x0D\x20-\x7E -￿]*$/.test(txt)) {
      return { mime: 'text/plain', ext: 'txt' };
    }
  } catch {
    // not utf-8
  }
  return { mime: 'application/octet-stream', ext: 'bin' };
}

export async function decodeFile(
  s: string,
  urlSafe: boolean,
): Promise<{ bytes: Uint8Array; mime: string; ext: string }> {
  const bytes = base64ToBytes(s, urlSafe);
  const { mime, ext } = sniffMime(bytes);
  return { bytes, mime, ext };
}
