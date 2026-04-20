import * as React from 'react';
import { cn } from './utils';

/**
 * App Shell — sidebar + main area. Used by ops /console and portal.
 * VA app uses <TopbarShell /> instead (horizontal nav).
 *
 * Server-safe (no client hooks). NavItem children are client components.
 */

export function Shell({
  sidebar,
  children,
  className,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-screen bg-base', className)}>
      <aside className="sticky top-0 flex h-screen w-[260px] flex-col border-r border-line bg-surface/50 backdrop-blur-sm">
        {sidebar}
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-10 py-10">{children}</div>
      </main>
    </div>
  );
}

export function ShellBrand({
  product,
  subtitle,
}: {
  product: string;
  subtitle?: string;
}) {
  return (
    <div className="px-5 pb-5 pt-6">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-6 w-6 rounded-md"
          style={{
            background:
              'conic-gradient(from 180deg, oklch(72% 0.17 25), oklch(72% 0.17 60), oklch(72% 0.17 135), oklch(72% 0.17 210), oklch(72% 0.17 290), oklch(72% 0.17 25))',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4), 0 0 18px rgba(255,255,255,0.05)',
          }}
        />
        <p className="text-[15px] font-semibold tracking-tight text-fg">{product}</p>
      </div>
      {subtitle ? <p className="mt-1 text-[11px] text-fg-muted">{subtitle}</p> : null}
    </div>
  );
}

export function ShellNav({ children }: { children: React.ReactNode }) {
  return <nav className="flex flex-1 flex-col gap-0.5 px-3">{children}</nav>;
}

export function ShellFooter({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-line px-3 py-3">{children}</div>;
}

export function ShellSection({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      {label ? (
        <p className="mb-1 px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          {label}
        </p>
      ) : null}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

/* ---------- horizontal variant for the VA app ---------- */

export function TopbarShell({
  brand,
  nav,
  actions,
  children,
}: {
  brand: React.ReactNode;
  nav: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-base">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-line bg-surface/60 px-6 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          {brand}
          <nav className="flex items-center gap-1">{nav}</nav>
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

export function TopbarItem({
  active,
  ...props
}: React.ComponentProps<'a'> & { active?: boolean }) {
  return (
    <a
      {...props}
      className={cn(
        'rounded-md px-3 py-1.5 text-[13px] transition',
        active ? 'bg-surface text-fg shadow-depth-flat' : 'text-fg-dim hover:text-fg hover:bg-surface',
        props.className,
      )}
    />
  );
}
