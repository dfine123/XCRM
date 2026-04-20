import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
import { hue, hueMuted, type Hue } from './hues';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition outline-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        /* neutral elevated — matches the raised surface */
        default:
          'border border-line-strong bg-surface text-fg shadow-depth-flat hover:bg-raised',
        /* outline sits on the base, used inside cards where bg-surface is redundant */
        outline: 'border border-line text-fg hover:bg-surface hover:border-line-strong',
        /* ghost: chromeless, for nav items and low-importance actions */
        ghost: 'text-fg-dim hover:text-fg hover:bg-surface',
        /* destructive uses the h=25 red-orange from the rainbow set */
        destructive:
          'border border-[oklch(72%_0.17_25/0.3)] bg-[oklch(72%_0.17_25/0.08)] text-[oklch(72%_0.17_25)] hover:bg-[oklch(72%_0.17_25/0.14)]',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-[13px]',
        lg: 'h-11 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Section hue — colors the focus ring + any section-tinted variant. */
  hue?: Hue;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, hue: h, style, ...props }, ref) => {
    /* Hue focus ring via inline style — single rule, server-safe. */
    const ringStyle =
      h !== undefined && h !== null
        ? ({ '--ring': hue(h, 0.4) } as React.CSSProperties)
        : undefined;
    return (
      <button
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          h !== undefined && h !== null
            ? 'focus-visible:shadow-[0_0_0_2px_var(--ring)]'
            : 'focus-visible:shadow-[0_0_0_2px_rgb(var(--fg-dim)/0.4)]',
          className,
        )}
        style={{ ...ringStyle, ...style }}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };

/** Hue-tinted action button — for section-scoped primary actions. */
export const SectionButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'variant'> & { hue: number }
>(({ className, hue: h, style, size, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      buttonVariants({ variant: 'outline', size: size ?? 'default' }),
      'border-transparent focus-visible:shadow-[0_0_0_2px_var(--ring)]',
      className,
    )}
    style={
      {
        ...style,
        color: hue(h),
        background: hueMuted(h),
        border: `1px solid ${hue(h, 0.3)}`,
        '--ring': hue(h, 0.4),
      } as React.CSSProperties
    }
    {...props}
  />
));
SectionButton.displayName = 'SectionButton';
