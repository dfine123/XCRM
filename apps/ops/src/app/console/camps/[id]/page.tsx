import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Card,
  EmptyState,
  OPS_HUES,
  PageHeader,
  Tag,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@xcrm/ui';
import { ACCOUNT_STATUS_HUE } from '@/lib/status-hues';
import { requireUser } from '@/lib/session';
import { relativeTime } from '@/lib/relative-time';
import type { AccountStatus } from '@xcrm/db';
import { getCampDetail } from '../../_loaders/camps';
import { LifecycleButtons } from '../_components/lifecycle-buttons';
import { AddAccountForm } from '../_components/add-account-form';
import { RemoveMemberButton } from '../_components/remove-member-button';

const STATUS_HUE: Record<'PROPOSED' | 'ACTIVE' | 'COMPLETED', number | null> = {
  ACTIVE: 135,
  PROPOSED: 60,
  COMPLETED: null,
};

export default async function CampDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const camp = await getCampDetail(params.id);
  if (!camp) notFound();

  // Soft warning when members span more than one model — asset
  // libraries don't overlap so spacing is moot for cross-model
  // memberships.
  const distinctModelIds = new Set(camp.members.map((m) => m.modelId));
  const crossModel = distinctModelIds.size > 1;

  return (
    <>
      <PageHeader
        kicker={`CAMP · ${camp.weekOf.toISOString().slice(0, 10)}`}
        title={`Week of ${camp.weekOf.toISOString().slice(0, 10)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Tag hue={STATUS_HUE[camp.status]} size="sm">
              {camp.status.toLowerCase()}
            </Tag>
            <span className="text-fg-muted">·</span>
            <span>
              {camp.members.length} member
              {camp.members.length === 1 ? '' : 's'}
            </span>
            {camp.approvedByName ? (
              <>
                <span className="text-fg-muted">·</span>
                <span>
                  approved by {camp.approvedByName} {relativeTime(camp.approvedAt)}
                </span>
              </>
            ) : null}
          </span>
        }
        hue={OPS_HUES.camps}
        icon="Ca"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/console/camps"
              className="text-[13px] text-fg-dim hover:text-fg"
            >
              ← Back
            </Link>
            <LifecycleButtons campId={camp.id} status={camp.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
            Members
          </h2>
          {crossModel ? (
            <Card className="border-amber-400/30 bg-amber-400/5 p-3 text-[12px] text-fg-dim">
              Heads up — members span multiple models, so they don&apos;t share a
              content library. Asset spacing only applies within a model.
            </Card>
          ) : null}
          {camp.members.length === 0 ? (
            <EmptyState
              hue={OPS_HUES.camps}
              icon="Ca"
              title="No members yet"
              description="Add accounts in the right rail. Camps with at least one member can be Activated."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Handle</TH>
                  <TH>Model</TH>
                  <TH>Status</TH>
                  <TH className="w-24 text-right">&nbsp;</TH>
                </TR>
              </THead>
              <TBody>
                {camp.members.map((m) => (
                  <TR key={m.membershipId}>
                    <TD className="font-mono text-fg">@{m.handle}</TD>
                    <TD>
                      <Link
                        href={`/console/models/${m.modelId}`}
                        className="text-fg-dim hover:text-fg"
                      >
                        {m.modelDisplayName}
                      </Link>{' '}
                      <span className="text-fg-faint">({m.agencySlug})</span>
                    </TD>
                    <TD>
                      <Tag
                        hue={ACCOUNT_STATUS_HUE[m.accountStatus as AccountStatus]}
                        size="sm"
                      >
                        {m.accountStatus.toLowerCase().replace(/_/g, ' ')}
                      </Tag>
                    </TD>
                    <TD className="text-right">
                      <RemoveMemberButton
                        membershipId={m.membershipId}
                        handle={m.handle}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Add account
            </h3>
            <p className="mt-2 text-[12px] text-fg-faint">
              By handle. Resolved server-side; soft-deleted accounts are
              rejected.
            </p>
            <div className="mt-3">
              <AddAccountForm campId={camp.id} />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Spacing
            </h3>
            <p className="mt-2 text-[12px] leading-relaxed text-fg-dim">
              When ACTIVE, the generator excludes any asset already
              scheduled or posted on a camp-mate within ±72 hours. Stops
              the same photo from going up across multiple accounts in
              the same window.
            </p>
            <p className="mt-2 text-[11px] text-fg-faint">
              {camp.status === 'ACTIVE'
                ? 'Spacing is in effect.'
                : camp.status === 'PROPOSED'
                  ? 'Spacing kicks in once you Activate.'
                  : 'Spacing no longer applies (camp completed).'}
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
