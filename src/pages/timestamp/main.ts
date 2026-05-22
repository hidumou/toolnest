import { mountShell } from '../../lib/shell';
import { toast } from '../../lib/toast';
import { copyText } from '../../lib/clipboard';
import {
  toUnix,
  fromUnix,
  detectUnit,
  formatLocal,
  humanizeRelative,
  listTimeZones,
  dateToLocalInputString,
  localInputToDate,
  type Unit,
} from '../../core/timestamp';

mountShell(undefined, undefined, 'timestamp');

interface State {
  unit: Unit;
  unitOverridden: boolean;
  tz: string;
  date: Date;
  nowTimer: number | null;
}

function $<T extends Element = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error('missing element: ' + sel);
  return el;
}

export function init(): void {
  const state: State = {
    unit: 's',
    unitOverridden: false,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    date: new Date(),
    nowTimer: null,
  };

  // 时区下拉
  const tzSelect = $('#tz-select') as HTMLSelectElement;
  const zones = listTimeZones();
  // 把当前时区置顶
  const localTz = state.tz;
  const ordered = [localTz, ...zones.filter((z) => z !== localTz)];
  for (const z of ordered) {
    const opt = document.createElement('option');
    opt.value = z;
    opt.textContent = z;
    tzSelect.appendChild(opt);
  }
  tzSelect.value = state.tz;

  const unixInput = $('#unix-input') as HTMLInputElement;
  const dtInput = $('#dt-input') as HTMLInputElement;
  const unixEcho = $('#unix-echo');
  const isoOut = $('#iso-out');
  const localOut = $('#local-out');
  const humanLine = $('#human-line');
  const nowClock = $('#now-clock');
  const nowRel = $('#now-rel');
  const nowToggle = $('#now-toggle');
  const unitSeg = $('#unit-seg');

  function setUnitUI() {
    unitSeg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', (b as HTMLButtonElement).dataset.unit === state.unit);
    });
  }

  function syncFromDate(skip: 'unix' | 'dt' | null = null) {
    const ms = state.date.getTime();
    if (isNaN(ms)) {
      unixEcho.textContent = '—';
      isoOut.textContent = '—';
      localOut.textContent = '—';
      humanLine.textContent = '无效时间';
      return;
    }
    const unixVal = toUnix(state.date, state.unit);
    if (skip !== 'unix') unixInput.value = String(unixVal);
    if (skip !== 'dt') dtInput.value = dateToLocalInputString(state.date, state.tz);
    unixEcho.textContent = String(unixVal);
    const info = fromUnix(unixVal, state.unit, state.tz);
    isoOut.textContent = info.iso;
    localOut.textContent = formatLocal(state.date, state.tz);
    humanLine.textContent = `${formatLocal(state.date, state.tz)}（${humanizeRelative(state.date)}）`;
  }

  // 初始化：用当前时间
  state.date = new Date();
  syncFromDate();

  // Unix 输入
  unixInput.addEventListener('input', () => {
    const v = unixInput.value.trim();
    if (!v) return;
    if (!state.unitOverridden) {
      const detected = detectUnit(v);
      if (detected !== state.unit) {
        state.unit = detected;
        setUnitUI();
      }
    }
    const n = Number(v);
    if (Number.isFinite(n)) {
      const info = fromUnix(n, state.unit, state.tz);
      state.date = info.date;
      syncFromDate('unix');
    }
  });

  // 单位 segmented：切换单位时，按"新单位重新解读当前输入数字"
  unitSeg.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      state.unit = (b as HTMLButtonElement).dataset.unit as Unit;
      state.unitOverridden = true;
      setUnitUI();
      const v = unixInput.value.trim();
      if (v && /^-?\d+$/.test(v)) {
        const n = Number(v);
        if (Number.isFinite(n)) {
          const info = fromUnix(n, state.unit, state.tz);
          state.date = info.date;
        }
      }
      // 不要回写 input（避免数值在 s/ms 之间被乘 1000）
      syncFromDate('unix');
    });
  });

  // 时区
  tzSelect.addEventListener('change', () => {
    state.tz = tzSelect.value;
    syncFromDate();
  });

  // datetime-local
  dtInput.addEventListener('input', () => {
    const d = localInputToDate(dtInput.value, state.tz);
    if (!isNaN(d.getTime())) {
      state.date = d;
      syncFromDate('dt');
    }
  });

  // 实时刷新
  function startNow() {
    if (state.nowTimer !== null) return;
    nowToggle.textContent = '⏸ 暂停刷新';
    nowToggle.classList.remove('btn-primary');
    nowToggle.classList.add('btn');
    const tick = () => {
      const now = new Date();
      state.date = now;
      syncFromDate();
      const fmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone: state.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      nowClock.textContent = fmt.format(now);
      nowRel.textContent = state.tz;
    };
    tick();
    state.nowTimer = window.setInterval(tick, 1000);
  }
  function stopNow() {
    if (state.nowTimer === null) return;
    window.clearInterval(state.nowTimer);
    state.nowTimer = null;
    nowToggle.textContent = '⏵ 实时刷新';
    nowToggle.classList.add('btn-primary');
  }
  nowToggle.addEventListener('click', () => {
    if (state.nowTimer === null) startNow(); else stopNow();
  });
  // 初始显示一次时钟（不开始定时器）
  {
    const fmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: state.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    nowClock.textContent = fmt.format(new Date());
    nowRel.textContent = state.tz;
  }

  // 复制按钮
  document.querySelectorAll<HTMLButtonElement>('button[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.copy;
      let val = '';
      if (key === 'unix') val = unixEcho.textContent ?? '';
      else if (key === 'iso') val = isoOut.textContent ?? '';
      else if (key === 'local') val = localOut.textContent ?? '';
      if (!val || val === '—') { toast('暂无内容', 'err'); return; }
      const ok = await copyText(val);
      if (ok) {
        btn.classList.add('copy-ok');
        toast('已复制', 'ok');
        setTimeout(() => btn.classList.remove('copy-ok'), 600);
      } else {
        toast('复制失败', 'err');
      }
    });
  });

  // 快捷键
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      unixInput.focus();
      unixInput.select();
    } else if (mod && e.key === 'Enter') {
      e.preventDefault();
      copyText(unixEcho.textContent ?? '').then((ok) => {
        toast(ok ? '已复制时间戳' : '复制失败', ok ? 'ok' : 'err');
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
