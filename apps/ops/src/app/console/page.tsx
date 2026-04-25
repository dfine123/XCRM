import Link from 'next/link';
import { Button, EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';
import { requireUser } from '@/lib/session';
import { getRosterModels } from './_loaders/roster';
import { getActiveNotes } from './_loaders/active-notes';
import { ActiveNotesStrip } from './_components/active-notes-strip';
import { NoteListItem } from './_components/note-list-item';
import { RosterRowView } from './_components/roster-row';

/**
 * Surface 2 — Roster. Default operator home after login.
 *
 * One row per model, sorted red → yellow → green (worst-signal decides
 * the group; alphabetical within). A healthy roster looks like nothing:
 * all green pills, no red. That is the success state.
 *
 * Everything on this page comes from `getRosterModels()` — no
 * per-model fetches in individual components.
 */
export default async function RosterPage() {
  await requireUser();
  const [rows, activeNotes] = await Promise.all([
    getRosterModels(),
    getActiveNotes(),
  ]);

  const counts = {
    red: rows.filter((r) => r.severity === 3).length,
    yellow: rows.filter((r) => r.severity === 2).length,
    total: rows.length,
  };
  const reviewQueueTotal = rows.reduce(
    (sum, r) => sum + (r.signals.reviewQueueCount ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        kicker="ROSTER"
        title="Models"
        subtitle={
          counts.total === 0
            ? 'No models yet. Onboard one to start.'
            : counts.red + counts.yellow === 0
              ? 'All signals green — nothing needs attention.'
              : `${counts.red} red · ${counts.yellow} yellow · ${counts.total} total.`
        }
        hue={OPS_HUES.models}
        icon="Md"
        actions={
          <Link href="/console/onboard">
            <Button size="sm" hue={OPS_HUES.models}>
              Onboard model
            </Button>
          </Link>
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-line bg-surface/40 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ActiveNotesStrip
            count={activeNotes.length}
            expanded={activeNotes.map((n) => (
              <NoteListItem key={n.id} note={n} />
            ))}
          />
          {reviewQueueTotal > 0 ? (
            <Link
              href="/console/review"
              className="text-[12px] font-medium text-fg-dim hover:text-fg"
            >
              Review queue: {reviewQueueTotal} pending →
            </Link>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          hue={OPS_HUES.models}
          icon="Md"
          title="No models yet"
          description="The roster shows one row per model with live signal lights. Onboard a model to populate it."
          actions={
            <Link href="/console/onboard">
              <Button size="sm" hue={OPS_HUES.models}>
                Onboard model
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <RosterRowView key={row.id} row={row} />
          ))}
        </div>
      )}
    </>
  );
}
