/**
 * URL 编解码 + 解析。批量按行处理保留空行。
 */

export function encodeC(s: string): string {
  return encodeURIComponent(s);
}

export function encodeU(s: string): string {
  return encodeURI(s);
}

export function decode(s: string): { ok: boolean; value: string; error?: string } {
  try {
    return { ok: true, value: decodeURIComponent(s) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, value: s, error: `非法编码：${msg}` };
  }
}

export interface ParsedURL {
  ok: boolean;
  error?: string;
  protocol?: string;
  host?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  hash?: string;
  search?: string;
  query: Array<[string, string]>;
}

export function parseURL(s: string): ParsedURL {
  const trimmed = s.trim();
  if (!trimmed) {
    return { ok: false, error: '请输入 URL', query: [] };
  }
  try {
    const u = new URL(trimmed);
    const query: Array<[string, string]> = [];
    u.searchParams.forEach((v, k) => query.push([k, v]));
    return {
      ok: true,
      protocol: u.protocol,
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      hash: u.hash,
      search: u.search,
      query,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, query: [] };
  }
}

/** 按行处理，空行保留 */
export function batch(text: string, fn: (line: string) => string): string {
  return text
    .split('\n')
    .map((line) => (line === '' ? '' : fn(line)))
    .join('\n');
}

/** 简单判别：含 %XX 序列 → 倾向于解码 */
export function looksEncoded(s: string): boolean {
  return /%[0-9A-Fa-f]{2}/.test(s);
}
