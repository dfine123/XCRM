import Link from 'next/link';
import { EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';
import { requireUser } from '@/lib/session';
import { getReviewQueue } from '@/app/console/_loaders/review-queue';
import { getAssetAlternativesForAccount } from '@/app/console/_loaders/asset-alternatives';
import { ReviewItem } from './_components/review-item';

/**
 * Review queue — Surface for the operator to triage the
 * PENDING_APPROVAL drafts that Build D produces. Per spec: not a
 * daily destination. The roster signal light brings the operator
 * here when something is waiting.
 *
 * One global FIFO list; no filtering, no pagination. Cap is 100 in
 * the loader — if a real queue ever overflows that, we'll add filters
 * then.
 */
export default async function ReviewQueuePage() {
  await requireUser();

  const items = await getReviewQueue();

  // Each item's edit form needs the asset-alternatives pool. Compute
  // them in parallel so the page renders in one round-trip.
  const alternativesByPost = new Map<string, Awaited<ReturnType<typeof getAssetAlternativesForAccount>>>();
  await Promise.all(
    items.map(async (item) => {
      const alts = await getAssetAlternativesForAccount(item.account.id, {
        excludeAssetId: item.assetId ?? undefined,
        count: 6,
      });
      alternativesByPost.set(item.id, alts);
    }),
  );

  return (
    <>
      <PageHeader
        kicker="REVIEW QUEUE"
        title="Pending posts"
        subtitle={
          items.length === 0
            ? 'Empty queue. The generator will surface drafts here as it runs.'
            : `${items.length} draft${items.length === 1 ? '' : 's'} awaiting your call. Oldest first.`
        }
        hue={OPS_HUES.formula}
        icon="Fo"
        actions={
          <Link
            href="/console"
            className="text-[13px] text-fg-dim hover:text-fg"
          >
            ← Back to roster
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          hue={OPS_HUES.formula}
          icon="Fo"
          title="Nothing to review"
          description="Auto-approved posts go straight to SCHEDULED — they don't appear here. Drafts only land here when the generator's confidence is below the per-status threshold or when an account is FRESH_BUILD."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <ReviewItem
              key={item.id}
              item={item}
              alternatives={alternativesByPost.get(item.id) ?? []}
            />
          ))}
        </div>
      )}
    </>
  );
}
