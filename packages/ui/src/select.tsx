import * as React from 'react';
import { cn } from './utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-line bg-base pl-3 pr-8 text-sm text-fg shadow-depth-flat',
          'focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-line-strong',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
      >
        ▾
      </span>
    </div>
  ),
);
Select.displayName = 'Select';
