import { Children, cloneElement, isValidElement, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { DateField } from '@/components/DateField';
import { inr } from '@/lib/format';

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet' }) {
  const styles = {
    primary: 'bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200',
    ghost: 'border border-line bg-card hover:bg-tint',
    danger: 'bg-danger text-white hover:opacity-90',
    quiet: 'text-secondary hover:bg-tint hover:text-ink',
  }[variant];
  const height = variant === 'quiet' ? 'min-h-11 px-3' : 'min-h-11 px-3.5';
  const width = props.type === 'submit' ? 'w-full' : '';
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50 ${height} ${width} ${styles} ${className}`} {...props} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-secondary">{label}</span>
      {children}
    </label>
  );
}

export const controlClass = 'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base outline-none transition focus:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime sm:text-sm dark:focus:border-white';

export function TextInput({ className = '', type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  if (type === 'date') return <DateField className={`${controlClass} ${className}`} {...props} />;
  return <input type={type} className={`${controlClass} ${className}`} {...props} />;
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} min-h-24 ${className}`} {...props} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClass} ${className}`} {...props} />;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className="max-h-[92dvh] w-full overflow-auto rounded-t-3xl border border-line bg-card p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card sm:max-w-xl sm:rounded-3xl sm:p-6" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button className="grid h-11 w-11 place-items-center rounded-full text-secondary hover:bg-tint hover:text-ink" onClick={onClose} type="button" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {text && <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">{text}</p>}
      </div>
      {action && <div className="flex w-full flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap sm:w-auto sm:[&_button]:w-auto sm:[&_button]:flex-none [&_button]:w-full [&_a]:w-full sm:[&_a]:w-auto">{action}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-card p-4 shadow-card sm:p-5 ${className}`}>{children}</section>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'lime' }) {
  const styles = {
    neutral: 'bg-bg text-secondary',
    success: 'bg-success/10 text-success',
    danger: 'bg-danger/10 text-danger',
    lime: 'bg-lime text-black',
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{children}</span>;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-secondary">{text}</p>
    </div>
  );
}

export function Spinner() {
  return <div className="grid min-h-40 place-items-center text-sm text-secondary">Loading…</div>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{children}</p>;
}

type WithChildren = { children?: ReactNode };

function asElement(node: ReactNode) {
  return isValidElement<WithChildren>(node) ? node : null;
}

function headerLabels(children: ReactNode) {
  const labels: string[] = [];
  Children.forEach(children, (sectionNode) => {
    const section = asElement(sectionNode);
    if (!section || section.type !== 'thead') return;
    Children.forEach(section.props.children, (rowNode) => {
      const row = asElement(rowNode);
      if (!row) return;
      Children.forEach(row.props.children, (cellNode) => {
        const cell = asElement(cellNode);
        if (!cell) return;
        const text = cell.props.children;
        labels.push(typeof text === 'string' || typeof text === 'number' ? String(text) : '');
      });
    });
  });
  return labels;
}

function labelRows(children: ReactNode, labels: string[]) {
  return Children.map(children, (sectionNode) => {
    const section = asElement(sectionNode);
    if (!section || section.type !== 'tbody') return sectionNode;
    const rows = Children.map(section.props.children, (rowNode) => {
      const row = asElement(rowNode);
      if (!row || row.type !== 'tr') return rowNode;
      let index = 0;
      const cells = Children.map(row.props.children, (cellNode) => {
        const cell = asElement(cellNode);
        if (!cell) return cellNode;
        const label = labels[index] || '';
        index += 1;
        return cloneElement(cell as ReactElement<{ label?: string }>, { label });
      });
      return cloneElement(row, undefined, cells);
    });
    return cloneElement(section, undefined, rows);
  });
}

export function Table({ children }: { children: ReactNode }) {
  const labels = headerLabels(children);
  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-card">
      <table className="responsive-table w-full border-collapse text-sm md:min-w-[720px]">{labelRows(children, labels)}</table>
    </div>
  );
}

export function Th({ children }: { children?: ReactNode }) {
  return <th className="border-b border-line px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-secondary">{children}</th>;
}

export function Td({ children, className = '', label = '' }: { children?: ReactNode; className?: string; label?: string }) {
  return <td data-label={label} className={`border-b border-line px-4 py-3 align-middle md:border-b ${className}`}>{children}</td>;
}

export function AnimatedRupees({ paise }: { paise: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const from = shown;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 500);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(from + (paise - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // The animation starts from the last displayed value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paise]);
  return <span className="tabular">{inr(shown)}</span>;
}

export function Money({ paise }: { paise?: number | null }) {
  return <span className="tabular">{inr(paise)}</span>;
}
