'use client';

import { useState, type ReactNode } from 'react';
import { Tag, OPS_HUES } from '@xcrm/ui';

/**
 * Expandable roster-header strip showing the live active-note count.
 * Renders a button that toggles visibility of the operator-supplied
 * `expanded` content (a server-rendered list of `<NoteListItem>`s).
 *
 * Stays a client component for the single piece of state
 * (`isOpen`) — the list itself is server-rendered and passed through
 * as children so we don't round-trip data to build it.
 */
export function ActiveNotesStrip({
  count,
  expanded,
}: {
  count: number;
  expanded?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const canExpand = count > 0 && expanded !== undefined;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2 text-[12px] text-fg-dim">
        <button
          type="button"
          onClick={() => canExpand && setIsOpen((v) => !v)}
          disabled={!canExpand}
          className={
            canExpand ? 'cursor-pointer focus:outline-none' : 'cursor-default'
          }
        >
          <Tag hue={OPS_HUES['context-notes']} size="sm">
            {count} {count === 1 ? 'note' : 'notes'} active
            {canExpand ? (isOpen ? ' ▾' : ' ▸') : ''}
          </Tag>
        </button>
        <span className="text-fg-faint">
          hotkey{' '}
          <kbd className="rounded border border-line bg-surface/40 px-1 font-mono text-[10px] text-fg-dim">
            N
          </kbd>{' '}
          to create
        </span>
      </div>

      {isOpen && expanded ? (
        <ul className="flex flex-col gap-2">{expanded}</ul>
      ) : null}
    </div>
  );
}
