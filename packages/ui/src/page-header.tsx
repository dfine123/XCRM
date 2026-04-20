import * as React from 'react';
import { cn } from './utils';
import { hue, hueMuted, type Hue } from './hues';

interface PageHeaderProps {
  /** Short uppercase kicker, e.g. "ACCOUNTS" or "CAMPS · WEEK 14". */
  kicker?: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Section hue — colors the kicker + a small left-side icon chip. */
  hue?: Hue;
  icon?: string;
  /** Right-aligned action buttons / filters. */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ kicker, title, subtitle, hue: h, icon, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-8 flex items-start justify-between gap-6 border-b border-line pb-6',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {icon && h !== undefined && h !== null ? (
          <div
            className="grid h-11 w-11 flex-none place-items-center rounded-lg text-sm font-semibold shadow-depth-flat"
            style={{
              background: hueMuted(h),
              color: hue(h),
              border: `1px solid ${hue(h, 0.3)}`,
            }}
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          {kicker ? (
            <p
              className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: hue(h) ?? 'rgb(var(--fg-muted))' }}
            >
              {kicker}
            </p>
          ) : null}
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-fg">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-fg-dim">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </header>
  );
}
