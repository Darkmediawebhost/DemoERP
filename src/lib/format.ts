export function inr(paise?: number | null) {
  const value = Number(paise || 0);
  const negative = value < 0;
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100).toLocaleString('en-IN');
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}₹${whole}.${fraction}`;
}

export function percentLabel(bps?: number | null) {
  const value = Number(bps || 0);
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}%`;
}

export function growthLabel(bps: number | null | undefined) {
  if (bps === null || bps === undefined) return 'No prior period';
  const negative = bps < 0;
  const absolute = Math.abs(bps);
  return `${negative ? '-' : '+'}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}%`;
}

export function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function monthKey(date = todayKey()) {
  return date.slice(0, 7);
}

export function weekRange(today = todayKey()) {
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const key = (value: Date) => value.toISOString().slice(0, 10);
  return { from: key(monday), to: key(sunday) };
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthBounds(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: ymd(year, month, 1), to: ymd(year, month, last) };
}

export function monthRange(value: string) {
  const [year, month] = value.split('-').map(Number);
  return monthBounds(year, month);
}

export function periodRange(preset: string, today = todayKey()) {
  const [year, month] = today.split('-').map(Number);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'this_week') return weekRange(today);
  if (preset === 'last_month') {
    const previous = new Date(Date.UTC(year, month - 2, 1));
    return monthBounds(previous.getUTCFullYear(), previous.getUTCMonth() + 1);
  }
  if (preset === 'this_quarter') {
    const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return { from: ymd(year, startMonth, 1), to: monthBounds(year, startMonth + 2).to };
  }
  if (preset === 'this_year') return { from: ymd(year, 1, 1), to: ymd(year, 12, 31) };
  return monthBounds(year, month);
}

export const PRESETS = [
  ['today', 'Today'],
  ['this_week', 'This week'],
  ['this_month', 'This month'],
  ['last_month', 'Last month'],
  ['this_quarter', 'This quarter'],
  ['this_year', 'This year'],
] as const;

export function statusTone(status?: string) {
  const value = (status || '').toLowerCase();
  if (['paid', 'active', 'completed'].includes(value)) return 'success';
  if (['overdue', 'void', 'cancelled', 'inactive', 'disabled'].includes(value)) return 'danger';
  return 'neutral';
}

export function titleCase(value?: string) {
  return (value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
