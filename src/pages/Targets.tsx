import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, ErrorText, Field, Money, PageHeader, TextInput } from '@/components/ui';
import { useToast } from '@/context';
import { api, errorMessage } from '@/lib/api';
import { inr, todayKey, weekRange } from '@/lib/format';

type Period = {
  id: 'day' | 'week' | 'month';
  label: string;
  from: string;
  to: string;
  targetPaise: number;
  amountPaise: number;
  count: number;
};

type DayPoint = { dateKey: string; amountPaise: number; future: boolean };

type TrackEntry = { _id: string; dateKey: string; amountPaise: number; note?: string; createdAt?: string };

type TargetData = {
  today: string;
  targets: { dayPaise: number; weekPaise: number; monthPaise: number };
  periods: Period[];
  days: DayPoint[];
  entries: TrackEntry[];
};

function rupeeInput(paise: number) {
  if (!paise) return '';
  return (paise / 100).toFixed(2);
}

function percent(actual: number, target: number) {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 100);
}

function gapText(actual: number, target: number) {
  if (target <= 0) return 'Set a target for this period.';
  const gap = target - actual;
  if (gap > 0) return `${inr(gap)} left.`;
  if (gap === 0) return 'Target reached.';
  return `${inr(Math.abs(gap))} over the target.`;
}

function monthBounds(today: string) {
  const [year, month] = today.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

function displayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function Ring({ value }: { value: number }) {
  const shown = Math.max(0, Math.min(value, 100));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const reached = value >= 100;
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" aria-hidden="true">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#EFEFEF" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={reached ? '#16A34A' : '#111111'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - (shown / 100) * circumference}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="54" textAnchor="middle" fontSize={value > 999 ? 11 : 14} fontWeight="700" fill="#111111">{value > 999 ? '999+' : `${value}%`}</text>
    </svg>
  );
}

