import { Button, OPS_HUES, Tag } from '@xcrm/ui';
import { cancelContextNote } from '@/app/console/context-notes/actions';
import { formatScope, formatRemainingTime } from '@/lib/context-notes';
import type { ActiveNote } from '@/app/console/_loaders/active-notes';

/**
 * One active-note row. Server component. Used inside the
 * ActiveNotesStrip's expanded list (Surface 2) and inside the model
 * detail `#notes` block (Surface 3).
 *
 * Cancel is a plain server-action form (no client JS) — a single
 * click posts to `cancelContextNote` and the page revalidates.
 */
export function NoteListItem({ note }: { note: ActiveNote }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-line bg-bg/40 p-3">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-fg">{note.title}</span>
        <Tag hue={OPS_HUES['context-notes']} size="sm">
          weight {note.weight}
        </Tag>
        <Tag hue={null} size="sm">
          {formatScope(note.scope)}
        </Tag>
        <span className="text-[11px] text-fg-faint">
          {formatRemainingTime(note.effectiveUntil)}
        </span>
        <form action={cancelContextNote} className="ml-auto">
          <input type="hidden" name="id" value={note.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="text-fg-faint hover:text-destructive"
          >
            Cancel
          </Button>
        </form>
      </header>
      <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-fg-dim">
        {note.body}
      </p>
      <footer className="text-[11px] text-fg-faint">
        by {note.authorName}
      </footer>
    </li>
  );
}
