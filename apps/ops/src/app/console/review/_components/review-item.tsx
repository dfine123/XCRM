import Link from 'next/link';
import { Button, Card, OPS_HUES, Tag } from '@xcrm/ui';
import { ACCOUNT_STATUS_HUE } from '@/lib/status-hues';
import { relativeTime } from '@/lib/relative-time';
import type { AccountStatus } from '@xcrm/db';
import type { ReviewQueueItem } from '@/app/console/_loaders/review-queue';
import type { AssetAlternative } from '@/app/console/_loaders/asset-alternatives';
import { approvePost } from '../actions';
import { RejectForm } from './reject-form';
import { EditForm } from './edit-form';

/**
 * One card on the Review queue page. Server component — purely a
 * render of pre-loaded data. Action buttons are forms (approve, reject)
 * or client expanders (reject reason, edit & approve).
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
      <div className="flex flex-col gap-3 lg:flex-row">
        {/* Asset preview */}
        <div className="flex flex-col gap-2">
          {item.assetId ? (
            <Link
              href={`/console/content/${item.assetId}`}
              className="block"
              title="Open asset detail"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/drive/file/${item.assetId}`}
                alt=""
                loading="lazy"
                className="h-40 w-40 rounded-md border border-line object-cover"
              />
            </Link>
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-md border border-line bg-base text-[11px] uppercase tracking-[0.2em] text-fg-faint">
              no asset
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3">
          <header className="flex flex-wrap items-center gap-2">
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

          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-fg">
            {item.copy}
          </p>

          {item.reasoning ? (
            <p className="text-[11px] leading-relaxed text-fg-faint">
              <span className="font-semibold uppercase tracking-[0.15em] text-fg-muted">
                reasoning ·{' '}
              </span>
              {item.reasoning}
            </p>
          ) : null}

          {item.model.hardRules.length > 0 ? (
            <p className="text-[11px] text-fg-dim">
              <span className="text-destructive">hard rules:</span>{' '}
              {item.model.hardRules.join(' · ')}
            </p>
          ) : null}

          <div className="flex flex-wrap items-start justify-end gap-2">
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
