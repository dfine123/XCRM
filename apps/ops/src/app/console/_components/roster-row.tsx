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
 * Click target: the whole row. Anchors are nested only for nav-able
 * sub-elements (agency name, account handles link to their pages).
 */
export function RosterRowView({ row }: { row: RosterRowData }) {
  const hasIncompleteOnboarding = row.onboardingCompletedAt === null;
  const detailHref = hasIncompleteOnboarding
    ? `/console/onboard?modelId=${row.id}`
    : `/console/models/${row.id}`;

  return (
    <Link
      href={detailHref}
      className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface/40 px-4 py-3 transition hover:border-fg-muted"
    >
      {/* Name + archetype */}
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

      {/* Account handles + follower counts */}
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

      {/* Signal lights */}
      <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
        {hasIncompleteOnboarding ? (
          <SignalLight
            state="YELLOW"
            label="Resume onboarding"
            title="Onboarding started but not completed."
          />
        ) : (
          <>
            <SignalLight
              state={row.signals.runway}
              label="Runway"
              title="Days of scheduled posts. Data source arrives with Build D."
            />
            <SignalLight
              state={row.signals.escalated}
              label="Escalated"
              title="Unresolved escalated tasks. Data source arrives with Build F."
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
            {row.signals.reviewQueue === 'NEUTRAL' && row.signals.reviewQueueCount !== null ? (
              <SignalLight
                state="NEUTRAL"
                label="Review"
                count={row.signals.reviewQueueCount}
                title="Posts pending operator review."
              />
            ) : null}
          </>
        )}
      </div>

      {/* Last-activity timestamp */}
      <div className="min-w-[90px] text-right text-[11px] text-fg-faint">
        {relativeTime(row.lastActivity)}
      </div>
    </Link>
  );
}
