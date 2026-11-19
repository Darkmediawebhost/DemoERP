import { useEffect, useState } from 'react';
import { DateField } from '@/components/DateField';
import { Button, Empty, ErrorText, Field, Modal, PageHeader, Select, TextArea, TextInput } from '@/components/ui';
import { PRESETS, periodRange, todayKey } from '@/lib/format';

type Pitch = {
  id: string;
  clientName: string;
  phone: string;
  email: string;
  company: string;
  pitch: string;
  status: Status;
  date: string;
  notes: string;
};

const STATUSES = [
  { value: 'Pending', short: 'Pending', banner: 'bg-bg text-ink' },
  { value: 'Meeting Scheduled', short: 'Meeting', banner: 'bg-lime text-black' },
  { value: 'Follow Up', short: 'Follow up', banner: 'bg-ink text-bg' },
  { value: 'Converted', short: 'Converted', banner: 'bg-success text-white' },
  { value: 'Rejected', short: 'Rejected', banner: 'bg-danger text-white' },
] as const;

type Status = (typeof STATUSES)[number]['value'];
const STORAGE_KEY = 'dm-marketing-pitches';

function asStatus(value: string): Status {
  const text = value.trim().toLowerCase();
  if (text === 'meeting' || text === 'meeting scheduled') return 'Meeting Scheduled';
  if (text === 'client got' || text === 'client get' || text === 'won' || text === 'converted') return 'Converted';
  if (text === 'lost' || text === 'rejected') return 'Rejected';
  if (text === 'follow up' || text === 'follow-up' || text === 'followup') return 'Follow Up';
  return 'Pending';
}

function readPitches(): Pitch[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.map((row) => ({ ...row, status: asStatus(String(row?.status || '')) }));
  } catch {
    return [];
  }
}

