import * as React from 'react';
import { cn } from './utils';
import { hue, hueMuted, type Hue } from './hues';
import { Card } from './card';

interface StatCardProps {
  label: string;
  /** Main stat value. Pass '—' for empty state. */
  value: React.ReactNode;
  /** Optional delta string like "+12%" or "-3%". Color matches the hue. */
  delta?: string;
  hue?: Hue;
  icon?: string;
  /** Small caption under the value, e.g. "last 24h". */
  caption?: string;
  className?: string;
}

export function StatCard({ label, value, delta, hue: h, icon, caption, className }: StatCardProps) {
  return (
    <Card hue={h} className={cn('p-5', className)}>
      <div className="flex items-start justify-between">
        {icon && h !== undefined && h !== null ? (
          <div
            className="grid h-9 w-9 place-items-center rounded-md text-xs font-semibold"
            style={{
              background: hueMuted(h),
              color: hue(h),
              border: `1px solid ${hue(h, 0.3)}`,
            }}
            aria-hidden
          >
            {icon}
          </div>
        ) : (
          <span className="h-9" aria-hidden />
        )}
        {delta ? (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
            style={{
              color: hue(h) ?? 'rgb(var(--fg-dim))',
              background: hueMuted(h) ?? 'rgb(var(--bg-surface))',
            }}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
        {label}
      </p>
      <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-fg">{value}</p>
      {caption ? <p className="mt-2 text-[11px] text-fg-muted">{caption}</p> : null}
    </Card>
  );
}
