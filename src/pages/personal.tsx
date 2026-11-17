import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Empty, ErrorText, Field, Modal, PageHeader, Select, TextArea, TextInput } from '@/components/ui';
import { useToast } from '@/context';
import { api, errorMessage } from '@/lib/api';
import { inr, todayKey } from '@/lib/format';
import { EXPENSE_CATEGORIES } from '@/lib/labels';

type Person = 'sajeel' | 'shakeeb' | 'ismail';
type Kind = 'income' | 'expense';

type Entry = {
  _id: string;
  source: 'income' | 'expense';
  person: Person;
  kind: Kind;
  amountPaise: number;
  title: string;
  dateKey: string;
  note: string;
  category: string;
  bankAccountId?: string;
  bankName?: string;
  bankDirection?: 'in' | 'out' | '';
};

export type PersonalTotals = { incomePaise: number; expensePaise: number; netPaise: number; count: number };

const PEOPLE: { id: Person; name: string }[] = [
  { id: 'sajeel', name: 'Sajeel' },
  { id: 'shakeeb', name: 'Shakeeb' },
  { id: 'ismail', name: 'Ismail' },
];

const blank = {
  person: 'sajeel' as Person,
  kind: 'expense' as Kind,
  amount: '',
  title: '',
  otherDetail: '',
  date: todayKey(),
  note: '',
  category: 'Food',
  bankAccountId: '',
  bankDirection: 'out' as 'in' | 'out',
};

function personName(id: string) {
  return PEOPLE.find((person) => person.id === id)?.name || id;
}

function signedAmount(kind: Kind, paise: number) {
  return `${kind === 'income' ? '+' : '-'}${inr(paise)}`;
}

function netAmount(paise: number) {
  if (paise > 0) return `+${inr(paise)}`;
  if (paise < 0) return `-${inr(Math.abs(paise))}`;
  return inr(0);
}

function emptyTotals(): PersonalTotals {
  return { incomePaise: 0, expensePaise: 0, netPaise: 0, count: 0 };
}

export function PersonalSummaryCards({ totals, person, onPerson }: { totals: Record<string, PersonalTotals>; person?: string; onPerson?: (id: Person | '') => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {PEOPLE.map((item) => {
        const row = totals[item.id] || emptyTotals();
        const selected = person === item.id;
        const className = `rounded-3xl border p-4 text-left shadow-card ${selected ? 'border-black bg-black text-white' : 'border-line bg-card'}`;
        const body = (
          <>
            <p className="text-sm font-semibold">{item.name}</p>
            <p className={`mt-1 text-xs ${selected ? 'text-neutral-400' : 'text-secondary'}`}>{row.count || 0} entries</p>
            <p className={`mt-3 text-2xl font-semibold ${selected ? '' : row.netPaise < 0 ? 'text-danger' : 'text-success'}`}>{netAmount(row.netPaise)}</p>
            <p className={`mt-2 text-sm ${selected ? 'text-neutral-300' : 'text-success'}`}>+ {inr(row.incomePaise)} received</p>
            <p className={`text-sm ${selected ? 'text-neutral-300' : 'text-danger'}`}>- {inr(row.expensePaise)} paid from pocket</p>
            <p className={`mt-2 text-xs ${selected ? 'text-neutral-400' : 'text-secondary'}`}>Company owes {inr(row.expensePaise)}</p>
          </>
        );
        if (onPerson) {
          return <button key={item.id} type="button" onClick={() => onPerson(selected ? '' : item.id)} className={className}>{body}</button>;
        }
        return <Link key={item.id} to={`/personal?person=${item.id}`} className={className}>{body}</Link>;
      })}
    </div>
  );
}

