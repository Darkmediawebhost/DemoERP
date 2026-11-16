import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { todayKey } from '@/lib/format';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pretty(value: string) {
  if (!isKey(value)) return '';
  const [, month, day] = value.split('-');
  return `${Number(day)} ${SHORT_MONTHS[Number(month) - 1]} ${value.slice(0, 4)}`;
}

function shiftMonth(cursor: string, delta: number) {
  const [year, month] = cursor.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function cellsFor(cursor: string) {
  const [year, month] = cursor.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: { key: string; day: number; outside: boolean }[] = [];
  for (let index = 0; index < lead; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, index - lead + 1));
    cells.push({ key: date.toISOString().slice(0, 10), day: date.getUTCDate(), outside: true });
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push({
      key: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      outside: false,
    });
  }
  while (cells.length % 7 !== 0) {
    const [y, m, d] = cells[cells.length - 1].key.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + 1));
    cells.push({ key: date.toISOString().slice(0, 10), day: date.getUTCDate(), outside: true });
  }
  return cells;
}

type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { ref?: Ref<HTMLInputElement | null> };

export function DateField({ className = '', ref, value, defaultValue, onChange, onBlur, name, required, disabled, placeholder = 'Select date', id }: DateFieldProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(todayKey().slice(0, 7));
  const [revision, setRevision] = useState(0);
  const [place, setPlace] = useState({ top: 0, left: 0, width: 300 });
  const controlled = value !== undefined;
  const selected = controlled ? String(value ?? '') : (inputRef.current?.value || String(defaultValue || ''));
  void revision;

  function assignRef(node: HTMLInputElement | null) {
    inputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }

  function emit(next: string) {
    const input = inputRef.current;
    if (input && !controlled) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, next);
    }
    onChange?.({ target: { value: next, name: name || '' }, currentTarget: input } as ChangeEvent<HTMLInputElement>);
    setRevision((item) => item + 1);
    setOpen(false);
  }

  function openCalendar() {
    if (disabled) return;
    const base = isKey(selected) ? selected : todayKey();
    setCursor(base.slice(0, 7));
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const below = rect.bottom + 8;
      const top = below + 380 > window.innerHeight ? Math.max(8, rect.top - 380) : below;
      setPlace({ top, left, width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, cursor]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const [year, month] = cursor.split('-').map(Number);
  const today = todayKey();

  return (
    <div className="relative">
      <input
        ref={assignRef}
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        className="sr-only"
        value={controlled ? selected : undefined}
        defaultValue={controlled ? undefined : defaultValue}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={openCalendar}
      />
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openCalendar}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={selected ? '' : 'text-muted'}>{selected ? pretty(selected) : placeholder}</span>
        <Calendar size={16} className="shrink-0 text-secondary" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose a date"
          className="fixed z-[80] rounded-3xl border border-line bg-card p-3 shadow-[0_16px_40px_rgba(17,17,17,0.12)]"
          style={{ top: place.top, left: place.left, width: place.width }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-tint" aria-label="Previous month" onClick={() => setCursor(shiftMonth(cursor, -1))}><ChevronLeft size={16} /></button>
            <p className="text-sm font-semibold">{MONTHS[month - 1]} {year}</p>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-tint" aria-label="Next month" onClick={() => setCursor(shiftMonth(cursor, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-secondary">
            {WEEKDAYS.map((day) => <p key={day} className="py-1">{day}</p>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cellsFor(cursor).map((cell) => {
              const active = cell.key === selected;
              const isToday = cell.key === today;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => emit(cell.key)}
                  className={`grid h-10 place-items-center rounded-xl text-sm font-semibold ${active ? 'bg-black text-white dark:bg-white dark:text-black' : isToday ? 'ring-2 ring-lime' : 'hover:bg-tint'} ${cell.outside && !active ? 'text-muted' : ''}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="min-h-10 flex-1 rounded-xl border border-line text-sm font-semibold hover:bg-tint" onClick={() => emit(today)}>Today</button>
            <button type="button" className="min-h-10 flex-1 rounded-xl text-sm font-semibold text-secondary hover:bg-tint" onClick={() => emit('')}>Clear</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
