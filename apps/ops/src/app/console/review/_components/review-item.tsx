import Link from 'next/link';
import { Button, Card, OPS_HUES, Tag } from '@xcrm/ui';
import { ACCOUNT_STATUS_HUE } from '@/lib/status-hues';
import { relativeTime } from '@/lib/relative-time';
import type { AccountStatus } from '@xcrm/db';
import type { ReviewQueueItem } from '@/app/console/_loaders/review-queue';
import type { AssetAlternative } from '@/app/console/_loaders/asset-alternatives';
import { PostPreview } from '@/app/console/_components/post-preview';
import { approvePost } from '../actions';
import { RejectForm } from './reject-form';
import { EditForm } from './edit-form';

/**
 * One card on the Review queue page. Server component.
 *
 * Layout: operator metadata strip on top, then the X-style
 * `<PostPreview>` (what the audience would see), then reasoning +
 * hard-rules reminder, then the action buttons. Keeps the
 * preview honest — operator info doesn't intrude on the post itself.
 */
export function ReviewItem({
  item,
  alternatives,
}: {
  item: ReviewQueueItem;
  alternatives: AssetAlternative[];
}) {
  return (
    <Card id={`post-${item.id}`} className="scroll-mt-6 p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/console/models/${item.model.id}`}
          className="text-[13px] font-medium text-fg hover:underline"
        >
          {item.model.displayName}
        </Link>
        <span className="text-fg-muted">·</span>
        <span className="font-mono text-[13px] text-fg">
          @{item.account.handle}
        </span>
        <Tag
          hue={ACCOUNT_STATUS_HUE[item.account.status as AccountStatus]}
          size="sm"
        >
          {item.account.status.toLowerCase().replace(/_/g, ' ')}
        </Tag>
        <Tag hue={OPS_HUES.models} size="sm">
          {item.model.archetype.toLowerCase().replace(/_/g, ' ')}
        </Tag>
        {item.confidenceScore !== null ? (
          <Tag hue={OPS_HUES.formula} size="sm">
            conf {(item.confidenceScore * 100).toFixed(0)}%
          </Tag>
        ) : null}
        <span className="ml-auto text-[11px] text-fg-faint">
          {relativeTime(item.createdAt)}
          {item.scheduledFor ? (
            <>
              {' · for '}
              {item.scheduledFor.toISOString().slice(0, 16).replace('T', ' ')} UTC
            </>
          ) : null}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        {/* Tweet-style preview — what the audience will see. */}
        <div>
          <PostPreview
            displayName={item.model.displayName}
            handle={item.account.handle}
            copy={item.copy}
            assetId={item.assetId}
            postedTimestamp={
              item.scheduledFor
                ? item.scheduledFor.toISOString().slice(0, 10)
                : undefined
            }
          />
          {item.assetId ? (
            <Link
              href={`/console/content/${item.assetId}`}
              className="mt-2 inline-block text-[11px] text-fg-dim hover:text-fg"
            >
              open asset detail →
            </Link>
          ) : null}
        </div>

        {/* Decision context + actions, kept beside the preview. */}
        <div className="flex flex-col gap-3">
          {item.reasoning ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-fg-muted">
                Reasoning
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-fg-dim">
                {item.reasoning}
              </p>
            </div>
          ) : null}

          {item.model.hardRules.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-destructive/80">
                Hard rules
              </p>
              <p className="mt-1 text-[12px] text-fg-dim">
                {item.model.hardRules.join(' · ')}
              </p>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2">
            <RejectForm postId={item.id} />
            <EditForm
              postId={item.id}
              initialCopy={item.copy}
              initialAssetId={item.assetId}
              alternatives={alternatives}
            />
            <form action={approvePost}>
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" size="sm" hue={OPS_HUES.formula}>
                Approve
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Card>
  );
}