export function TargetsPage() {
  const toast = useToast();
  const [data, setData] = useState<TargetData | null>(null);
  const [error, setError] = useState('');
  const [day, setDay] = useState('');
  const [week, setWeek] = useState('');
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayKey());
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState(false);
  const [listMode, setListMode] = useState<'month' | 'week' | 'date'>('month');
  const [filterDate, setFilterDate] = useState(todayKey());

  function apply(next: TargetData) {
    setData(next);
    setDay(rupeeInput(next.targets.dayPaise));
    setWeek(rupeeInput(next.targets.weekPaise));
    setMonth(rupeeInput(next.targets.monthPaise));
    setError('');
  }

  useEffect(() => {
    api.get('/targets').then((response) => apply(response.data.data)).catch((err) => setError(errorMessage(err)));
  }, []);

  async function saveTargets(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await api.put('/targets', { day: day || '0', week: week || '0', month: month || '0' });
      apply(response.data.data);
      toast('Targets saved');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function logProgress(event: FormEvent) {
    event.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Enter the amount you want to add.');
      return;
    }
    setLogging(true);
    setError('');
    try {
      const response = await api.post('/targets/entries', { amount, date: date || todayKey(), note });
      apply(response.data.data);
      setAmount('');
      setNote('');
      toast('Progress added');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLogging(false);
    }
  }

  async function removeEntry(id: string) {
    setError('');
    try {
      const response = await api.delete(`/targets/entries/${id}`);
      apply(response.data.data);
      toast('Entry removed');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const periods = data?.periods || [];
  const monthPeriod = periods.find((period) => period.id === 'month');
  const todayNumber = Number((data?.today || '').slice(8, 10) || 0);
  const monthDays = data?.days.length || 0;
  const pace = monthPeriod && monthPeriod.targetPaise > 0 && monthDays
    ? monthPeriod.amountPaise - Math.round((monthPeriod.targetPaise * todayNumber) / monthDays)
    : null;
  const peak = Math.max(data?.targets.dayPaise || 0, ...(data?.days || []).map((point) => point.amountPaise), 1);

  return (
    <div>
      <PageHeader title="Targets" text="One board for day, week, and month. The numbers here are only what you set and log on this page." />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      <div className="grid gap-3 lg:grid-cols-3">
        {periods.map((period) => {
          const score = percent(period.amountPaise, period.targetPaise);
          return (
            <Card key={period.id} className="flex items-center gap-4">
              <Ring value={score} />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{period.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight"><Money paise={period.amountPaise} /></p>
                <p className="mt-1 text-sm text-secondary">of {period.targetPaise ? inr(period.targetPaise) : 'no target yet'}</p>
                <p className="mt-2 text-sm">{gapText(period.amountPaise, period.targetPaise)}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Set targets</h2>
          <p className="mt-1 text-sm text-secondary">Type the goal in rupees. These stay on this page.</p>
          <form className="mt-4 grid gap-3" onSubmit={saveTargets}>
            <Field label="Daily target"><TextInput inputMode="decimal" placeholder="10000" value={day} disabled={saving} onChange={(event) => setDay(event.target.value)} /></Field>
            <Field label="Weekly target"><TextInput inputMode="decimal" placeholder="50000" value={week} disabled={saving} onChange={(event) => setWeek(event.target.value)} /></Field>
            <Field label="Monthly target"><TextInput inputMode="decimal" placeholder="200000" value={month} disabled={saving} onChange={(event) => setMonth(event.target.value)} /></Field>
            <Button type="submit" disabled={saving}>{saving ? 'Saving' : 'Save targets'}</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Log progress</h2>
          <p className="mt-1 text-sm text-secondary">Add what you achieved. It counts toward the day, the week, and the month of that date.</p>
          <form className="mt-4 grid gap-3" onSubmit={logProgress}>
            <Field label="Amount (INR)"><TextInput inputMode="decimal" placeholder="2500" value={amount} disabled={logging} onChange={(event) => setAmount(event.target.value)} /></Field>
            <Field label="Date"><TextInput type="date" value={date} disabled={logging} onChange={(event) => setDate(event.target.value)} /></Field>
            <Field label="Note"><TextInput placeholder="What this was" value={note} disabled={logging} onChange={(event) => setNote(event.target.value)} /></Field>
            <Button type="submit" disabled={logging}>{logging ? 'Adding' : 'Add to track'}</Button>
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">This month</h2>
            <p className="text-sm text-secondary">Bars are the amounts logged on this page. The dashed line is the daily target.</p>
          </div>
          {pace !== null && (
            <p className={`text-sm font-semibold ${pace >= 0 ? 'text-success' : 'text-danger'}`}>
              {pace >= 0 ? `${inr(pace)} ahead of an even month` : `${inr(Math.abs(pace))} behind an even month`}
            </p>
          )}
        </div>
        <div className="flex h-44 items-end gap-1 overflow-x-auto pb-1">
          {(data?.days || []).map((point) => {
            const height = Math.max(4, Math.round((point.amountPaise / peak) * 100));
            const marker = data?.targets.dayPaise ? Math.max(4, Math.round((data.targets.dayPaise / peak) * 100)) : 0;
            const hit = Boolean(data?.targets.dayPaise) && point.amountPaise >= (data?.targets.dayPaise || 0);
            return (
              <div key={point.dateKey} className="flex w-6 shrink-0 flex-col items-center justify-end" title={`${displayDate(point.dateKey)} · ${inr(point.amountPaise)}`}>
                <div className="relative flex h-36 w-3 items-end">
                  {marker > 0 && <span className="absolute left-0 right-0 border-t border-dashed border-neutral-400" style={{ bottom: `${marker}%` }} />}
                  <span className={`block w-full rounded-full ${point.dateKey === data?.today ? 'bg-black' : hit ? 'bg-lime' : 'bg-neutral-200'} ${point.future ? 'opacity-40' : ''}`} style={{ height: `${point.amountPaise ? height : 4}%` }} />
                </div>
                <span className={`mt-1 text-[10px] ${point.dateKey === data?.today ? 'font-bold' : 'text-secondary'}`}>{Number(point.dateKey.slice(8))}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <LogList entries={data?.entries || []} today={data?.today || todayKey()} mode={listMode} filterDate={filterDate} onMode={setListMode} onFilterDate={setFilterDate} onRemove={removeEntry} />
    </div>
  );
}

function LogList({ entries, today, mode, filterDate, onMode, onFilterDate, onRemove }: {
  entries: TrackEntry[];
  today: string;
  mode: 'month' | 'week' | 'date';
  filterDate: string;
  onMode: (mode: 'month' | 'week' | 'date') => void;
  onFilterDate: (value: string) => void;
  onRemove: (id: string) => void;
}) {
  const anchor = filterDate || today;
  const week = weekRange(mode === 'week' ? anchor : today);
  const month = monthBounds(today);
  const visible = entries
    .filter((entry) => {
      if (mode === 'date') return entry.dateKey === anchor;
      if (mode === 'week') return entry.dateKey >= week.from && entry.dateKey <= week.to;
      return entry.dateKey >= month.from && entry.dateKey <= month.to;
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || b.dateKey.localeCompare(a.dateKey));
  const total = visible.reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);
  const groups = new Map<string, TrackEntry[]>();
  for (const entry of visible) {
    const bucket = groups.get(entry.dateKey) || [];
    bucket.push(entry);
    groups.set(entry.dateKey, bucket);
  }
  const dates = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  const title = mode === 'date' ? displayDate(anchor) : mode === 'week' ? `${displayDate(week.from)} – ${displayDate(week.to)}` : 'This month';

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Logged</h2>
          <p className="text-sm text-secondary">Newest first. {title} · <Money paise={total} /></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([['month', 'This month'], ['week', 'Week'], ['date', 'Date']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => onMode(id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${mode === id ? 'border-black bg-black text-white' : 'border-line bg-white'}`}>{label}</button>
          ))}
        </div>
      </div>
      {mode !== 'month' && (
        <div className="mt-3 max-w-xs">
          <Field label={mode === 'week' ? 'Any day in the week' : 'Date'}>
            <TextInput type="date" value={anchor} onChange={(event) => onFilterDate(event.target.value)} />
          </Field>
        </div>
      )}
      <div className="mt-4 space-y-4">
        {dates.length === 0 && <p className="text-sm text-secondary">Nothing logged for this {mode === 'date' ? 'date' : mode === 'week' ? 'week' : 'month'}.</p>}
        {dates.map((dateKey) => {
          const rows = groups.get(dateKey) || [];
          const dayTotal = rows.reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);
          return (
            <div key={dateKey}>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-secondary">
                <span>{displayDate(dateKey)}{dateKey === today ? ' · Today' : ''}</span>
                <span><Money paise={dayTotal} /></span>
              </div>
              <div className="space-y-2">
                {rows.map((entry) => (
                  <div key={entry._id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F7F7] px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold"><Money paise={entry.amountPaise} /></p>
                      <p className="truncate text-xs text-secondary">{entry.note || 'Logged'}</p>
                    </div>
                    <Button type="button" variant="quiet" onClick={() => onRemove(entry._id)}>Remove</Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
