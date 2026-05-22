/**
 * JWT 解码（不验签）。三段式 base64url。
 */

function b64urlToBytes(s: string): Uint8Array {
  let str = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlDecodeUtf8(s: string): string {
  const bytes = b64urlToBytes(s);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export interface DecodedJWT {
  ok: boolean;
  error?: string;
  header?: unknown;
  payload?: unknown;
  signature?: string;
  raw?: { header: string; payload: string; signature: string };
}

export function decode(token: string): DecodedJWT {
  const t = token.trim();
  if (!t) return { ok: false, error: '请输入 JWT' };
  const parts = t.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: `JWT 必须包含三段（当前 ${parts.length} 段）` };
  }
  const [h, p, sig] = parts;
  try {
    const headerStr = b64urlDecodeUtf8(h!);
    const payloadStr = b64urlDecodeUtf8(p!);
    const header = JSON.parse(headerStr);
    const payload = JSON.parse(payloadStr);
    return {
      ok: true,
      header,
      payload,
      signature: sig!,
      raw: { header: h!, payload: p!, signature: sig! },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface HumanTime {
  absolute: string;
  relative: string;
  expired: boolean;
}

export function humanizeTime(unix: number, now: number = Date.now()): HumanTime {
  const ms = unix > 1e12 ? unix : unix * 1000; // 秒/毫秒兼容
  const d = new Date(ms);
  const diff = ms - now;
  const abs = Math.abs(diff);
  const sign = diff >= 0 ? '后' : '前';
  let rel = '';
  const sec = Math.round(abs / 1000);
  if (sec < 60) rel = `${sec} 秒${sign}`;
  else if (sec < 3600) rel = `${Math.round(sec / 60)} 分钟${sign}`;
  else if (sec < 86400) rel = `${Math.round(sec / 3600)} 小时${sign}`;
  else if (sec < 86400 * 30) rel = `${Math.round(sec / 86400)} 天${sign}`;
  else if (sec < 86400 * 365) rel = `${Math.round(sec / 86400 / 30)} 个月${sign}`;
  else rel = `${Math.round(sec / 86400 / 365)} 年${sign}`;

  let absolute = '无效时间';
  if (!isNaN(d.getTime())) {
    try {
      absolute = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZoneName: 'short',
      }).format(d);
    } catch {
      absolute = d.toISOString();
    }
  }

  return { absolute, relative: rel, expired: diff < 0 };
}

/** 标准示例 token（HS256，密钥 secret） */
export const EXAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3NjM2MDAwMDB9.' +
  'aGV5LXNpZw';
