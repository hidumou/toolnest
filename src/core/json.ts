/**
 * JSON 工具的纯逻辑：美化 / 压缩 / 排序 / 字符串转义。
 */

export type FormatResult =
  | { ok: true; output: string }
  | { ok: false; line: number; column: number; message: string };

/** 把 JSON.parse 抛出的 SyntaxError 里的位置抽出来。兼容 V8 / Safari。 */
function extractPosition(err: unknown, text: string): { line: number; column: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  let pos = -1;
  const m1 = msg.match(/position (\d+)/i);
  const m2 = msg.match(/at position (\d+)/i);
  const m3 = msg.match(/column (\d+) line (\d+)/i); // Safari
  const m4 = msg.match(/line (\d+) column (\d+)/i);
  if (m1) pos = Number(m1[1]);
  else if (m2) pos = Number(m2[1]);
  if (m3) {
    return { line: Number(m3[2]), column: Number(m3[1]), message: msg };
  }
  if (m4) {
    return { line: Number(m4[1]), column: Number(m4[2]), message: msg };
  }
  if (pos >= 0) {
    return { ...positionToLineCol(text, pos), message: msg };
  }
  return { line: 1, column: 1, message: msg };
}

function positionToLineCol(text: string, pos: number): { line: number; column: number } {
  let line = 1, col = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') { line++; col = 1; } else { col++; }
  }
  return { line, column: col };
}

/** 把字符串转成 ' ' * indent，或 '\t' */
function indentChars(indent: number | 'tab'): string | number {
  if (indent === 'tab') return '\t';
  return indent;
}

export function format(text: string, indent: number | 'tab'): FormatResult {
  try {
    const v = JSON.parse(text);
    const ind = indentChars(indent);
    return { ok: true, output: JSON.stringify(v, null, ind as never) };
  } catch (e) {
    return { ok: false, ...extractPosition(e, text) };
  }
}

export function minify(text: string): FormatResult {
  try {
    const v = JSON.parse(text);
    return { ok: true, output: JSON.stringify(v) };
  } catch (e) {
    return { ok: false, ...extractPosition(e, text) };
  }
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      out[k] = sortValue((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

export function sortKeys(text: string, indent: number | 'tab'): FormatResult {
  try {
    const v = JSON.parse(text);
    const ind = indentChars(indent);
    return { ok: true, output: JSON.stringify(sortValue(v), null, ind as never) };
  } catch (e) {
    return { ok: false, ...extractPosition(e, text) };
  }
}

/** 转义为 JSON 字符串字面量（包外层引号） */
export function escapeAsString(text: string): string {
  return JSON.stringify(text);
}

/** 反转义：若文本是 JSON 字符串字面量则返回里面内容；否则原样返回 */
export function unescape(text: string): string {
  try {
    const v = JSON.parse(text);
    if (typeof v === 'string') return v;
    return text;
  } catch {
    return text;
  }
}
