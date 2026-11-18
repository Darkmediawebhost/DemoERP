import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Donut, FlowBars, GroupedBars, HorizontalBars, ProfitArea, RevenueChart } from '@/components/Charts';
import { DateField } from '@/components/DateField';
import { AnimatedRupees, Card, Empty, ErrorText, Money, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { PRESETS, growthLabel, inr, titleCase } from '@/lib/format';

type BankAccountRow = {
  _id: string;
  accountName?: string;
  accountType?: string;
  status?: string;
  isSystem?: boolean;
  currentBalancePaise?: number;
  accountNumberMasked?: string;
};

function listedBanks(rows: BankAccountRow[]) {
  return rows;
}

type DashboardData = {
  mode: string;
  range: { from: string; to: string; label: string };
  growthBps?: number | null;
  stats?: Record<string, number>;
  revenueAnalytics?: Array<Record<string, number | string>>;
  expenseByCategory?: Array<{ name: string; amountPaise: number }>;
  cashFlow?: Array<Record<string, number | string>>;
  founderAnalytics?: Array<Record<string, string | number>>;
  clientAnalytics?: { active: number; completedProjects: number; pendingPaymentsPaise: number };
  recentTransactions?: Array<Record<string, unknown>>;
  upcomingPayments?: Array<Record<string, any>>;
  recentClients?: Array<Record<string, any>>;
  upcomingEvents?: Array<Record<string, any>>;
  pendingTasks?: Array<Record<string, any>>;
  notes?: Array<Record<string, any>>;
  deadlines?: Array<Record<string, any>>;
  tasks?: Array<Record<string, any>>;
  events?: Array<Record<string, any>>;
};

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const preset = params.get('preset') || 'this_month';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const [data, setData] = useState<DashboardData | null>(null);
  const [banks, setBanks] = useState<BankAccountRow[] | null>(null);
  const [targetPeriods, setTargetPeriods] = useState<Array<{ id: string; label: string; targetPaise: number; amountPaise: number }>>([]);
  const [error, setError] = useState('');
  const query = rangeQuery(preset, from, to);

  useEffect(() => {
    const request = from && to ? { from, to } : { preset };
    api.get('/dashboard', { params: request }).then((response) => { setData(response.data.data); setError(''); }).catch((err) => setError(errorMessage(err)));
    api.get('/banks').then((response) => setBanks(listedBanks((response.data.data || []) as BankAccountRow[]))).catch(() => setBanks(null));
    api.get('/targets').then((response) => setTargetPeriods(response.data.data?.periods || [])).catch(() => setTargetPeriods([]));
  }, [preset, from, to]);

  function pickPreset(id: string) {
    setParams(id === 'this_month' ? {} : { preset: id });
  }

  function pickDate(key: 'from' | 'to', value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (next.get('from') && next.get('to')) next.delete('preset');
    setParams(next);
  }

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <Spinner />;

  if (data.mode === 'operations') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <div className="grid gap-4 lg:grid-cols-3">
          <ListCard title="My tasks" rows={(data.tasks || []).map((task) => task.title)} empty="No open tasks." />
          <ListCard title="Upcoming" rows={(data.events || []).map((event) => `${event.dateKey} · ${event.title}`)} empty="Nothing scheduled." />
          <ListCard title="Notes" rows={(data.notes || []).map((note) => note.title || note.body)} empty="No pinned notes." />
        </div>
      </div>
    );
  }

  const stats = data.stats || {};
  const bankTotalPaise = (banks || []).reduce((sum, bank) => sum + Number(bank.currentBalancePaise || 0), 0);
  const cards = [
    { id: 'income', label: 'Total Income Generated', value: stats.incomePaise, hint: data.range.label, money: true },
    { id: 'expenses', label: 'Total expenses', value: stats.expensePaise, hint: data.range.label, money: true },
    { id: 'profit', label: 'Net profit', value: stats.netProfitPaise, hint: growthLabel(data.growthBps), money: true },
    { id: 'banks', label: 'Bank balance', value: banks ? bankTotalPaise : stats.bankBalancePaise, hint: banks ? `${banks.length} ${banks.length === 1 ? 'bank' : 'banks'}` : 'Banks', money: true },
    // { id: 'cash', label: 'Cash balance', value: stats.cashBalancePaise, hint: 'Current', money: true },
    { id: 'payments', label: 'Receivable Payments', value: stats.pendingPaymentsPaise, hint: `${stats.pendingPaymentCount || 0} open`, money: true },
    { id: 'clients', label: 'Clients', value: stats.clientCount, hint: 'Active', money: false },
    { id: 'projects', label: 'Projects', value: stats.activeProjects, hint: 'In motion', money: false },
    // { id: 'capital', label: 'Co-founder capital', value: stats.founderCapitalPaise, hint: 'Ledger balance', money: true },
    // { id: 'revenue', label: 'Revenue', value: stats.monthlyRevenuePaise, hint: data.range.label, money: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-secondary">{data.range.label} · {data.range.from} to {data.range.to}. Income and profit follow this period. Balances are current.</p>
        </div>
        <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap">
          {PRESETS.map(([id, label]) => (
            <button key={id} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${preset === id && !from ? 'border-black bg-tint text-ink' : 'border-line text-secondary'}`} type="button" onClick={() => pickPreset(id)}>{label}</button>
          ))}
          <DateField className="h-9 w-[9.5rem] shrink-0 rounded-full border border-line bg-card px-3 text-xs" placeholder="From" value={from} onChange={(event) => pickDate('from', event.target.value)} />
          <DateField className="h-9 w-[9.5rem] shrink-0 rounded-full border border-line bg-card px-3 text-xs" placeholder="To" value={to} onChange={(event) => pickDate('to', event.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Link key={card.id} to={`/dashboard/${card.id}?${query}`} className="group rounded-3xl border border-line bg-card p-4 shadow-card transition hover:border-black hover:bg-tint dark:hover:border-white">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{card.label}</p>
              <ArrowUpRight className="text-muted transition group-hover:text-ink" size={14} />
            </div>
            <p className="mt-2 text-lg font-semibold tracking-tight sm:text-2xl">{card.money ? <AnimatedRupees paise={Number(card.value || 0)} /> : card.value || 0}</p>
            <p className="mt-1 text-xs text-muted">{card.hint}</p>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {targetPeriods.map((period) => {
          const left = Math.max(0, Number(period.targetPaise || 0) - Number(period.amountPaise || 0));
          const hint = period.targetPaise ? (left > 0 ? `${inr(left)} left` : 'Target reached') : 'No target set';
          return (
            <Link key={period.id} to="/targets" className="group rounded-3xl border border-line bg-card p-4 shadow-card transition hover:border-black hover:bg-tint dark:hover:border-white">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{period.label} target</p>
                <ArrowUpRight className="text-muted transition group-hover:text-ink" size={14} />
              </div>
              <p className="mt-2 text-lg font-semibold tracking-tight sm:text-2xl"><AnimatedRupees paise={Number(period.amountPaise || 0)} /></p>
              <p className="mt-1 text-xs text-muted">{hint}{period.targetPaise ? ` of ${inr(period.targetPaise)}` : ''}</p>
            </Link>
          );
        })}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><ChartTitle title="Revenue analytics" to={`/dashboard/income?${query}`} /><RevenueChart data={data.revenueAnalytics || []} /></Card>
        <Card><ChartTitle title="Income vs expenses" to={`/dashboard/profit?${query}`} /><GroupedBars data={data.revenueAnalytics || []} /></Card>
        <Card><ChartTitle title="Net profit" to={`/dashboard/profit?${query}`} /><ProfitArea data={data.revenueAnalytics || []} /></Card>
        <Card><ChartTitle title="Cash flow" to={`/dashboard/banks?${query}`} /><FlowBars data={data.cashFlow || []} /></Card>
        <Card><ChartTitle title="Expense categories" to={`/dashboard/expenses?${query}`} /><Donut data={data.expenseByCategory || []} /></Card>
        <Card>
          <ChartTitle title="Co-founder capital" to={`/dashboard/capital?${query}`} />
          <HorizontalBars data={(data.founderAnalytics || []).map((founder) => ({ name: String(founder.name), amountPaise: Number(founder.capitalPaise) }))} />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ListCard title="Recent transactions" rows={(data.recentTransactions || []).map((row) => `${row.dateKey} · ${row.description || row.reference} · ${inr(Number(row.amountPaise))}`)} empty="No posted transactions yet." />
        <ListCard title="Client payments" rows={(data.upcomingPayments || []).map((row) => `${row.clientId?.name || 'Client'} · ${row.paymentType || 'Payment'} · received ${inr(row.amountReceivedPaise)} of ${inr(row.invoiceAmountPaise)} · pending ${inr(row.invoiceAmountPaise - row.amountReceivedPaise)}`)} empty="No open client payments." href={`/dashboard/payments?${query}`} />
        <ListCard title="Recent clients" rows={(data.recentClients || []).map((row) => row.name)} empty="No clients yet." href={`/dashboard/clients?${query}`} />
        <ListCard title="Upcoming events" rows={(data.upcomingEvents || []).map((row) => `${row.dateKey} · ${row.title}`)} empty="No events." href="/calendar" />
        <ListCard title="Pending tasks" rows={(data.pendingTasks || []).map((row) => row.title)} empty="No open tasks." href="/projects" />
        <ListCard title="Pinned notes" rows={(data.notes || []).map((row) => row.title || row.body)} empty="Pin a note to see it here." href="/notes" />
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Client analytics</h2>
        <div className="flex flex-wrap gap-6 text-sm">
          <Metric label="Active clients" value={String(data.clientAnalytics?.active || 0)} to={`/dashboard/clients?${query}`} />
          <Metric label="Completed projects" value={String(data.clientAnalytics?.completedProjects || 0)} to="/projects" />
          <Metric label="Pending payments" value={inr(data.clientAnalytics?.pendingPaymentsPaise)} to={`/dashboard/payments?${query}`} />
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, to }: { label: string; value: string; to?: string }) {
  const body = <div><p className="text-xs uppercase tracking-wider text-secondary">{label}</p><p className="mt-1 text-xl font-semibold tabular">{value}</p></div>;
  if (!to) return body;
  return <Link className="rounded-2xl transition hover:text-ink" to={to}>{body}</Link>;
}

function ChartTitle({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-semibold">{title}</h2>
      <Link className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:text-ink" to={to}>Open <ArrowUpRight size={12} /></Link>
    </div>
  );
}

function rangeQuery(preset: string, from: string, to: string) {
  if (from && to) return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return `preset=${encodeURIComponent(preset || 'this_month')}`;
}

type BreakdownRow = {
  id: string;
  date?: string;
  title: string;
  detail?: string;
  group?: string;
  amountPaise?: number;
  href?: string;
};

type BreakdownSection = { id: string; title: string; kind: 'accounts' | 'list'; rows: BreakdownRow[] };

type Breakdown = {
  metric: string;
  title: string;
  text: string;
  mode: 'money' | 'count';
  totalPaise: number;
  total: number;
  period?: boolean;
  range: { from: string; to: string; label: string };
  sections: BreakdownSection[];
};

export function DashboardDetailPage() {
  const { metric = '' } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const preset = params.get('preset') || 'this_month';
  const back = params.toString() ? `/?${params.toString()}` : '/';
  const [data, setData] = useState<Breakdown | null>(null);
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');

  useEffect(() => {
    setData(null);
    setGroup('All');
    setQ('');
    const request = from && to ? { metric, from, to } : { metric, preset };
    api.get('/dashboard/breakdown', { params: request }).then((response) => { setData(response.data.data); setError(''); }).catch((err) => setError(errorMessage(err)));
    if (metric === 'banks' || metric === 'cash') {
      api.get('/banks').then((response) => setAccounts((response.data.data || []) as BankAccountRow[])).catch(() => setAccounts([]));
    }
  }, [metric, from, to, preset]);

  const groups = useMemo(() => {
    const names = new Set<string>();
    for (const section of data?.sections || []) {
      if (section.kind !== 'list') continue;
      for (const row of section.rows) if (row.group) names.add(row.group);
    }
    return ['All', ...names];
  }, [data]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <Spinner />;

  const needle = q.trim().toLowerCase();
  function matches(row: BreakdownRow, useGroup: boolean) {
    if (useGroup && group !== 'All' && row.group !== group) return false;
    if (!needle) return true;
    return `${row.title} ${row.detail || ''} ${row.group || ''} ${row.date || ''}`.toLowerCase().includes(needle);
  }
  const shown = data.sections.map((section) => ({ ...section, rows: section.rows.filter((row) => matches(row, section.kind === 'list')) }));
  const liveBanks = metric === 'banks' ? listedBanks(accounts) : [];
  const bankTotalPaise = liveBanks.reduce((sum, bank) => sum + Number(bank.currentBalancePaise || 0), 0);
  const anyRows = shown.some((section) => section.rows.length > 0) || liveBanks.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <Link className="text-sm font-semibold text-secondary hover:text-ink" to={back}>← Dashboard</Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-secondary">{data.text}</p>
            {data.period !== false && <p className="mt-1 text-xs text-muted">{data.range.label} · {prettyDate(data.range.from)} to {prettyDate(data.range.to)}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-3xl font-semibold tracking-tight">{metric === 'banks' ? <Money paise={bankTotalPaise} /> : data.mode === 'money' ? <Money paise={data.totalPaise} /> : data.total}</p>
            {metric === 'banks' && <p className="text-xs text-muted">{liveBanks.length} {liveBanks.length === 1 ? 'bank' : 'banks'}</p>}
            {data.mode === 'money' && data.period !== false && metric !== 'banks' && <p className="text-xs text-muted">{data.total} entries</p>}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input className="h-11 w-full rounded-2xl border border-line bg-card px-3 text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime sm:max-w-xs sm:text-sm" placeholder="Search this list" value={q} onChange={(event) => setQ(event.target.value)} />
        {groups.length > 1 && (
          <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
            {groups.map((name) => (
              <button key={name} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${group === name ? 'border-black bg-tint text-ink' : 'border-line text-secondary'}`} type="button" onClick={() => setGroup(name)}>{name === 'cash' || name === 'bank' || name === 'online' || name === 'business' ? titleCase(name) : name}</button>
            ))}
          </div>
        )}
      </div>
      {!anyRows && <Empty title="Nothing in this list" text={needle || group !== 'All' ? 'Try another search or filter.' : 'Nothing has been posted for this view yet.'} />}
      {metric === 'banks' && (
        <section className="space-y-3">
          <h2 className="font-semibold">Accounts</h2>
          {liveBanks.length === 0 ? <Empty title="No banks" text="Accounts on the Banks page show here with their current balance." /> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {liveBanks.map((bank) => (
                <Link key={bank._id} to={`/banks/${bank._id}`} className="rounded-3xl border border-line bg-card p-5 transition hover:bg-tint">
                  <p className="font-semibold">{bank.accountName}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-secondary">{titleCase(bank.accountType)} · {bank.accountNumberMasked || 'No number'}</p>
                  <p className="mt-4 text-xs text-secondary">Amount</p>
                  <p className="mt-1 text-2xl font-semibold"><Money paise={Number(bank.currentBalancePaise || 0)} /></p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
      {shown.map((section) => {
        if (section.rows.length === 0 || (metric === 'banks' && section.kind === 'accounts')) return null;
        if (section.kind === 'accounts') {
          return (
            <section key={section.id} className="space-y-3">
              <h2 className="font-semibold">{section.title}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {section.rows.map((row) => {
                    const account = accounts.find((item) => item._id === row.id);
                    const number = account?.accountNumberMasked || '';
                    return (
                    <Link key={row.id} to={row.href || '/banks'} className="rounded-3xl border border-line bg-card p-5 transition hover:bg-tint">
                      <p className="font-semibold">{row.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-wider text-secondary">{titleCase(row.detail)}</p>
                      <p className="mt-4 text-xs text-secondary">Account number</p>
                      <p className="mt-1 font-semibold tracking-wide">{number || 'No number'}</p>
                      <p className="mt-3 text-xs text-secondary">Amount</p>
                      <p className="mt-1 text-2xl font-semibold"><Money paise={row.amountPaise} /></p>
                    </Link>
                    );
                  })}
                </div>
            </section>
          );
        }
        return (
          <section key={section.id} className="space-y-3">
            {data.sections.length > 1 && <h2 className="font-semibold">{section.title}</h2>}
            <ul className="overflow-hidden rounded-3xl border border-line bg-card">
                {section.rows.map((row) => {
                  const body = (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{row.title}</p>
                        <p className="truncate text-xs text-secondary">{[prettyDate(row.date), row.detail].filter(Boolean).join(' · ')}</p>
                      </div>
                      {(data.mode === 'money' || Number(row.amountPaise) > 0) && <span className="shrink-0 text-sm font-semibold"><Money paise={row.amountPaise} /></span>}
                    </>
                  );
                  return (
                    <li key={row.id} className="border-b border-line last:border-b-0">
                      {row.href ? <Link className="flex items-center gap-3 px-4 py-3 hover:bg-tint" to={row.href}>{body}</Link> : <div className="flex items-center gap-3 px-4 py-3">{body}</div>}
                    </li>
                  );
                })}
              </ul>
          </section>
        );
      })}
    </div>
  );
}

function prettyDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function ListCard({ title, rows, empty, href }: { title: string; rows: string[]; empty: string; href?: string }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{title}</h2>{href && <Link className="text-xs font-semibold text-secondary" to={href}>Open</Link>}</div>
      {rows.length === 0 ? <p className="text-sm text-secondary">{empty}</p> : <ul className="space-y-2 text-sm">{rows.slice(0, 6).map((row) => <li key={row} className="truncate">{row}</li>)}</ul>}
    </Card>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [data, setData] = useState<Record<string, Array<Record<string, string>>> | null>(null);
  useEffect(() => { if (q) api.get('/search', { params: { q } }).then((response) => setData(response.data.data)); }, [q]);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Search · {q}</h1>
      {!data ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(data).map(([key, rows]) => (
            <Card key={key}>
              <h2 className="mb-2 font-semibold">{titleCase(key)}</h2>
              {rows.length === 0 ? <p className="text-sm text-secondary">No matches.</p> : rows.map((row) => <p key={row._id || row.name} className="truncate text-sm">{row.name || row.fullName || row.title || row.number || row.reference || row.body}</p>)}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
