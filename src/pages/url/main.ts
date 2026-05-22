import { mountShell } from '../../lib/shell';
import { toast } from '../../lib/toast';
import { copyText } from '../../lib/clipboard';
import { encodeC, encodeU, decode, parseURL, batch, looksEncoded } from '../../core/url';

mountShell(undefined, undefined, 'url');

function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error('missing: ' + sel);
  return el;
}

type Fn = 'C' | 'U';

export function init(): void {
  let fn: Fn = 'C';
  let isBatch = false;

  const inEl = $<HTMLTextAreaElement>('#u-in');
  const outEl = $<HTMLTextAreaElement>('#u-out');

  $('#fn-seg').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      $('#fn-seg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      fn = (b as HTMLButtonElement).dataset.fn as Fn;
    });
  });

  $('#batch-seg').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      $('#batch-seg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      isBatch = (b as HTMLButtonElement).dataset.b === 'batch';
      inEl.placeholder = isBatch
        ? '每行一个，空行保留'
        : '例：https://example.com/搜索?q=你好';
    });
  });

  function runEncodeWith(encoder: (s: string) => string) {
    const text = inEl.value;
    if (!text) { outEl.value = ''; return; }
    outEl.value = isBatch ? batch(text, encoder) : encoder(text);
  }

  function doEncodeC() {
    fn = 'C';
    // sync segmented UI
    $('#fn-seg').querySelectorAll('button').forEach((x) => {
      x.classList.toggle('active', (x as HTMLButtonElement).dataset.fn === 'C');
    });
    runEncodeWith(encodeC);
  }
  function doEncodeU() {
    fn = 'U';
    $('#fn-seg').querySelectorAll('button').forEach((x) => {
      x.classList.toggle('active', (x as HTMLButtonElement).dataset.fn === 'U');
    });
    runEncodeWith(encodeU);
  }
  function doDecode() {
    const text = inEl.value;
    if (!text) { outEl.value = ''; return; }
    if (isBatch) {
      outEl.value = batch(text, (l) => decode(l).value);
    } else {
      const r = decode(text);
      outEl.value = r.value;
      if (!r.ok) toast(r.error || '解码失败', 'err');
    }
  }
  function doAuto() {
    const t = inEl.value;
    if (looksEncoded(t)) doDecode();
    else if (fn === 'U') doEncodeU(); else doEncodeC();
  }

  $('#u-encode').addEventListener('click', doEncodeC);
  $('#u-encode-uri').addEventListener('click', doEncodeU);
  $('#u-decode').addEventListener('click', doDecode);
  $('#u-auto').addEventListener('click', doAuto);
  $('#u-swap').addEventListener('click', () => {
    const a = inEl.value;
    inEl.value = outEl.value;
    outEl.value = a;
  });
  $('#u-copy').addEventListener('click', async () => {
    if (!outEl.value) { toast('暂无内容', 'err'); return; }
    const ok = await copyText(outEl.value);
    toast(ok ? '已复制' : '复制失败', ok ? 'ok' : 'err');
  });
  $('#u-clear').addEventListener('click', () => { inEl.value = ''; outEl.value = ''; });

  // URL 解析
  const parseIn = $<HTMLInputElement>('#parse-in');
  const parseErr = $('#parse-err');
  const parseFields = $('#parse-fields');
  const qtable = $<HTMLTableElement>('#qtable');
  const qtbody = qtable.querySelector('tbody')!;

  function renderParse() {
    const s = parseIn.value.trim();
    if (!s) {
      parseErr.hidden = true; parseFields.hidden = true; qtable.hidden = true;
      qtbody.innerHTML = '';
      return;
    }
    const r = parseURL(s);
    if (!r.ok) {
      parseErr.hidden = false;
      parseErr.textContent = r.error || '无法解析';
      parseFields.hidden = true;
      qtable.hidden = true;
      return;
    }
    parseErr.hidden = true;
    parseFields.hidden = false;
    parseFields.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => {
      const k = el.dataset.k as keyof typeof r;
      el.textContent = (r[k] as string) || '—';
    });
    qtable.hidden = r.query.length === 0;
    qtbody.innerHTML = '';
    for (const [k, v] of r.query) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHTML(k)}</td><td>${escapeHTML(v)}</td><td><button type="button">复制</button></td>`;
      tr.querySelector('button')!.addEventListener('click', async () => {
        const ok = await copyText(v);
        toast(ok ? `已复制 ${k}` : '复制失败', ok ? 'ok' : 'err');
      });
      qtbody.appendChild(tr);
    }
  }
  parseIn.addEventListener('input', renderParse);
}

function escapeHTML(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
