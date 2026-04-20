import * as React from 'react';
import { cn } from './utils';
import { hue, type Hue } from './hues';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section hue — renders a 2px top accent strip. Omit for neutral. */
  hue?: Hue;
  /** Depth tier. "raised" is the default for content cards. */
  depth?: 'flat' | 'raised' | 'modal';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, style, hue: h, depth = 'raised', children, ...props }, ref) => {
    const shadow =
      depth === 'modal'
        ? 'shadow-depth-modal bg-modal'
        : depth === 'flat'
          ? 'shadow-depth-flat bg-surface'
          : 'shadow-depth-raised bg-raised';
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-lg border border-line text-fg',
          shadow,
          className,
        )}
        style={style}
        {...props}
      >
        {h !== undefined && h !== null ? (
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{ background: hue(h) }}
          />
        ) : null}
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-[11px] font-semibold uppercase tracking-widest text-fg-muted', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';
