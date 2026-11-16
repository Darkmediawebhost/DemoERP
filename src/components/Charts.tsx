import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inr } from '@/lib/format';

const axis = { fontSize: 11, fill: '#737373' };
const ink = 'var(--ink)';

function rupeeTick(value: number) {
  const rupees = value / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const moneyAxis = { tick: axis, axisLine: false, tickLine: false, width: 52, tickFormatter: rupeeTick };

function Tip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((item) => <p key={item.name} style={{ color: item.color }}>{item.name}: {inr(item.value)}</p>)}
    </div>
  );
}

export function RevenueChart({ data }: { data: Array<Record<string, number | string>> }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis {...moneyAxis} />
        <Tooltip content={<Tip />} />
        <Legend />
        <Line type="monotone" dataKey="incomePaise" name="Income" stroke={ink} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="expensePaise" name="Expenses" stroke="#A3A3A3" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="netPaise" name="Net" stroke="#92E622" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GroupedBars({ data }: { data: Array<Record<string, number | string>> }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis {...moneyAxis} />
        <Tooltip content={<Tip />} />
        <Legend />
        <Bar dataKey="incomePaise" name="Income" fill={ink} radius={4} isAnimationActive={false} />
        <Bar dataKey="expensePaise" name="Expenses" fill="#D4D4D4" radius={4} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProfitArea({ data }: { data: Array<Record<string, number | string>> }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis {...moneyAxis} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="netPaise" name="Net profit" stroke={ink} fill="#92E622" fillOpacity={0.35} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FlowBars({ data }: { data: Array<Record<string, number | string>> }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis {...moneyAxis} />
        <Tooltip content={<Tip />} />
        <Legend />
        <Bar dataKey="inPaise" name="Money in" fill={ink} radius={4} isAnimationActive={false} />
        <Bar dataKey="outPaise" name="Money out" fill="#A3A3A3" radius={4} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data }: { data: Array<{ name: string; amountPaise: number }> }) {
  if (!data.length) return <EmptyChart />;
  const colors = [ink, '#404040', '#737373', '#A3A3A3', '#D4D4D4', '#92E622'];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="amountPaise" nameKey="name" innerRadius={58} outerRadius={80} isAnimationActive={false}>
          {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
        </Pie>
        <Tooltip content={<Tip />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({ data, dataKey = 'amountPaise' }: { data: Array<Record<string, string | number>>; dataKey?: string }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid stroke="var(--line)" horizontal={false} />
        <XAxis type="number" tick={axis} axisLine={false} tickLine={false} tickFormatter={rupeeTick} />
        <YAxis type="category" dataKey="name" tick={axis} width={90} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} />
        <Bar dataKey={dataKey} name="Amount" fill="#92E622" radius={4} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return <div className="grid h-[220px] place-items-center text-sm text-secondary">No financial activity in this period.</div>;
}
