import { mountShell } from '../../lib/shell';
import { toast } from '../../lib/toast';
import { copyText } from '../../lib/clipboard';
import { decode, humanizeTime, EXAMPLE_JWT } from '../../core/jwt';

mountShell(undefined, undefined, 'jwt');

function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error('missing: ' + sel);
  return el;
}

export function init(): void {
  const ta = $<HTMLTextAreaElement>('#jwt-in');
  const err = $('#jwt-err');
  const algEl = $('#alg-callout');
  const headerJson = $('#header-json');
  const payloadJson = $('#payload-json');
  const payloadTimes = $('#payload-times');
  const sigRaw = $('#sig-raw');

  function reset() {
    err.hidden = true;
    algEl.textContent = '—';
    headerJson.textContent = '—';
    payloadJson.textContent = '—';
    payloadTimes.innerHTML = '';
    sigRaw.textContent = '—';
  }

  function render() {
    const text = ta.value.trim();
    if (!text) { reset(); return; }
    const r = decode(text);
    if (!r.ok) {
      reset();
      err.hidden = false;
      err.textContent = r.error || '解析失败';
      return;
    }
    err.hidden = true;
    const h = r.header as Record<string, unknown>;
    const p = r.payload as Record<string, unknown>;
    algEl.textContent = String(h?.alg ?? '?');
    headerJson.textContent = JSON.stringify(h, null, 2);
    payloadJson.textContent = JSON.stringify(p, null, 2);
    sigRaw.textContent = r.signature || '';

    const timeKeys: Array<[string, string]> = [
      ['iat', '签发时间 (iat)'],
      ['nbf', '生效时间 (nbf)'],
      ['exp', '过期时间 (exp)'],
    ];
    payloadTimes.innerHTML = '';
    for (const [k, label] of timeKeys) {
      const v = p?.[k];
      if (typeof v !== 'number') continue;
      const h = humanizeTime(v);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;margin-bottom:4px';
      const badgeCls = k === 'exp' ? (h.expired ? 'badge expired' : 'badge alive') : 'badge alive';
      const badgeText = k === 'exp' ? (h.expired ? '已过期' : '有效') : '';
      const tid = k === 'exp' ? ' data-testid="tn-jwt-exp-badge"' : '';
      wrap.innerHTML = `
        <b style="color:var(--ink-2)">${label}</b>
        <span style="font-family:var(--font-mono);color:var(--muted)">${h.absolute}</span>
        <span style="color:var(--muted)">${h.relative}</span>
        ${badgeText ? `<span class="${badgeCls}"${tid}>${badgeText}</span>` : ''}
      `;
      payloadTimes.appendChild(wrap);
    }
  }

  ta.addEventListener('input', render);

  $('#j-example').addEventListener('click', () => {
    ta.value = EXAMPLE_JWT;
    render();
    toast('已注入示例 JWT', 'ok');
  });
  $('#j-clear').addEventListener('click', () => {
    ta.value = '';
    reset();
    ta.focus();
  });
  $('#j-copy-h').addEventListener('click', async () => {
    if (headerJson.textContent === '—') { toast('暂无可复制', 'err'); return; }
    const ok = await copyText(headerJson.textContent ?? '');
    toast(ok ? '已复制 Header' : '复制失败', ok ? 'ok' : 'err');
  });
  $('#j-copy-p').addEventListener('click', async () => {
    if (payloadJson.textContent === '—') { toast('暂无可复制', 'err'); return; }
    const ok = await copyText(payloadJson.textContent ?? '');
    toast(ok ? '已复制 Payload' : '复制失败', ok ? 'ok' : 'err');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