export function PersonalPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const personParam = params.get('person') || '';
  const person = (PEOPLE.some((item) => item.id === personParam) ? personParam : '') as Person | '';
  const [rows, setRows] = useState<Entry[]>([]);
  const [totals, setTotals] = useState<Record<string, PersonalTotals>>({});
  const [kind, setKind] = useState<Kind | ''>('');
  const [banks, setBanks] = useState<{ _id: string; accountName: string }[]>([]);
  const [editing, setEditing] = useState<Entry | null | undefined>(undefined);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');

  const setPerson = (next: Person | '') => {
    const copy = new URLSearchParams(params);
    if (next) copy.set('person', next);
    else copy.delete('person');
    setParams(copy);
  };

  const load = () => api.get('/personal', { params: { person: person || undefined, kind: kind || undefined } })
    .then((response) => {
      setRows(response.data.data || []);
      setTotals(response.data.totals || {});
    })
    .catch((err) => setError(errorMessage(err)));

  useEffect(() => { load(); }, [person, kind]);
  useEffect(() => {
    api.get('/banks').then((response) => setBanks(response.data.data || [])).catch(() => undefined);
  }, []);

  function openCreate() {
    setForm({ ...blank, date: todayKey(), person: person || 'sajeel', kind: kind || 'expense', bankAccountId: banks[0]?._id || '' });
    setError('');
    setEditing(null);
  }

  function openEdit(row: Entry) {
    setForm({
      person: row.person,
      kind: row.kind,
      amount: (row.amountPaise / 100).toFixed(2),
      title: row.kind === 'income' ? row.title : '',
      otherDetail: row.category === 'Other Expenses' && row.title !== 'Other Expenses' ? row.title : '',
      date: row.dateKey,
      note: row.note || '',
      category: row.category || 'Food',
      bankAccountId: row.bankAccountId || banks[0]?._id || '',
      bankDirection: 'out',
    });
    setError('');
    setEditing(row);
  }

  async function save() {
    const other = form.otherDetail.trim();
    if (form.kind === 'expense' && form.category === 'Other Expenses' && !other) {
      setError('Type what was paid for');
      return false;
    }
    const title = form.kind === 'expense' ? (form.category === 'Other Expenses' ? other : form.category) : form.title.trim();
    if (!title) {
      setError('Say what this was for');
      return false;
    }
    const payload = {
      person: form.person,
      kind: form.kind,
      amount: form.amount,
      title,
      date: form.date,
      note: form.note,
      category: form.kind === 'expense' ? form.category : '',
      bankAccountId: form.kind === 'income' ? form.bankAccountId : '',
      bankDirection: form.kind === 'income' ? 'out' : undefined,
      source: editing?.source,
    };
    if (editing) await api.patch(`/personal/${editing._id}`, payload);
    else await api.post('/personal', payload);
    return true;
  }

  return (
    <div>
      <PageHeader
        title="Personal account"
        text="Pocket payments are owed back by the company. Money received is cut from the bank you select."
        action={<Button onClick={openCreate}>Add entry</Button>}
      />
      <div className="mb-5">
        <PersonalSummaryCards totals={totals} person={person} onPerson={setPerson} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setKind('')} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${kind === '' ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>All</button>
        <button type="button" onClick={() => setKind('income')} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${kind === 'income' ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>+ Received</button>
        <button type="button" onClick={() => setKind('expense')} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${kind === 'expense' ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>- Paid from pocket</button>
      </div>
      {error && editing === undefined && <ErrorText>{error}</ErrorText>}
      {rows.length === 0 ? <Empty title="No personal entries" text="Add money received, or a payment made from Sajeel, Shakeeb, or Ismail's own pocket." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Card key={row._id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.title}</p>
                  <p className="mt-1 text-xs text-secondary">{personName(row.person)} · {row.dateKey}</p>
                </div>
                <p className={`shrink-0 text-lg font-semibold ${row.kind === 'income' ? 'text-success' : 'text-danger'}`}>{signedAmount(row.kind, row.amountPaise)}</p>
              </div>
              <p className="mt-3 text-sm text-secondary">
                {row.kind === 'expense'
                  ? `Paid from ${personName(row.person)}'s pocket. The company owes ${personName(row.person)} ${inr(row.amountPaise)}.`
                  : `Cut from ${row.bankName || 'the bank'}. That bank goes down by ${inr(row.amountPaise)}.`}
              </p>
              {row.note && <p className="mt-2 text-sm text-secondary">{row.note}</p>}
              <div className="mt-4 flex justify-end gap-1">
                <Button variant="quiet" type="button" onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="quiet" type="button" onClick={async () => {
                  if (!window.confirm(`Delete ${row.title}?`)) return;
                  try {
                    await api.delete(`/personal/${row._id}`, { params: { source: row.source } });
                    toast('Entry deleted');
                    load();
                  } catch (err) { setError(errorMessage(err)); }
                }}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <Modal title={editing ? `Edit ${editing.title}` : 'Add entry'} onClose={() => setEditing(undefined)}>
          <form className="grid gap-3" onSubmit={async (event) => {
            event.preventDefault();
            try {
              if (!(await save())) return;
              toast(editing ? 'Entry updated' : 'Entry added');
              setEditing(undefined);
              load();
            } catch (err) { setError(errorMessage(err)); }
          }}>
            <Field label="Person">
              <Select value={form.person} onChange={(event) => setForm({ ...form, person: event.target.value as Person })}>
                {PEOPLE.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Type">
              <Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Kind })}>
                <option value="expense">Paid from own pocket (− amount, company owes it back)</option>
                <option value="income">Money received (+ amount, cut from the bank)</option>
              </Select>
            </Field>
            {form.kind === 'expense' && (
              <>
                <Field label="What was paid for">
                  <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                    {EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                  </Select>
                </Field>
                {form.category === 'Other Expenses' && (
                  <Field label="Other expense">
                    <TextInput placeholder="Type what was paid for" value={form.otherDetail} onChange={(event) => setForm({ ...form, otherDetail: event.target.value })} required />
                  </Field>
                )}
              </>
            )}
            {form.kind === 'income' && (
              <>
                <Field label="Bank account">
                  <Select value={form.bankAccountId} onChange={(event) => setForm({ ...form, bankAccountId: event.target.value })} required>
                    <option value="">Choose a bank</option>
                    {banks.map((bank) => <option key={bank._id} value={bank._id}>{bank.accountName}</option>)}
                  </Select>
                </Field>
                <p className="text-sm text-secondary">The amount is cut from this bank automatically.</p>
              </>
            )}
            {form.kind === 'income' && <Field label="What was paid for"><TextInput placeholder="What was this for" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Amount (INR)"><TextInput inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></Field>
              <Field label="Date"><TextInput type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></Field>
            </div>
            <Field label="Note"><TextArea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
            {error && <ErrorText>{error}</ErrorText>}
            <Button type="submit">{editing ? 'Save changes' : 'Save entry'}</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
