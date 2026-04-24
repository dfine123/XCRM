'use client';

import { useEffect, useState } from 'react';

/**
 * Sticky left-rail with in-page anchor links for Surface 3. No tabs,
 * no sub-routes — the operator scrolls vertically and clicks jumps
 * around without a page load.
 *
 * The active-section highlight uses `IntersectionObserver`. A section
 * counts as "active" once its top edge crosses the 25% viewport mark;
 * the most recently-crossed section wins when several are partially
 * visible.
 */
export type AnchorItem = { id: string; label: string; hint?: string };

export function AnchorNav({ items }: { items: AnchorItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the greatest intersection ratio that is
        // currently intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      {
        // Trigger when a section crosses the top 25% of the viewport.
        rootMargin: '-25% 0px -60% 0px',
        threshold: [0, 0.1, 0.5, 1],
      },
    );

    for (const s of sections) observer.observe(s);
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-4 flex flex-col gap-1 self-start">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`flex flex-col rounded-md px-3 py-2 text-[13px] transition ${
              isActive
                ? 'bg-surface/60 text-fg'
                : 'text-fg-dim hover:bg-surface/40 hover:text-fg'
            }`}
          >
            <span className="font-medium">{item.label}</span>
            {item.hint ? (
              <span className="text-[11px] text-fg-faint">{item.hint}</span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
