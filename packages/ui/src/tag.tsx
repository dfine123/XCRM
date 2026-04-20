import * as React from 'react';
import { cn } from './utils';
import { hue, hueMuted, type Hue } from './hues';

interface TagProps {
  children: React.ReactNode;
  hue?: Hue;
  size?: 'sm' | 'md';
  className?: string;
}

export function Tag({ children, hue: h, size = 'md', className }: TagProps) {
  const sizing = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  if (h === null || h === undefined) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-line bg-surface font-medium tracking-wide text-fg-dim',
          sizing,
          className,
        )}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium tracking-wide',
        sizing,
        className,
      )}
      style={{
        color: hue(h),
        background: hueMuted(h),
        border: `1px solid ${hue(h, 0.3)}`,
      }}
    >
      {children}
    </span>
  );
}