function writePitches(rows: Pitch[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function showDate(value: string) {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function statusBanner(status: Status) {
  return STATUSES.find((item) => item.value === status)?.banner || 'bg-bg text-ink';
}

const blank = { clientName: '', phone: '', email: '', company: '', pitch: '', status: 'Pending' as Status, date: '', notes: '' };

export function MarketingPage() {
  const [rows, setRows] = useState<Pitch[]>([]);
  const [filter, setFilter] = useState('');
  const [preset, setPreset] = useState('this_month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pitch | null>(null);
  const [form, setForm] = useState(blank);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState('');

  useEffect(() => {
    const loaded = readPitches();
    writePitches(loaded);
    setRows(loaded);
  }, []);

  function save(next: Pitch[]) {
    writePitches(next);
    setRows(next);
  }

  function setStatus(id: string, status: Status) {
    save(rows.map((row) => row.id === id ? { ...row, status } : row));
  }

  function openNew() {
    setEditing(null);
    setError('');
    setMore(false);
    setConfirmId('');
    setForm({ ...blank, date: todayKey(), status: (STATUSES.some((item) => item.value === filter) ? filter : 'Pending') as Status });
    setOpen(true);
  }

  function openEdit(row: Pitch) {
    setEditing(row);
    setError('');
    setConfirmId('');
    setMore(Boolean(row.company || row.email || row.notes));
    setForm({
      clientName: row.clientName,
      phone: row.phone,
      email: row.email,
      company: row.company,
      pitch: row.pitch,
      status: row.status,
      date: row.date,
      notes: row.notes,
    });
    setOpen(true);
  }

  const query = search.trim().toLowerCase();
  const range = from && to ? { from, to } : periodRange(preset);
  const inPeriod = rows.filter((row) => row.date && row.date >= range.from && row.date <= range.to);
  const visible = inPeriod.filter((row) => {
    if (filter && row.status !== filter) return false;
    if (!query) return true;
    return [row.clientName, row.phone, row.company, row.pitch, row.email].join(' ').toLowerCase().includes(query);
  });

  return (
    <div>
      <PageHeader title="Marketing" text="See who you pitched, then change the status from the dropdown." action={<Button onClick={openNew}>New pitch</Button>} />
      {rows.length > 0 && (
        <div className="grid gap-3">
          <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
            {PRESETS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => { setPreset(id); setFrom(''); setTo(''); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${preset === id && !(from && to) ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>{label}</button>
            ))}
            <DateField className="h-9 w-[9.5rem] shrink-0 rounded-full border border-line bg-card px-3 text-xs" placeholder="From" value={from} onChange={(event) => setFrom(event.target.value)} />
            <DateField className="h-9 w-[9.5rem] shrink-0 rounded-full border border-line bg-card px-3 text-xs" placeholder="To" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
            <button type="button" onClick={() => setFilter('')} className={`min-h-11 shrink-0 rounded-full border px-3 text-sm font-semibold ${filter === '' ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>All · {inPeriod.length}</button>
            {STATUSES.map((item) => (
              <button key={item.value} type="button" onClick={() => setFilter(filter === item.value ? '' : item.value)} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-semibold ${filter === item.value ? `${item.banner} border-transparent ring-2 ring-black ring-offset-2 ring-offset-bg` : 'border-line bg-card'}`}>
                {item.short} · {inPeriod.filter((row) => row.status === item.value).length}
              </button>
            ))}
          </div>
          <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, or pitch" />
        </div>
      )}
      {visible.length === 0 ? (
        <div className="mt-4">
          <Empty title={rows.length === 0 ? 'No pitches yet' : 'Nothing in this period'} text={rows.length === 0 ? 'Add the client name, phone, and what you pitched.' : 'Try another period, status, or clear the search.'} />
        </div>
      ) : (
        <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => (
            <article key={row.id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-card">
              <div className={`px-4 py-3 text-sm font-semibold tracking-tight ${statusBanner(row.status)}`}>{row.status}</div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-lg font-semibold">{row.clientName}</p>
                  {row.date && <p className="shrink-0 text-xs font-semibold text-secondary">{showDate(row.date)}</p>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-secondary">{row.pitch}</p>
                {row.company && <p className="mt-1 truncate text-sm font-medium">{row.company}</p>}
                {row.notes && <p className="mt-2 line-clamp-2 text-sm text-secondary">{row.notes}</p>}
                {(row.phone || row.email) && (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {row.phone && <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-3 text-sm font-semibold" href={`tel:${row.phone}`}>Call {row.phone}</a>}
                    {row.email && <a className="inline-flex min-h-11 items-center justify-center truncate rounded-xl border border-line px-3 text-sm font-semibold" href={`mailto:${row.email}`}>Email</a>}
                  </div>
                )}
                <label className="mt-auto block space-y-1.5 pt-4 text-sm">
                  <span className="font-medium text-secondary">Change status</span>
                  <Select value={row.status} onChange={(event) => setStatus(row.id, event.target.value as Status)}>
                    {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.value}</option>)}
                  </Select>
                </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button className="w-full" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
                <Button className="w-full" variant={confirmId === row.id ? 'danger' : 'quiet'} onClick={() => {
                  if (confirmId !== row.id) {
                    setConfirmId(row.id);
                    return;
                  }
                  save(rows.filter((item) => item.id !== row.id));
                  setConfirmId('');
                }}>{confirmId === row.id ? 'Confirm' : 'Delete'}</Button>
              </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {open && (
        <Modal title={editing ? 'Edit pitch' : 'New client pitch'} onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={(event) => {
            event.preventDefault();
            if (!form.clientName.trim() || !form.pitch.trim()) {
              setError('Enter the client name and what you pitched.');
              return;
            }
            const next: Pitch = {
              id: editing?.id || crypto.randomUUID(),
              clientName: form.clientName.trim(),
              phone: form.phone.trim(),
              email: form.email.trim(),
              company: form.company.trim(),
              pitch: form.pitch.trim(),
              status: form.status,
              date: form.date || todayKey(),
              notes: form.notes.trim(),
            };
            save(editing ? rows.map((row) => row.id === editing.id ? next : row) : [next, ...rows]);
            setOpen(false);
          }}>
            <Field label="Client name"><TextInput value={form.clientName} autoFocus onChange={(event) => setForm({ ...form, clientName: event.target.value })} required /></Field>
            <Field label="Phone"><TextInput value={form.phone} inputMode="tel" onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <Field label="What you pitched"><TextInput value={form.pitch} placeholder="Website, ads, branding…" onChange={(event) => setForm({ ...form, pitch: event.target.value })} required /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}>
                {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.value}</option>)}
              </Select>
            </Field>
            {more ? (
              <>
                <Field label="Company"><TextInput value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></Field>
                <Field label="Email"><TextInput value={form.email} inputMode="email" onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
                <Field label="Notes"><TextArea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
              </>
            ) : (
              <button type="button" className="min-h-11 rounded-xl text-left text-sm font-semibold text-secondary hover:text-ink" onClick={() => setMore(true)}>Add company, email, or notes</button>
            )}
            {error && <ErrorText>{error}</ErrorText>}
            <Button type="submit">Save</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
