import * as React from 'react';
import { cn } from './utils';
import { hue, hueMuted, type Hue } from './hues';

interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  hue?: Hue;
  icon?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  hue: h,
  icon,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-dashed border-line-strong bg-surface/60 p-10 text-center shadow-depth-flat',
        className,
      )}
    >
      {icon && h !== undefined && h !== null ? (
        <div
          className="mx-auto grid h-12 w-12 place-items-center rounded-lg text-base font-semibold"
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
      <p className="mt-4 text-sm font-medium text-fg">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-fg-muted">
          {description}
        </p>
      ) : null}
      {actions ? <div className="mt-5 flex justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
