/**
 * JSON 语法高亮。把文本切成 token 包成 <span class="tk-*">。
 * 不依赖第三方库。对非法 JSON 仍尝试尽量识别。
 */

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type TokenKind = 'string' | 'key' | 'number' | 'bool' | 'null' | 'punct' | 'ws' | 'other';

interface Token {
  kind: TokenKind;
  text: string;
}

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i]!;

    // 空白
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      let j = i;
      while (j < n && /\s/.test(src[j]!)) j++;
      out.push({ kind: 'ws', text: src.slice(i, j) });
      i = j;
      continue;
    }

    // 字符串
    if (c === '"') {
      let j = i + 1;
      while (j < n) {
        const ch = src[j]!;
        if (ch === '\\' && j + 1 < n) { j += 2; continue; }
        if (ch === '"') { j++; break; }
        j++;
      }
      const text = src.slice(i, j);
      // 看后面是不是冒号（去掉 ws 后）→ key
      let k = j;
      while (k < n && /\s/.test(src[k]!)) k++;
      const isKey = src[k] === ':';
      out.push({ kind: isKey ? 'key' : 'string', text });
      i = j;
      continue;
    }

    // 数字
    if (c === '-' || (c >= '0' && c <= '9')) {
      let j = i;
      if (src[j] === '-') j++;
      while (j < n && /[0-9]/.test(src[j]!)) j++;
      if (src[j] === '.') {
        j++;
        while (j < n && /[0-9]/.test(src[j]!)) j++;
      }
      if (src[j] === 'e' || src[j] === 'E') {
        j++;
        if (src[j] === '+' || src[j] === '-') j++;
        while (j < n && /[0-9]/.test(src[j]!)) j++;
      }
      out.push({ kind: 'number', text: src.slice(i, j) });
      i = j;
      continue;
    }

    // 关键字
    if (src.startsWith('true', i)) { out.push({ kind: 'bool', text: 'true' }); i += 4; continue; }
    if (src.startsWith('false', i)) { out.push({ kind: 'bool', text: 'false' }); i += 5; continue; }
    if (src.startsWith('null', i)) { out.push({ kind: 'null', text: 'null' }); i += 4; continue; }

    // 标点
    if ('{}[]:,'.includes(c)) {
      out.push({ kind: 'punct', text: c });
      i++;
      continue;
    }

    // 其它（异常字符），原样输出
    out.push({ kind: 'other', text: c });
    i++;
  }
  return out;
}

/**
 * 把 JSON 文本转成带高亮 span 的 HTML 字符串。
 * 调用方负责把结果用 innerHTML 放到 <pre> 里。
 */
export function highlightJSON(text: string): string {
  const tokens = tokenize(text);
  let html = '';
  for (const tk of tokens) {
    if (tk.kind === 'ws' || tk.kind === 'other') {
      html += escapeHTML(tk.text);
    } else {
      html += `<span class="tk-${tk.kind}">${escapeHTML(tk.text)}</span>`;
    }
  }
  return html;
}

/**
 * 把已解析的 JSON 值渲染为可折叠的高亮 HTML。
 * 关键点：折叠箭头与省略号通过 CSS ::before 注入，
 * 不进入 textContent — 复制时只会拿到纯净的 JSON。
 */
export function renderJSONTree(value: unknown, indent: number | 'tab' = 2): string {
  const pad = indent === 'tab' ? '\t' : ' '.repeat(indent as number);

  function escStr(s: string): string {
    // 用 JSON.stringify 处理转义，再剥掉外层引号，最后做 HTML 转义
    return escapeHTML(JSON.stringify(s).slice(1, -1));
  }

  function val(v: unknown, depth: number): string {
    if (v === null) return '<span class="tk-null">null</span>';
    if (typeof v === 'boolean') return `<span class="tk-bool">${v}</span>`;
    if (typeof v === 'number') {
      return `<span class="tk-number">${Number.isFinite(v) ? String(v) : 'null'}</span>`;
    }
    if (typeof v === 'string') return `<span class="tk-string">"${escStr(v)}"</span>`;
    if (Array.isArray(v)) return arr(v, depth);
    if (typeof v === 'object') return obj(v as Record<string, unknown>, depth);
    return escapeHTML(String(v));
  }

  function wrap(open: string, close: string, body: string): string {
    return (
      '<span class="jn" data-collapsed="false">' +
      '<span class="jn-toggle" role="button" aria-label="折叠/展开"></span>' +
      `<span class="tk-punct">${open}</span>` +
      '<span class="jn-ellipsis" role="button" aria-label="展开"></span>' +
      `<span class="jn-body">${body}</span>` +
      `<span class="tk-punct">${close}</span>` +
      '</span>'
    );
  }

  function arr(a: unknown[], depth: number): string {
    if (a.length === 0) return '<span class="tk-punct">[]</span>';
    const inner = pad.repeat(depth + 1);
    const close = pad.repeat(depth);
    let body = '';
    for (let i = 0; i < a.length; i++) {
      const comma = i < a.length - 1 ? '<span class="tk-punct">,</span>' : '';
      body += `\n${inner}${val(a[i], depth + 1)}${comma}`;
    }
    body += `\n${close}`;
    return wrap('[', ']', body);
  }

  function obj(o: Record<string, unknown>, depth: number): string {
    const keys = Object.keys(o);
    if (keys.length === 0) return '<span class="tk-punct">{}</span>';
    const inner = pad.repeat(depth + 1);
    const close = pad.repeat(depth);
    let body = '';
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]!;
      const comma = i < keys.length - 1 ? '<span class="tk-punct">,</span>' : '';
      body +=
        `\n${inner}<span class="tk-key">"${escStr(k)}"</span>` +
        '<span class="tk-punct">:</span> ' +
        `${val(o[k], depth + 1)}${comma}`;
    }
    body += `\n${close}`;
    return wrap('{', '}', body);
  }

  return val(value, 0);
}
