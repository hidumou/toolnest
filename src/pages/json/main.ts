import { mountShell } from '../../lib/shell';
import { toast } from '../../lib/toast';
import { copyText } from '../../lib/clipboard';
import { highlightJSON, renderJSONTree } from '../../lib/highlight';
import {
  format, minify, sortKeys, escapeAsString, unescape,
  type FormatResult,
} from '../../core/json';

mountShell(undefined, undefined, 'json');

const EXAMPLE = `{
  "name": "ToolNest",
  "ok": true,
  "tools": ["timestamp", "json", "base64"],
  "meta": { "version": "0.1", "year": 2026 }
}`;

function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error('missing: ' + sel);
  return el;
}

type Indent = 2 | 4 | 'tab';

export function init(): void {
  const input = $<HTMLTextAreaElement>('#json-input');
  const output = $('#json-output');
  const errBanner = $('#err-banner');
  const autoPaste = $<HTMLInputElement>('#auto-paste');
  const indentSeg = $('#indent-seg');
  let indent: Indent = 2;

  function setIndentUI() {
    indentSeg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', (b as HTMLButtonElement).dataset.indent === String(indent));
    });
  }

  indentSeg.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      const v = (b as HTMLButtonElement).dataset.indent!;
      indent = v === 'tab' ? 'tab' : (Number(v) as 2 | 4);
      setIndentUI();
      // 重新美化
      if (input.value.trim()) run('format');
    });
  });

  function showError(res: Extract<FormatResult, { ok: false }>) {
    errBanner.hidden = false;
    errBanner.textContent = `第 ${res.line} 行 第 ${res.column} 列：${res.message}`;
    input.classList.add('has-error');
    // 移动光标
    const pos = lineColToPos(input.value, res.line, res.column);
    try {
      input.focus();
      input.setSelectionRange(pos, pos);
    } catch { /* ignore */ }
  }
  function clearError() {
    errBanner.hidden = true;
    errBanner.textContent = '';
    input.classList.remove('has-error');
  }

  function lineColToPos(text: string, line: number, col: number): number {
    let pos = 0, l = 1;
    while (l < line && pos < text.length) {
      if (text[pos] === '\n') l++;
      pos++;
    }
    return Math.min(text.length, pos + Math.max(0, col - 1));
  }

  /** 普通高亮（不带折叠）。用于压缩 / 转义 / 反转义 / 解析失败时。 */
  function renderFlat(text: string) {
    output.innerHTML = highlightJSON(text);
  }

  /** 带折叠的树形高亮。需要传入已解析的值。 */
  function renderTree(value: unknown) {
    output.innerHTML = renderJSONTree(value, indent);
  }

  function run(kind: 'format' | 'minify' | 'sort' | 'escape' | 'unescape') {
    const text = input.value;
    if (!text.trim() && kind !== 'unescape' && kind !== 'escape') {
      output.textContent = '';
      clearError();
      return;
    }
    let res: FormatResult;
    if (kind === 'format') res = format(text, indent);
    else if (kind === 'minify') res = minify(text);
    else if (kind === 'sort') res = sortKeys(text, indent);
    else if (kind === 'escape') { res = { ok: true, output: escapeAsString(text) }; }
    else /* unescape */ { res = { ok: true, output: unescape(text) }; }

    if (!res.ok) {
      showError(res);
      output.textContent = '';
      return;
    }
    clearError();

    // 美化 / 排序：渲染为可折叠树。其它操作渲染为平铺高亮。
    if (kind === 'format' || kind === 'sort') {
      try {
        renderTree(JSON.parse(res.output));
      } catch {
        renderFlat(res.output);
      }
    } else {
      renderFlat(res.output);
    }
  }

  function setAllCollapsed(collapsed: boolean) {
    output.querySelectorAll<HTMLElement>('.jn').forEach((n) => {
      n.dataset.collapsed = collapsed ? 'true' : 'false';
    });
  }

  $('#btn-format').addEventListener('click', () => run('format'));
  $('#btn-minify').addEventListener('click', () => run('minify'));
  $('#btn-sort').addEventListener('click', () => run('sort'));
  $('#btn-escape').addEventListener('click', () => run('escape'));
  $('#btn-unescape').addEventListener('click', () => run('unescape'));
  $('#btn-clear').addEventListener('click', () => {
    input.value = '';
    output.textContent = '';
    clearError();
    input.focus();
  });
  $('#btn-example').addEventListener('click', () => {
    input.value = EXAMPLE;
    run('format');
    toast('已注入示例', 'ok');
  });
  async function doCopy(btn?: HTMLElement) {
    const txt = output.textContent ?? '';
    if (!txt) { toast('暂无可复制内容', 'err'); return; }
    const ok = await copyText(txt);
    toast(ok ? '已复制' : '复制失败', ok ? 'ok' : 'err');
    if (ok && btn) {
      const orig = btn.textContent;
      btn.classList.add('ok');
      btn.textContent = '已复制';
      setTimeout(() => {
        btn.classList.remove('ok');
        if (orig != null) btn.textContent = orig;
      }, 1200);
    }
  }

  $('#btn-copy').addEventListener('click', (e) => doCopy(e.currentTarget as HTMLElement));
  $('#btn-copy-out').addEventListener('click', (e) => doCopy(e.currentTarget as HTMLElement));
  $('#btn-expand-all').addEventListener('click', () => setAllCollapsed(false));
  $('#btn-collapse-all').addEventListener('click', () => setAllCollapsed(true));

  // 点击折叠箭头或省略号：切换展开 / 收起
  output.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (!el.classList.contains('jn-toggle') && !el.classList.contains('jn-ellipsis')) return;
    const node = el.closest('.jn') as HTMLElement | null;
    if (!node) return;
    node.dataset.collapsed = node.dataset.collapsed === 'true' ? 'false' : 'true';
  });

  // 自动美化粘贴
  input.addEventListener('paste', () => {
    if (!autoPaste.checked) return;
    setTimeout(() => run('format'), 0);
  });
  // 输入时若没有 error，实时刷新输出
  input.addEventListener('input', () => {
    if (!input.value.trim()) { output.textContent = ''; clearError(); return; }
    // 静默尝试美化但不弹错（错误条由按钮触发）
    const res = format(input.value, indent);
    if (res.ok) {
      clearError();
      try { renderTree(JSON.parse(res.output)); }
      catch { renderFlat(res.output); }
    } else {
      renderFlat(input.value); /* 原文高亮（尽力） */
    }
  });

  // 快捷键
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); run('format'); }
    else if (k === 'm') { e.preventDefault(); run('minify'); }
  });

  setIndentUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
