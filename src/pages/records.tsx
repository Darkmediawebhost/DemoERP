import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Badge, Button, Card, Empty, ErrorText, Field, Modal, Money, PageHeader, Select, Spinner, Table, Td, TextInput, Th } from '@/components/ui';
import { useAuth, useToast } from '@/context';
import { api, errorMessage, idempotencyKey } from '@/lib/api';
import { inr, percentLabel, PRESETS, periodRange, monthRange, statusTone, titleCase, todayKey } from '@/lib/format';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/labels';
import { PersonalSummaryCards, type PersonalTotals } from '@/pages/personal';

type Row = Record<string, any>;

export function IncomePage() {
  return <MoneyRegister kind="income" title="Income" text="New income is added to Company Cash and listed here. Client receipts appear here too." endpoint="/income" categories={INCOME_CATEGORIES} />;
}

export function ExpensesPage() {
  return <MoneyRegister kind="expense" title="Expenses" text="Company Cash is company money. If Sajeel, Shakeeb, or Ismail pays from their own pocket, the company owes that person the same amount." endpoint="/expenses" categories={EXPENSE_CATEGORIES} />;
}

function MoneyRegister({ kind, title, text, endpoint, categories }: { kind: 'income' | 'expense'; title: string; text: string; endpoint: string; categories: string[] }) {
  const toast = useToast();
  const { can } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [founders, setFounders] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [founderFilter, setFounderFilter] = useState('');
  const [personalTotals, setPersonalTotals] = useState<Record<string, PersonalTotals>>({});
  const [preset, setPreset] = useState('this_month');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  const key = useRef(idempotencyKey());
  const form = useForm<Record<string, string>>({ defaultValues: { date: todayKey(), paidByType: 'company', paymentMethod: 'cash', category: categories[0] } });

  const range = day ? { from: day, to: day } : month ? monthRange(month) : preset === 'all' ? null : periodRange(preset);
  const periods = kind === 'expense' ? ([['all', 'All'], ...PRESETS] as const) : PRESETS;

  const load = () => {
    const params: Row = { limit: 100 };
    if (range) {
      params.from = range.from;
      params.to = range.to;
    }
    if (kind === 'expense' && category) params.category = category;
    api.get(endpoint, { params }).then(async (response) => {
      let data = response.data.data as Row[];
      const pages = Number(response.data.meta?.pages || 1);
      if (pages > 1) {
        const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => api.get(endpoint, { params: { ...params, page: index + 2 } })));
        data = data.concat(...rest.map((item) => item.data.data));
      }
      setRows(data);
      setTotal(response.data.meta?.amountPaise || 0);
    }).catch((err) => setError(errorMessage(err)));
    if (kind === 'expense') {
      api.get('/founders', { params: { limit: 20 } }).then((response) => setFounders(response.data.data || [])).catch(() => undefined);
      api.get('/personal').then((response) => setPersonalTotals(response.data.totals || {})).catch(() => undefined);
    }
  };

  useEffect(() => { load(); }, [range?.from, range?.to, category]);

  const founderAccounts = [...founders]
    .filter((founder) => founder.accountStatus !== 'inactive')
    .sort((left, right) => {
      const rank = (row: Row) => {
        const key = String(row.seedKey || row.fullName || '').toLowerCase();
        const index = ['sajeel', 'shakeeb', 'ismail'].indexOf(key);
        return index === -1 ? 50 : index;
      };
      return rank(left) - rank(right) || String(left.fullName).localeCompare(String(right.fullName));
    });
  const visibleRows = founderFilter ? rows.filter((row) => String(row.paidByFounderId?._id || row.paidByFounderId) === founderFilter) : rows;
  const visibleTotal = founderFilter ? visibleRows.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0) : total;

  const blank = { date: todayKey(), paidByType: 'company', paymentMethod: 'cash', category: categories[0], paidByFounderId: '', otherDetail: '' };
  const openNew = () => {
    setEditing(null);
    setError('');
    form.reset(founderFilter ? { ...blank, paidByType: 'founder', paidByFounderId: founderFilter } : blank);
    setOpen(true);
  };
  const openEdit = (row: Row) => {
    setEditing(row);
    setError('');
    form.reset({
      title: row.title || '',
      amount: (Number(row.amountPaise || 0) / 100).toFixed(2),
      date: row.dateKey || todayKey(),
      category: categories.includes(row.category) ? row.category : 'Other Expenses',
      otherDetail: row.category === 'Other Expenses' ? (row.description || '') : (categories.includes(row.category) ? '' : (row.category || '')),
      paidByType: row.paidByType || 'company',
      paymentMethod: row.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cash',
      bankAccountId: row.bankAccountId?._id || '',
      paidByFounderId: row.paidByFounderId?._id || '',
      isRecurring: row.isRecurring ? 'yes' : '',
    });
    setOpen(true);
  };

  const submit = form.handleSubmit(async (values) => {
    const payload: Row = {
      title: values.title,
      amount: values.amount,
      date: values.date,
      category: kind === 'income' ? (categories.includes(editing?.category) ? editing.category : (categories[0] || 'Client Payments')) : (values.category || categories[0]),
      paymentMethod: editing?.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cash',
      description: '',
    };
    if (kind === 'expense') {
      const other = (values.otherDetail || '').trim();
      if (values.category === 'Other Expenses' && !other) {
        setError('Type what this expense was');
        return;
      }
      payload.category = values.category === 'Other Expenses' || !categories.includes(values.category) ? 'Other Expenses' : values.category;
      payload.description = values.category === 'Other Expenses' ? other : '';
      payload.paidByType = values.paidByType || 'company';
      payload.isRecurring = values.isRecurring === 'yes';
      if (payload.paidByType === 'founder') {
        payload.paidByFounderId = values.paidByFounderId;
        delete payload.paymentMethod;
        delete payload.bankAccountId;
      } else if (editing?.paymentMethod === 'bank_transfer' && editing.bankAccountId?._id) {
        payload.bankAccountId = editing.bankAccountId._id;
      }
    }
    if (kind === 'income' && editing?.bankAccountId?._id) {
      payload.bankAccountId = editing.bankAccountId._id;
      payload.paymentMethod = editing.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cash';
    }
    try {
      if (editing) {
        await api.patch(`${endpoint}/${editing._id}`, payload);
        toast(kind === 'income' ? 'Income updated' : 'Expense updated');
      } else {
        await api.post(endpoint, { ...payload, idempotencyKey: key.current });
        toast(kind === 'income' ? 'Income recorded' : 'Expense recorded');
        key.current = idempotencyKey();
      }
      setOpen(false);
      setEditing(null);
      form.reset(blank);
      load();
    } catch (err) { setError(errorMessage(err)); }
  });

  return (
    <div>
      <PageHeader title={title} text={text} action={can(`${kind === 'income' ? 'income' : 'expenses'}.manage`) && <Button onClick={openNew}>Add {kind}</Button>} />
      <div className="mb-4 space-y-3">
        {kind === 'expense' && <PersonalSummaryCards totals={personalTotals} />}
        {kind === 'income' && (
          <Card>
            <p className="text-xs uppercase tracking-wider text-secondary">Total income</p>
            <p className="mt-2 text-2xl font-semibold"><Money paise={visibleTotal} /></p>
            <p className="mt-1 text-xs text-secondary">{day ? day : month ? month : (periods.find(([id]) => id === preset)?.[1] || 'This period')}</p>
          </Card>
        )}
        {kind === 'expense' && (
          <Card>
            <p className="text-xs uppercase tracking-wider text-secondary">Total expenses</p>
            <p className="mt-2 text-2xl font-semibold"><Money paise={visibleTotal} /></p>
            <p className="mt-1 text-xs text-secondary">{[day || month || (periods.find(([id]) => id === preset)?.[1] || 'This period'), category].filter(Boolean).join(' · ')}</p>
          </Card>
        )}
        <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
          {periods.map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setPreset(id); setDay(''); setMonth(''); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${!day && !month && preset === id ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>{label}</button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <TextInput className="w-full sm:w-44" type="date" value={day} onChange={(event) => { setDay(event.target.value); setMonth(''); }} placeholder="Day" />
          <input className="h-11 w-full rounded-xl border border-line bg-card px-3 text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime sm:w-44 sm:text-sm" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setDay(''); }} aria-label="Month" />
          {kind === 'expense' && (
            <Select className="w-full sm:max-w-[220px]" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          )}
          {founderFilter && <Button variant="ghost" onClick={() => setFounderFilter('')}>All expenses</Button>}
        </div>
      </div>
      {error && !open && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {visibleRows.length === 0 ? <Empty title={founderFilter ? 'No personal expenses in this period' : category ? `No ${category} expenses` : preset === 'all' && !day && !month ? `No ${kind} yet` : `No ${kind} in this period`} text={founderFilter ? 'Try another day, month, period, or category.' : category ? 'Try another category or period.' : preset === 'all' && !day && !month ? 'Records appear here after they are posted.' : 'Try another day, month, or period.'} /> : (
        <Table>
          <thead><tr><Th>Date</Th><Th>Title</Th>{kind === 'expense' && <Th>Category</Th>}<Th>Account</Th><Th>Amount</Th><Th></Th></tr></thead>
          <tbody>
            {visibleRows.map((row) => {
              const fromPayment = String(row.idempotencyKey || '').startsWith('receipt:');
              const personalName = row.paidByFounderId?.fullName;
              return (
                <tr key={row._id} className="hover:bg-tint">
                  <Td>{row.dateKey}</Td>
                  <Td>{row.title}</Td>
                  {kind === 'expense' && <Td>{row.category === 'Other Expenses' && row.description ? row.description : row.category}</Td>}
                  <Td>{personalName ? `Personal · ${personalName}` : row.bankAccountId?.accountName || 'Company Cash'}</Td>
                  <Td><Money paise={row.amountPaise} /></Td>
                  <Td><div className="flex justify-end gap-1">
                    {fromPayment ? <Link to="/payments" className="text-sm font-semibold">Payment</Link> : (
                      <>
                        {can(`${kind === 'income' ? 'income' : 'expenses'}.manage`) && <Button variant="quiet" onClick={() => openEdit(row)}>Edit</Button>}
                        {kind === 'income' && can('income.manage') && <Button variant="quiet" onClick={async () => {
                          if (!window.confirm(`Delete ${row.title}? This amount is taken back out of the bank.`)) return;
                          try {
                            await api.post(`/income/${row._id}/void`, { reason: 'Deleted income' });
                            toast('Income deleted');
                            load();
                          } catch (err) { setError(errorMessage(err)); }
                        }}>Delete</Button>}
                      </>
                    )}
                  </div></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {open && (
        <Modal title={editing ? `Edit ${kind}` : `Record ${kind}`} onClose={() => { setOpen(false); setEditing(null); }}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Title"><TextInput {...form.register('title', { required: true })} /></Field>
            <Field label="Amount (INR)"><TextInput inputMode="decimal" placeholder="0.00" {...form.register('amount', { required: true })} /></Field>
            {kind === 'income' ? (
              <Field label="Date"><TextInput type="date" {...form.register('date', { required: true })} /></Field>
            ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Date"><TextInput type="date" {...form.register('date', { required: true })} /></Field>
                <Field label="Category"><Select {...form.register('category', { required: true })}>{categories.map((item) => <option key={item}>{item}</option>)}</Select></Field>
              </div>
              {form.watch('category') === 'Other Expenses' && <Field label="Other expense"><TextInput placeholder="Type the expense" {...form.register('otherDetail', { required: true })} /></Field>}
            </>
            )}
            {kind === 'expense' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-secondary">Paid from</p>
                <button type="button" onClick={() => { form.setValue('paidByType', 'company'); form.setValue('paidByFounderId', ''); }} className={`w-full rounded-2xl border px-4 py-3 text-left ${form.watch('paidByType') !== 'founder' ? 'border-black bg-tint' : 'border-line bg-card'}`}>
                  <span className="font-semibold">Company account</span>
                  <span className="mt-1 block text-sm text-secondary">Company Cash</span>
                </button>
                <div className="grid gap-2 sm:grid-cols-3">
                  {founderAccounts.map((founder) => {
                    const selected = form.watch('paidByType') === 'founder' && form.watch('paidByFounderId') === founder._id;
                    return (
                      <button key={founder._id} type="button" onClick={() => { form.setValue('paidByType', 'founder'); form.setValue('paidByFounderId', founder._id); }} className={`rounded-2xl border px-3 py-3 text-left ${selected ? 'border-black bg-tint' : 'border-line bg-card'}`}>
                        <span className="block text-xs font-semibold uppercase tracking-wider text-secondary">Personal</span>
                        <span className="mt-1 block font-semibold">{founder.fullName}</span>
                      </button>
                    );
                  })}
                </div>
                <input type="hidden" {...form.register('paidByFounderId', { validate: (value) => form.getValues('paidByType') !== 'founder' || Boolean(value) || 'Choose Sajeel, Shakeeb, or Ismail' })} />
                {form.watch('paidByType') === 'founder' && <p className="text-sm text-secondary">Paid from their own pocket. Company Cash does not change. The company owes them this amount.</p>}
              </div>
            )}
            {kind === 'expense' && form.watch('paidByType') !== 'founder' && (
              <p className="text-sm text-secondary">Company Cash decreases by this amount.</p>
            )}
            {kind === 'income' && <p className="text-sm text-secondary">This amount is added to Company Cash.</p>}
            {kind === 'expense' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" value="yes" {...form.register('isRecurring')} /> Repeat monthly</label>}
            {error && <ErrorText>{error}</ErrorText>}
            <Button type="submit">{editing ? 'Save' : 'Post to ledger'}</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function lastEditDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function rupeePaise(value: string) {
  const cleaned = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

function BankEditModal({ bank, onClose, onSaved }: { bank: Row; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [error, setError] = useState('');
  const cash = Boolean(bank.isSystem && bank.accountType === 'cash');
  const form = useForm<Record<string, string>>({
    defaultValues: {
      accountName: bank.accountName || '',
      bankName: bank.bankName || '',
      accountHolder: bank.accountHolder || '',
      accountNumber: '',
      amount: (Number(bank.currentBalancePaise || 0) / 100).toFixed(2),
      allowOverdraft: bank.allowOverdraft ? 'yes' : '',
      status: bank.status || 'active',
    },
  });
  return (
    <Modal title={cash ? 'Edit Company Cash' : `Edit ${bank.accountName}`} onClose={onClose}>
      <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
        const nextPaise = rupeePaise(values.amount || '');
        if (nextPaise === null) {
          setError('Enter the amount in rupees.');
          return;
        }
        const payload: Row = {
          accountName: values.accountName,
          accountHolder: values.accountHolder || '',
        };
        if (!cash) {
          payload.bankName = values.bankName || '';
          payload.allowOverdraft = values.allowOverdraft === 'yes';
          if ((values.accountNumber || '').trim()) payload.accountNumber = values.accountNumber.trim();
          payload.status = values.status || 'active';
        }
        try {
          await api.patch(`/banks/${bank._id}`, payload);
          const delta = nextPaise - Number(bank.currentBalancePaise || 0);
          if (delta !== 0) {
            const accounts = (await api.get('/ledger')).data.data as Row[];
            const bankLedgerId = String(bank.ledgerAccountId?._id || bank.ledgerAccountId || '');
            const bankLedger = accounts.find((account) => account._id === bankLedgerId);
            const equity = accounts.find((account) => account.code === '3900');
            if (!bankLedger || !equity) throw new Error('The amount could not be updated.');
            const rupees = (Math.abs(delta) / 100).toFixed(2);
            const lines = delta > 0
              ? [{ accountId: bankLedger._id, debit: rupees }, { accountId: equity._id, credit: rupees }]
              : [{ accountId: equity._id, debit: rupees }, { accountId: bankLedger._id, credit: rupees }];
            await api.post('/ledger/journals', {
              date: todayKey(),
              memo: `Balance adjustment · ${values.accountName || bank.accountName}`,
              idempotencyKey: idempotencyKey(),
              lines,
            });
          }
          toast('Account updated');
          onSaved();
          onClose();
        } catch (err) { setError(err instanceof Error && !('response' in err) ? err.message : errorMessage(err)); }
      })}>
        <Field label="Account name"><TextInput {...form.register('accountName', { required: true })} /></Field>
        <Field label="Amount (INR)"><TextInput inputMode="decimal" {...form.register('amount', { required: true })} /></Field>
        {cash ? (
          <p className="text-sm text-secondary">This is the company cash account. The amount shown is the current balance. Change it to set a new balance.</p>
        ) : (
          <>
            <Field label="Bank"><TextInput {...form.register('bankName')} /></Field>
            <Field label="Account number"><TextInput placeholder={bank.accountNumberMasked ? `Current ${bank.accountNumberMasked}` : 'Account number'} {...form.register('accountNumber')} /></Field>
            <Field label="Status"><Select {...form.register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" value="yes" {...form.register('allowOverdraft')} /> Allow overdraft</label>
          </>
        )}
        <Field label="Holder"><TextInput {...form.register('accountHolder')} /></Field>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit">Save</Button>
      </form>
    </Modal>
  );
}

export function BanksPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [transfer, setTransfer] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const key = useRef(idempotencyKey());
  const form = useForm<Record<string, string>>({ defaultValues: { accountType: 'bank', date: todayKey(), openingBalance: '0' } });
  const load = () => api.get('/banks').then((response) => setRows(response.data.data)).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);
  const accounts = [...rows].sort((left, right) => Number(Boolean(right.isSystem)) - Number(Boolean(left.isSystem)) || String(left.accountName).localeCompare(String(right.accountName)));

  return (
    <div>
      <PageHeader title="Bank accounts" text="Company Cash is the cash account. Edit changes the name, holder, and amount. Transfer moves money between accounts." action={<Button variant="ghost" onClick={() => { form.reset({ transferDate: todayKey() }); setTransfer(true); }}>Transfer</Button>} />
      {error && !transfer && !editing && <ErrorText>{error}</ErrorText>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((bank) => {
          const cash = Boolean(bank.isSystem && bank.accountType === 'cash');
          return (
            <article key={bank._id} className="rounded-3xl border border-line bg-card p-5">
              <Link to={`/banks/${bank._id}`} className="block hover:opacity-80">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{bank.accountName}</p>
                  <Badge tone={cash ? 'lime' : bank.status === 'active' ? 'neutral' : 'danger'}>{cash ? 'Cash' : bank.status}</Badge>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider text-secondary">{cash ? 'Company cash' : `${bank.accountType} · ${bank.accountNumberMasked || 'No number'}`}</p>
                <p className="mt-4 text-2xl font-semibold"><Money paise={bank.currentBalancePaise} /></p>
                {lastEditDate(bank.updatedAt) && <p className="mt-2 text-xs text-secondary">Last edit {lastEditDate(bank.updatedAt)}</p>}
              </Link>
              <div className="mt-4 flex items-center justify-between">
                <Link to={`/banks/${bank._id}`} className="text-sm font-semibold">Statement</Link>
                {can('banks.manage') && <Button variant="quiet" onClick={() => setEditing(bank)}>Edit</Button>}
              </div>
            </article>
          );
        })}
      </div>
      {editing && <BankEditModal bank={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {transfer && <Modal title="Transfer" onClose={() => setTransfer(false)}><form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => { try { await api.post('/banks/transfer', { ...values, date: values.transferDate || todayKey(), idempotencyKey: key.current }); toast('Transfer posted'); setTransfer(false); key.current = idempotencyKey(); load(); } catch (err) { setError(errorMessage(err)); } })}>
        <Field label="From"><Select {...form.register('fromAccountId', { required: true })}>{rows.map((bank) => <option key={bank._id} value={bank._id}>{bank.accountName}</option>)}</Select></Field>
        <Field label="To"><Select {...form.register('toAccountId', { required: true })}>{rows.map((bank) => <option key={bank._id} value={bank._id}>{bank.accountName}</option>)}</Select></Field>
        <Field label="Amount"><TextInput {...form.register('amount', { required: true })} /></Field>
        <Field label="Date"><TextInput type="date" {...form.register('transferDate')} defaultValue={todayKey()} /></Field>
        <Button type="submit">Post transfer</Button>
      </form></Modal>}
    </div>
  );
}

export function BankDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [data, setData] = useState<Row | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const load = () => api.get(`/banks/${id}/statement`).then((response) => setData(response.data.data)).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, [id]);
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <Spinner />;
  const cash = Boolean(data.bank.isSystem && data.bank.accountType === 'cash');
  return (
    <div>
      <PageHeader title={data.bank.accountName} text={[cash ? 'Company cash' : titleCase(data.bank.accountType), data.bank.accountNumberMasked || 'No number', `Book balance ${inr(data.bank.currentBalancePaise)}`, lastEditDate(data.bank.updatedAt) ? `Last edit ${lastEditDate(data.bank.updatedAt)}` : ''].filter(Boolean).join(' · ')} action={can('banks.manage') && <Button onClick={() => setEditing(true)}>Edit</Button>} />
      {editing && <BankEditModal bank={data.bank} onClose={() => setEditing(false)} onSaved={load} />}
      <Table>
        <thead><tr><Th>Date</Th><Th>Memo</Th><Th>Debit</Th><Th>Credit</Th><Th>Balance</Th></tr></thead>
        <tbody>{(data.statement.rows || []).map((row: Row, index: number) => <tr key={index}><Td>{row.date}</Td><Td>{row.memo}</Td><Td>{inr(row.debitPaise)}</Td><Td>{inr(row.creditPaise)}</Td><Td>{inr(row.balancePaise)}</Td></tr>)}</tbody>
      </Table>
    </div>
  );
}

export function LedgerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [integrity, setIntegrity] = useState<Row | null>(null);
  useEffect(() => {
    api.get('/ledger').then((response) => setRows(response.data.data));
    api.get('/ledger/integrity').then((response) => setIntegrity(response.data.data));
  }, []);
  return (
    <div>
      <PageHeader title="Ledger & accounting" text="Every posted entry is balanced. Reversals keep the original entry and write the opposite lines." />
      {integrity && <Card className="mb-4"><p className="font-semibold">{integrity.ok ? 'Books are balanced.' : 'The books need attention.'}</p>{(integrity.issues || []).map((issue: string) => <p key={issue} className="text-sm text-danger">{issue}</p>)}</Card>}
      <Table>
        <thead><tr><Th>Code</Th><Th>Account</Th><Th>Type</Th><Th></Th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row._id} className="hover:bg-tint"><Td>{row.code}</Td><Td>{row.name}</Td><Td>{row.type}</Td><Td><Link className="font-semibold" to={`/ledger/${row._id}`}>Statement</Link></Td></tr>)}</tbody>
      </Table>
    </div>
  );
}

export function LedgerDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Row | null>(null);
  useEffect(() => { api.get(`/ledger/${id}`).then((response) => setData(response.data.data)); }, [id]);
  if (!data) return <Spinner />;
  return (
    <div>
      <PageHeader title={`${data.account.code} · ${data.account.name}`} text={`Opening ${inr(data.openingPaise)} · Closing ${inr(data.closingPaise)}`} />
      <Table>
        <thead><tr><Th>Date</Th><Th>Reference</Th><Th>Memo</Th><Th>Debit</Th><Th>Credit</Th><Th>Balance</Th></tr></thead>
        <tbody>{data.rows.map((row: Row, index: number) => <tr key={index}><Td>{row.date}</Td><Td>{row.reference}</Td><Td>{row.memo}</Td><Td>{inr(row.debitPaise)}</Td><Td>{inr(row.creditPaise)}</Td><Td>{inr(row.balancePaise)}</Td></tr>)}</tbody>
      </Table>
    </div>
  );
}

export function FoundersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const load = () => api.get('/founders').then((response) => { setRows(response.data.data); setActive(Boolean(response.data.meta?.profitSharingActive)); }).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <PageHeader title="Co-founders" text="Sajeel, Shakeeb, and Ismail are owners, not employees. Ownership and profit share stay at 0% until you set them. Profit sharing turns on only when each totals 100%." action={<Button variant={active ? 'ghost' : 'primary'} onClick={async () => { try { await api.post('/founders/profit-sharing', { active: !active }); toast(active ? 'Profit sharing paused' : 'Profit sharing activated'); load(); } catch (err) { setError(errorMessage(err)); } }}>{active ? 'Pause profit sharing' : 'Activate profit sharing'}</Button>} />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      <div className="grid gap-3 lg:grid-cols-3">
        {rows.map((founder) => (
          <Link key={founder._id} to={`/founders/${founder._id}`} className="rounded-3xl border border-line bg-card p-5 hover:bg-tint">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{founder.fullName}</h2><Badge tone={founder.accountStatus === 'active' ? 'neutral' : 'danger'}>{founder.accountStatus}</Badge></div>
            <p className="text-sm text-secondary">{founder.designation}</p>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-secondary">Ownership</dt><dd>{founder.ownership}%</dd></div>
              <div className="flex justify-between"><dt className="text-secondary">Profit share</dt><dd>{founder.profitShare}%</dd></div>
              <div className="flex justify-between"><dt className="text-secondary">Capital</dt><dd><Money paise={founder.finance?.ledgerBalancePaise} /></dd></div>
            </dl>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function FounderDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [payload, setPayload] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const form = useForm<Record<string, string>>();
  const load = () => api.get(`/founders/${id}`).then((response) => {
    setPayload(response.data);
    form.reset({ ownership: response.data.data.ownership, profitShare: response.data.data.profitShare, phone: response.data.data.phone || '', designation: response.data.data.designation || '' });
  }).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, [id]);
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!payload) return <Spinner />;
  const founder = payload.data;
  const finance = founder.finance || {};
  return (
    <div className="space-y-4">
      <PageHeader title={founder.fullName} text={`${founder.email} · capital ${inr(finance.ledgerBalancePaise)}${finance.reconciled ? '' : ' · capital history does not match the ledger'}`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Invested', finance.investedPaise],
          ['Withdrawals', finance.withdrawalsPaise],
          ['Personal expenses', finance.personalExpensesPaise],
          ['Reimbursement due', finance.reimbursementDuePaise],
          ['Profit allocated', finance.profitPaise],
          ['Loss allocated', finance.lossPaise],
        ].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-xs uppercase tracking-wider text-secondary">{label}</p><p className="mt-2 text-xl font-semibold"><Money paise={Number(value || 0)} /></p></Card>)}
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Ownership</h2>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={form.handleSubmit(async (values) => { try { await api.patch(`/founders/${id}`, values); toast('Co-founder updated'); load(); } catch (err) { setError(errorMessage(err)); } })}>
          <Field label="Ownership %"><TextInput {...form.register('ownership')} /></Field>
          <Field label="Profit share %"><TextInput {...form.register('profitShare')} /></Field>
          <Field label="Phone"><TextInput {...form.register('phone')} /></Field>
          <Button type="submit">Save</Button>
        </form>
      </Card>
    </div>
  );
}

export function FounderFinancePage() {
  const toast = useToast();
  const [founders, setFounders] = useState<Row[]>([]);
  const [banks, setBanks] = useState<Row[]>([]);
  const [preview, setPreview] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const key = useRef(idempotencyKey());
  const form = useForm<Record<string, string>>({ defaultValues: { date: todayKey(), kind: 'additional', paymentMethod: 'bank_transfer' } });
  useEffect(() => {
    api.get('/founder-finance').then((response) => setFounders(response.data.data));
    api.get('/banks').then((response) => setBanks(response.data.data));
  }, []);
  return (
    <div className="space-y-4">
      <PageHeader title="Founder finance" text="Contributions, withdrawals, reimbursements, and profit distributions are posted to each co-founder's capital account. Nothing is distributed until you approve the preview." />
      {error && <ErrorText>{error}</ErrorText>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Capital movement</h2>
          <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
            try {
              const path = values.movement === 'contribution' ? '/founder-finance/contributions' : '/founder-finance/withdrawals';
              await api.post(path, { ...values, kind: values.kind, idempotencyKey: key.current });
              toast('Posted');
              key.current = idempotencyKey();
            } catch (err) { setError(errorMessage(err)); }
          })}>
            <Field label="Type"><Select {...form.register('movement')}><option value="contribution">Contribution</option><option value="withdrawal">Withdrawal or reimbursement</option></Select></Field>
            <Field label="Kind"><Select {...form.register('kind')}><option value="additional">Additional</option><option value="initial">Initial</option><option value="withdrawal">Withdrawal</option><option value="reimbursement">Reimbursement</option></Select></Field>
            <Field label="Co-founder"><Select {...form.register('coFounderId', { required: true })}>{founders.map((founder) => <option key={founder._id} value={founder._id}>{founder.fullName}</option>)}</Select></Field>
            <Field label="Account"><Select {...form.register('bankAccountId', { required: true })}>{banks.map((bank) => <option key={bank._id} value={bank._id}>{bank.accountName}</option>)}</Select></Field>
            <Field label="Amount"><TextInput {...form.register('amount', { required: true })} /></Field>
            <Field label="Date"><TextInput type="date" {...form.register('date')} /></Field>
            <Button type="submit">Post</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Profit distribution</h2>
          <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
            try {
              const response = await api.post('/founder-finance/distributions/preview', { periodStart: values.periodStart, periodEnd: values.periodEnd, amount: values.distributionAmount || undefined });
              setPreview(response.data.data);
            } catch (err) { setError(errorMessage(err)); }
          })}>
            <Field label="Period start"><TextInput type="date" {...form.register('periodStart')} /></Field>
            <Field label="Period end"><TextInput type="date" {...form.register('periodEnd')} /></Field>
            <Field label="Amount, optional"><TextInput placeholder="Leave blank for the full balance" {...form.register('distributionAmount')} /></Field>
            <Button type="submit" variant="ghost">Preview</Button>
          </form>
          {preview && (
            <div className="mt-4 space-y-2 text-sm">
              <p>Period net {inr(preview.periodNetPaise)} · available {inr(preview.availablePaise)}</p>
              {preview.lines.map((line: Row) => <p key={line.name} className="flex justify-between"><span>{line.name} · {percentLabel(line.bps)}</span><span>{inr(line.signedPaise)}</span></p>)}
              <Button onClick={async () => {
                try {
                  const values = form.getValues();
                  await api.post('/founder-finance/distributions', { periodStart: values.periodStart, periodEnd: values.periodEnd, date: values.date || todayKey(), amount: values.distributionAmount || undefined, payout: values.payout === 'yes', bankAccountId: values.payoutBank, confirm: true, idempotencyKey: key.current });
                  toast('Distribution recorded');
                  setPreview(null);
                  key.current = idempotencyKey();
                } catch (err) { setError(errorMessage(err)); }
              }}>Approve distribution</Button>
              <label className="flex items-center gap-2"><input type="checkbox" value="yes" {...form.register('payout')} /> Also pay it out from a bank account</label>
              <Select {...form.register('payoutBank')}>{banks.map((bank) => <option key={bank._id} value={bank._id}>{bank.accountName}</option>)}</Select>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
