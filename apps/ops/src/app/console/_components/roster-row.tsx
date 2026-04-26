import Link from 'next/link';
import { OPS_HUES, Tag } from '@xcrm/ui';
import { ACCOUNT_STATUS_HUE } from '@/lib/status-hues';
import { relativeTime } from '@/lib/relative-time';
import type { RosterRow as RosterRowData } from '@/app/console/_loaders/roster';
import { SignalLight } from './signal-light';

/**
 * One row on the Roster. Server component — purely a render of the
 * pre-computed `RosterRow` data from `_loaders/roster.ts`. No
 * per-model fetches here.
 *
 * Layout note: the row used to be one big `<a>`. Build E breaks that
 * up so the review-queue pill can be its own link without nesting
 * anchors. The name+archetype + accounts area is the primary drill
 * target; the review pill is a sibling link to /console/review.
 */
export function RosterRowView({ row }: { row: RosterRowData }) {
  const hasIncompleteOnboarding = row.onboardingCompletedAt === null;
  const detailHref = hasIncompleteOnboarding
    ? `/console/onboard?modelId=${row.id}`
    : `/console/models/${row.id}`;
  const reviewCount = row.signals.reviewQueueCount;

  return (
    <div className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface/40 px-4 py-3 transition hover:border-fg-muted">
      {/* Drill target: name + accounts. Stays inside one Link. */}
      <Link
        href={detailHref}
        className="flex min-w-0 flex-[3] basis-[400px] flex-wrap items-center gap-x-4 gap-y-2"
      >
        <div className="min-w-[180px] flex-[2] basis-[180px]">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-fg">{row.displayName}</span>
            <Tag hue={OPS_HUES.models} size="sm">
              {row.archetype.toLowerCase().replace(/_/g, ' ')}
            </Tag>
          </div>
          <div className="mt-0.5 text-[11px] text-fg-dim">
            {row.agency.name} <span className="text-fg-faint">({row.agency.slug})</span>
          </div>
        </div>

        <div className="min-w-[200px] flex-[2] basis-[200px]">
          {row.accounts.length === 0 ? (
            <span className="text-[12px] text-fg-faint">no accounts</span>
          ) : (
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {row.accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-1.5 text-[12px]"
                >
                  <span className="font-mono text-fg">@{a.handle}</span>
                  <Tag hue={ACCOUNT_STATUS_HUE[a.status]} size="sm">
                    {a.status.toLowerCase().replace(/_/g, ' ')}
                  </Tag>
                  <span className="tabular-nums text-fg-dim">
                    {a.followerCount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>

      {/* Signal pills — outside the Link so the review pill can be its own anchor. */}
      <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
        {hasIncompleteOnboarding ? (
          <Link href={detailHref}>
            <SignalLight
              state="YELLOW"
              label="Resume onboarding"
              title="Onboarding started but not completed."
            />
          </Link>
        ) : (
          <>
            <SignalLight
              state={row.signals.runway}
              label="Runway"
              title="Days of scheduled posts (cron + manual generation contribute)."
            />
            <SignalLight
              state={row.signals.escalated}
              label="Escalated"
              count={row.signals.escalatedCount > 0 ? row.signals.escalatedCount : undefined}
              title="Unresolved VA escalations on this model's accounts. Click an item from /console/review to resolve."
            />
            <SignalLight
              state={row.signals.failedSyncs}
              label="Syncs"
              title="Failed Drive syncs in the last 24h (red at 3+ consecutive)."
            />
            <SignalLight
              state={row.signals.quarantined}
              label="Quarantine"
              title="Accounts currently in QUARANTINED status."
            />
            {row.signals.reviewQueue === 'NEUTRAL' && reviewCount !== null ? (
              <Link href="/console/review" title="Posts pending operator review.">
                <SignalLight
                  state="NEUTRAL"
                  label="Review"
                  count={reviewCount}
                />
              </Link>
            ) : null}
          </>
        )}
      </div>

      <div className="min-w-[90px] text-right text-[11px] text-fg-faint">
        {relativeTime(row.lastActivity)}
      </div>
    </div>
  );
}
