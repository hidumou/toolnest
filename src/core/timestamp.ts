/**
 * Unix 时间戳互转的纯逻辑。
 * UI 层（src/pages/timestamp/main.ts）只调用这些函数，不直接操作 Date 解析。
 */

export type Unit = 'ms' | 's';

/** Date → Unix 数值 */
export function toUnix(date: Date, unit: Unit): number {
  const ms = date.getTime();
  return unit === 'ms' ? ms : Math.floor(ms / 1000);
}

export interface DateParts {
  y: number;
  M: number;
  d: number;
  h: number;
  m: number;
  s: number;
  weekday: string;
  tz: string;
}

/**
 * Unix → Date + 分解。
 * iso 字段是"目标时区"下的 ISO 8601（含 ±HH:MM 偏移）—— 这样切换时区时 ISO 文本会变化。
 * parts 字段用 Intl 按目标时区拆分（含中文星期）。
 */
export function fromUnix(
  value: number,
  unit: Unit,
  timeZone: string,
): { date: Date; iso: string; parts: DateParts } {
  const ms = unit === 'ms' ? value : value * 1000;
  const date = new Date(ms);
  const iso = isNaN(ms) ? 'Invalid Date' : isoInTimeZone(date, timeZone);

  const parts: DateParts = {
    y: 0, M: 0, d: 0, h: 0, m: 0, s: 0, weekday: '', tz: timeZone,
  };

  if (!isNaN(ms)) {
    try {
      const fmt = new Intl.DateTimeFormat('zh-CN', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
        hour12: false,
      });
      const f = fmt.formatToParts(date);
      const get = (k: string) => f.find((p) => p.type === k)?.value ?? '';
      parts.y = Number(get('year'));
      parts.M = Number(get('month'));
      parts.d = Number(get('day'));
      parts.h = Number(get('hour'));
      parts.m = Number(get('minute'));
      parts.s = Number(get('second'));
      parts.weekday = get('weekday');
    } catch {
      // bad tz — leave zeros
    }
  }

  return { date, iso, parts };
}

/** 长度判别：13 → ms，10 → s；其它根据数值绝对值二选一 */
export function detectUnit(input: string): Unit {
  const s = input.trim();
  if (!/^-?\d+$/.test(s)) {
    // 含小数，按 s 处理
    return 's';
  }
  const digits = s.replace(/^-/, '').length;
  if (digits >= 12) return 'ms';
  if (digits <= 10) return 's';
  // 11~12 位：用数值判断（>= ~3000 年的 s）
  const n = Number(s);
  return Math.abs(n) > 1e11 ? 'ms' : 's';
}

/** 用 Intl 格式化为本地化时间，含星期和时区偏移。 */
export function formatLocal(date: Date, timeZone: string): string {
  if (isNaN(date.getTime())) return '无效时间';
  try {
    const fmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hour12: false,
      timeZoneName: 'short',
    });
    return fmt.format(date).replace(/\//g, '-');
  } catch {
    return date.toISOString();
  }
}

/** 相对时间："5 分钟前" / "3 小时后" */
export function humanizeRelative(date: Date, now: Date = new Date()): string {
  if (isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const sign = diffMs >= 0 ? '后' : '前';
  const sec = Math.round(abs / 1000);
  if (sec < 5) return '刚刚';
  if (sec < 60) return `${sec} 秒${sign}`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} 分钟${sign}`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 小时${sign}`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} 天${sign}`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} 个月${sign}`;
  const yr = Math.round(mo / 12);
  return `${yr} 年${sign}`;
}

/** 列举时区名（带 8 个常用兜底）。 */
export function listTimeZones(): string[] {
  const FALLBACK = [
    'UTC',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Europe/London',
    'Europe/Paris',
    'America/New_York',
    'America/Los_Angeles',
  ];
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof fn === 'function') {
      const list = fn('timeZone');
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    // ignore
  }
  return FALLBACK;
}

/** 把 Date 拆成 datetime-local input 用的字符串（YYYY-MM-DDTHH:mm:ss），按目标时区） */
export function dateToLocalInputString(date: Date, timeZone: string): string {
  if (isNaN(date.getTime())) return '';
  const { parts } = fromUnix(date.getTime(), 'ms', timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.y}-${pad(parts.M)}-${pad(parts.d)}T${pad(parts.h)}:${pad(parts.m)}:${pad(parts.s)}`;
}

/** datetime-local 字符串（无时区）+ 时区 → Date */
export function localInputToDate(input: string, timeZone: string): Date {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return new Date(NaN);
  const [, y, M, d, h, mi, s] = m;
  // 找到这一时间在目标时区对应的 UTC ms：用迭代法（Intl 没有反查 API）
  // 先按 UTC 当作目标时区的“墙上时钟”估算
  const wall = Date.UTC(+y!, +M! - 1, +d!, +h!, +mi!, +(s ?? '0'));
  // 计算该目标时区在 wall 那个 UTC 时刻的 offset，再补偿
  const off = tzOffsetMs(new Date(wall), timeZone);
  // wall 是把当地"墙上"误当作 UTC，所以真实 UTC = wall - off
  const guess = new Date(wall - off);
  // 二次校正（DST 边界）
  const off2 = tzOffsetMs(guess, timeZone);
  return new Date(wall - off2);
}

/** 把 Date 按目标时区格式化为 ISO 8601（含 ±HH:MM 偏移） */
function isoInTimeZone(date: Date, timeZone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const f = fmt.formatToParts(date);
    const get = (k: string) => f.find((p) => p.type === k)?.value ?? '00';
    const y = get('year');
    const M = get('month');
    const d = get('day');
    let h = get('hour'); if (h === '24') h = '00';
    const m = get('minute');
    const s = get('second');
    const offMs = tzOffsetMs(date, timeZone);
    const sign = offMs >= 0 ? '+' : '-';
    const absMin = Math.floor(Math.abs(offMs) / 60000);
    const offH = String(Math.floor(absMin / 60)).padStart(2, '0');
    const offMn = String(absMin % 60).padStart(2, '0');
    return `${y}-${M}-${d}T${h}:${m}:${s}${sign}${offH}:${offMn}`;
  } catch {
    return date.toISOString();
  }
}

function tzOffsetMs(date: Date, timeZone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const f = fmt.formatToParts(date);
    const get = (k: string) => f.find((p) => p.type === k)?.value ?? '0';
    const wall = Date.UTC(
      Number(get('year')), Number(get('month')) - 1, Number(get('day')),
      Number(get('hour')) === 24 ? 0 : Number(get('hour')),
      Number(get('minute')), Number(get('second')),
    );
    return wall - date.getTime();
  } catch {
    return 0;
  }
}
