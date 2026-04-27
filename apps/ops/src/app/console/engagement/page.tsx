import Link from 'next/link';
import { Card, EmptyState, OPS_HUES, PageHeader, Tag } from '@xcrm/ui';
import { requireUser } from '@/lib/session';
import { relativeTime } from '@/lib/relative-time';
import { getPostsNeedingEngagement } from '@/app/console/_loaders/engagement-pending';
import { EngagementForm } from './_components/engagement-form';

/**
 * `/console/engagement` — manual engagement-entry surface for Build G.
 *
 * Lists POSTED posts whose latest snapshot is missing or stale (>6h),
 * newest first. Each row gets an inline 6-input form that posts to
 * `recordEngagement`.
 *
 * Stop-gap path. When a real X-API or scraping ingestor lands, it
 * hits the same data layer via `POST /api/engagement/ingest` and this
 * page becomes the audit / manual override view.
 */
export default async function EngagementPage() {
  await requireUser();
  const items = await getPostsNeedingEngagement();

  return (
    <>
      <PageHeader
        kicker="ENGAGEMENT"
        title="Manual entry"
        subtitle={
          items.length === 0
            ? 'All posts have fresh engagement snapshots.'
            : `${items.length} POSTED post${items.length === 1 ? '' : 's'} ${items.some((i) => !i.latest) ? 'need' : 'getting stale'} a snapshot.`
        }
        hue={OPS_HUES.insights}
        icon="In"
      />

      {items.length === 0 ? (
        <EmptyState
          hue={OPS_HUES.insights}
          icon="In"
          title="Nothing to record"
          description="Manual entry catches up over time. When a real X-API ingestor is wired, snapshots arrive on a cron and this page surfaces only stale-or-missing data."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.postId} className="p-4">
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/console/models/${item.modelId}`}
                  className="text-[13px] font-medium text-fg hover:underline"
                >
                  {item.modelDisplayName}
                </Link>
                <span className="text-fg-muted">·</span>
                <span className="font-mono text-[13px] text-fg">
                  @{item.accountHandle}
                </span>
                <Tag hue={null} size="sm">
                  {item.agencySlug}
                </Tag>
                <span className="ml-auto text-[11px] text-fg-faint">
                  posted{' '}
                  {item.postedAt
                    ? relativeTime(item.postedAt)
                    : 'time unknown'}
                  {item.latest ? (
                    <>
                      {' '}
                      · last snapshot {relativeTime(item.latest.capturedAt)}
                    </>
                  ) : (
                    ' · no snapshot yet'
                  )}
                </span>
              </header>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
                {item.assetId ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/drive/file/${item.assetId}`}
                    alt=""
                    loading="lazy"
                    className="h-32 w-full rounded-md border border-line object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center rounded-md border border-line bg-base text-[10px] uppercase tracking-[0.2em] text-fg-faint">
                    no asset
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg">
                    {item.copy}
                  </p>
                  <EngagementForm
                    postId={item.postId}
                    defaults={
                      item.latest
                        ? {
                            likes: item.latest.likes,
                            reposts: item.latest.reposts,
                            replies: item.latest.replies,
                            bookmarks: item.latest.bookmarks,
                            impressions: item.latest.impressions,
                            profileClicks: item.latest.profileClicks,
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
