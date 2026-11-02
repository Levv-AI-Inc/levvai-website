'use client';

import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';

/** 04 §1.3. */

export const fieldLabelClass = 'mb-1.5 block text-xs font-semibold text-slate-500';
export const inputClass =
  'w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-[7px] text-[13px] focus:border-cyan-600 focus:bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-600 read-only:cursor-default';
const buttonBase =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:cursor-not-allowed disabled:opacity-45';
/** An input with a validation error: rose whether or not it has focus. */
export const invalidInputClass = inputClass.replace('border-slate-200', 'border-rose-500').replace('focus:border-cyan-600', 'focus:border-rose-500');
export const buttonClass = `${buttonBase} border-slate-200 bg-white text-slate-900 hover:border-cyan-600`;
/** Written out, not added to buttonClass: Tailwind's own order would let bg-white beat bg-cyan-600. */
export const primaryButtonClass = `${buttonBase} border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700`;

/** A label wired to whatever control `children` renders with the id it is handed. */
export function Field({ label, children }: { label: string; children: (labelId: string) => ReactNode }) {
  const labelId = useId();
  return (
    <div>
      <span id={labelId} className={fieldLabelClass}>{label}</span>
      {children(labelId)}
    </div>
  );
}

export function SayBox({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[10px] bg-slate-100 px-3 py-2.5 text-[13px] leading-relaxed text-slate-900 ${className}`}>{children}</div>;
}

const BADGE_VARIANT = {
  neutral: 'bg-slate-100 text-slate-500',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-rose-50 text-rose-700',
  info: 'bg-cyan-50 text-cyan-700',
} as const;

export type BadgeVariant = keyof typeof BADGE_VARIANT;

/** 04 §1.3. Sentence case in the DOM, capitals by CSS (06 §1.3). */
export function Badge({ variant, className = '', children }: { variant: BadgeVariant; className?: string; children: ReactNode }) {
  return <span className={`flex-none rounded-md px-1.5 py-px text-[10px] font-black uppercase tracking-wider ${BADGE_VARIANT[variant]} ${className}`}>{children}</span>;
}

/** The parts of `text` a sentence shows in bold. Display only: `textContent` stays the exact sentence. */
export function Emphasised({ text, phrases }: { text: string; phrases: string[] }) {
  const wanted = phrases.filter((phrase) => phrase !== '');
  if (wanted.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${wanted.map((phrase) => phrase.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return (
    <>
      {text.split(pattern).map((part, index) => (wanted.includes(part) ? <strong key={index} className="font-semibold">{part}</strong> : part))}
    </>
  );
}

export function FineLine({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-slate-500">
      <span aria-hidden={icon ? undefined : true} className="mt-px w-3 flex-none text-center">{icon ?? '·'}</span>
      <span>{children}</span>
    </div>
  );
}

/** 04 §6.5: `open` opens it when a setting needs attention. It never closes it: that is the user's. */
export function Details({ summary, open, children }: { summary: string; open?: boolean; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(open === true);
  useEffect(() => {
    if (open) setIsOpen(true);
  }, [open]);
  return (
    <div className="border-t border-slate-200 pt-3">
      <details open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded text-[13px] font-semibold text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
          <ChevronRight aria-hidden className="h-3.5 w-3.5 transition-transform motion-reduce:transition-none group-open:rotate-90" />
          {summary}
        </summary>
        <div className="mt-3 flex flex-col gap-3.5">{children}</div>
      </details>
    </div>
  );
}

export function Switch({ label, on, disabled, onToggle }: { label: string; on: boolean; disabled?: boolean; onToggle?: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onToggle?.(!on)}
      className={`relative h-5 w-9 flex-none rounded-full transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:cursor-not-allowed ${on ? 'bg-cyan-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform motion-reduce:transition-none ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export function ToggleRow({ label, help, on, disabled, onToggle }: { label: string; help: string; on: boolean; disabled?: boolean; onToggle?: (next: boolean) => void }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px]">
      <Switch label={label} on={on} disabled={disabled} onToggle={onToggle} />
      <div>
        {label}
        <small className="block text-xs text-slate-500">{help}</small>
      </div>
    </div>
  );
}

export const miniButtonClass = 'rounded-[7px] border border-slate-200 bg-white px-2.5 py-1 text-[12.5px] font-semibold hover:border-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:cursor-not-allowed disabled:opacity-45';
export const linkButtonClass = 'border-0 bg-transparent p-0 text-[12.5px] text-cyan-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600';

/** 04 §1.3. The preset box variant has a cyan border. */
export function GroupBox({ title, labelId, accent, children }: { title?: ReactNode; labelId?: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 rounded-[10px] border p-2.5 ${accent ? 'border-cyan-600' : 'border-slate-200'}`}>
      {title ? <span id={labelId} className="block text-xs font-semibold text-slate-500">{title}</span> : null}
      {children}
    </div>
  );
}

const fineColor = { plain: 'text-slate-500', warn: 'text-slate-500', ok: 'text-emerald-700' } as const;

/** A fine line with its tone (04 §1.3): warning icons are amber, success lines green. */
export function Fine({ icon, tone = 'plain', children }: { icon?: ReactNode; tone?: keyof typeof fineColor; children: ReactNode }) {
  return (
    <div className={`flex items-start gap-1.5 text-xs ${fineColor[tone]}`}>
      <span className={`mt-px w-3 flex-none ${tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-emerald-600' : ''}`}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}
