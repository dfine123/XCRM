import { Tag, OPS_HUES } from '@xcrm/ui';

/**
 * Header strip on the Roster showing how many `ContextNote` rows are
 * currently active. Stubbed to 0 until Build C (the note overlay +
 * `N` hotkey) lands. Kept here so the layout doesn't reshape later.
 *
 * The spec also asks for "click to expand inline" — deferred to Build C
 * for the same reason we're not wiring `N` yet. Today it's a
 * read-only indicator.
 */
export function ActiveNotesStrip({ count = 0 }: { count?: number } = {}) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-fg-dim">
      <Tag hue={OPS_HUES['context-notes']} size="sm">
        {count} {count === 1 ? 'note' : 'notes'} active
      </Tag>
      <span className="text-fg-faint">
        (hotkey <kbd className="rounded border border-line bg-surface/40 px-1 font-mono text-[10px] text-fg-dim">N</kbd> arrives with Build C)
      </span>
    </div>
  );
}
