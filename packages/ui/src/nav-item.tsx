'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from './utils';
import { hue, hueGlow, hueMuted, type Hue } from './hues';

interface NavItemProps {
  href: string;
  label: string;
  /** 1-2 char abbreviation for the icon chip. Omit for no chip. */
  icon?: string;
  /** Section hue. Null/undefined = neutral (Dashboard, Settings). */
  hue?: Hue;
  /** Match strategy. Default "prefix" highlights nested pages too. */
  match?: 'exact' | 'prefix';
}

export function NavItem({ href, label, icon, hue: h, match = 'prefix' }: NavItemProps) {
  const pathname = usePathname();
  const active =
    match === 'exact' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const tint = hue(h);
  const hasHue = h !== null && h !== undefined;

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] outline-none transition',
        active ? 'text-fg' : 'text-fg-dim hover:text-fg hover:bg-surface',
      )}
      style={{
        background: active ? 'rgba(255,255,255,0.03)' : undefined,
        boxShadow: active && hasHue ? `0 0 28px ${hueGlow(h)}` : undefined,
      }}
    >
      {active && hasHue ? (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-[2px] rounded-full"
          style={{ background: tint }}
        />
      ) : null}
      <span
        className="grid h-6 w-6 flex-none place-items-center rounded text-[10px] font-semibold transition"
        style={
          hasHue
            ? {
                background: hueMuted(h),
                color: tint,
                border: `1px solid ${hue(h, 0.25)}`,
              }
            : {
                background: 'rgb(var(--bg-surface))',
                color: 'rgb(var(--fg-muted))',
                border: '1px solid rgb(var(--border-default))',
              }
        }
        aria-hidden
      >
        {icon ?? '·'}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
