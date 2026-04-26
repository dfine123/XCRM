import Link from 'next/link';
import { Button, EmptyState, PageHeader, Tag, VA_HUES } from '@xcrm/ui';
import { requireUser } from '@/lib/session';
import { getOpenBatchForUser } from './_loaders/current-batch';
import { pickUpBatch } from './actions';

/**
 * VA landing — /va. Either resume an open batch (PENDING / IN_PROGRESS)
 * or pick up a fresh one. Per /docs/operational-model.md the runner
 * is where the hours go; this page is just the doormat.
 */
export default async function VATodayPage() {
  const user = await requireUser();
  const open = await getOpenBatchForUser(user.id);

  return (
    <>
      <PageHeader
        kicker="TODAY"
        title="Tasks"
        subtitle={
          open
            ? `Resume your open batch — ${open.completedTasks}/${open.totalTasks} done.`
            : 'No open batch. Pick one up to start working.'
        }
        hue={VA_HUES.today}
        icon="Td"
      />

      {open ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface/40 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-fg">
              Batch in progress
            </span>
            <Tag hue={VA_HUES.batch} size="sm">
              {open.completedTasks} / {open.totalTasks}
            </Tag>
            <Tag hue={null} size="sm">
              {open.status.toLowerCase().replace(/_/g, ' ')}
            </Tag>
          </div>
          <p className="text-[13px] text-fg-dim">
            One task at a time, keyboard-first.{' '}
            <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[11px]">D</kbd>{' '}
            done ·{' '}
            <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[11px]">E</kbd>{' '}
            escalate ·{' '}
            <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[11px]">S</kbd>{' '}
            skip ·{' '}
            <kbd className="rounded border border-line bg-bg/60 px-1 font-mono text-[11px]">Esc</kbd>{' '}
            exit.
          </p>
          <div>
            <Link href={`/va/batch/${open.id}`}>
              <Button size="lg" hue={VA_HUES.batch}>
                Resume batch →
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface/40 p-5">
          <p className="text-[13px] text-fg-dim">
            Picking up creates a fresh batch from the next due posts on
            your queue. Up to 10 tasks, grouped by phone device.
          </p>
          <form action={pickUpBatch}>
            <Button type="submit" size="lg" hue={VA_HUES.today}>
              Pick up batch →
            </Button>
          </form>
          <EmptyState
            hue={VA_HUES.today}
            icon="Td"
            title="Nothing queued?"
            description="The roster's runway signal will go yellow when accounts run low. Operators top up by approving drafts in /console/review."
          />
        </div>
      )}
    </>
  );
}
