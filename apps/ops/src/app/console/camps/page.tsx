import Link from 'next/link';
import { Button, EmptyState, OPS_HUES, PageHeader, Tag } from '@xcrm/ui';
import { requireUser } from '@/lib/session';
import { relativeTime } from '@/lib/relative-time';
import { getCampList } from '../_loaders/camps';

const STATUS_HUE: Record<'PROPOSED' | 'ACTIVE' | 'COMPLETED', number | null> = {
  ACTIVE: 135,
  PROPOSED: 60,
  COMPLETED: null,
};

/**
 * /console/camps — list view. ACTIVE camps top, then PROPOSED, then
 * COMPLETED. Click → detail.
 */
export default async function CampsListPage() {
  await requireUser();
  const camps = await getCampList();

  return (
    <>
      <PageHeader
        kicker="CAMPS"
        title="Camps"
        subtitle={
          camps.length === 0
            ? 'No camps yet. Create one to coordinate asset spacing across accounts.'
            : `${camps.filter((c) => c.status === 'ACTIVE').length} active · ${camps.filter((c) => c.status === 'PROPOSED').length} proposed.`
        }
        hue={OPS_HUES.camps}
        icon="Ca"
        actions={
          <Link href="/console/camps/new">
            <Button size="sm" hue={OPS_HUES.camps}>
              New camp
            </Button>
          </Link>
        }
      />

      {camps.length === 0 ? (
        <EmptyState
          hue={OPS_HUES.camps}
          icon="Ca"
          title="No camps yet"
          description="Camps group accounts that share a content library, so the generator avoids scheduling the same asset across them within 72 hours."
          actions={
            <Link href="/console/camps/new">
              <Button size="sm" hue={OPS_HUES.camps}>
                New camp
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {camps.map((c) => (
            <Link
              key={c.id}
              href={`/console/camps/${c.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface/40 px-4 py-3 transition hover:border-fg-muted"
            >
              <div className="min-w-[140px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-fg">
                    Week of {c.weekOf.toISOString().slice(0, 10)}
                  </span>
                  <Tag hue={STATUS_HUE[c.status]} size="sm">
                    {c.status.toLowerCase()}
                  </Tag>
                </div>
                <div className="mt-0.5 text-[11px] text-fg-faint">
                  {c.createdByAlgorithm ? 'auto-proposed' : 'operator-created'}
                  {c.approvedByName ? ` · approved by ${c.approvedByName}` : ''}
                </div>
              </div>
              <div className="text-[12px] text-fg-dim">
                {c.memberCount} member{c.memberCount === 1 ? '' : 's'}
              </div>
              <div className="min-w-[90px] text-right text-[11px] text-fg-faint">
                {relativeTime(c.createdAt)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
