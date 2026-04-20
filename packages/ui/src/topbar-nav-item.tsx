'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from './utils';
import { hue, hueGlow, type Hue } from './hues';

interface TopbarNavItemProps {
  href: string;
  label: string;
  hue?: Hue;
  match?: 'exact' | 'prefix';
}

export function TopbarNavItem({ href, label, hue: h, match = 'exact' }: TopbarNavItemProps) {
  const pathname = usePathname();
  const active =
    match === 'exact' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const tint = hue(h);
  const hasHue = h !== null && h !== undefined;
  return (
    <Link
      href={href}
      className={cn(
        'relative rounded-md px-3 py-1.5 text-[13px] transition',
        active ? 'bg-surface text-fg shadow-depth-flat' : 'text-fg-dim hover:text-fg hover:bg-surface',
      )}
      style={active && hasHue ? { boxShadow: `0 0 24px ${hueGlow(h)}`, background: 'rgb(var(--bg-surface))' } : undefined}
    >
      {active && hasHue ? (
        <span
          aria-hidden
          className="absolute inset-x-2 -bottom-[9px] h-[2px] rounded-full"
          style={{ background: tint }}
        />
      ) : null}
      {label}
    </Link>
  );
}
