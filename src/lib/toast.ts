export type ToastKind = 'ok' | 'err';

let activeTimer: number | undefined;
let activeEl: HTMLDivElement | undefined;

/**
 * 屏幕底部居中弹一条 toast。
 * @param msg 文本
 * @param kind 'ok' 绿色调，'err' 红色调，默认中性奶油
 */
export function toast(msg: string, kind?: ToastKind): void {
  if (typeof document === 'undefined') return;

  if (activeTimer !== undefined) {
    window.clearTimeout(activeTimer);
    activeTimer = undefined;
  }
  if (activeEl && activeEl.parentNode) {
    activeEl.parentNode.removeChild(activeEl);
    activeEl = undefined;
  }

  const el = document.createElement('div');
  el.className = `tn-toast${kind ? ' ' + kind : ''}`;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  activeEl = el;

  // 触发淡入
  requestAnimationFrame(() => el.classList.add('show'));

  activeTimer = window.setTimeout(() => {
    el.classList.remove('show');
    window.setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      if (activeEl === el) activeEl = undefined;
    }, 250);
  }, 2000);
}
