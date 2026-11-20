import type { StatusTone } from '../types/gradebook';

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  danger: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
  info: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  muted: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
