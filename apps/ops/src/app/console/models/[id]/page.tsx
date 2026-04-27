import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@xcrm/db';
import {
  Button,
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
  type Hue,
} from '@xcrm/ui';
import { ACCOUNT_STATUS_HUE } from '@/lib/status-hues';
import { relativeTime } from '@/lib/relative-time';
import { isGenerationEligible } from '@/lib/confidence-routing';
import {
  getActiveNotes,
  filterNotesForModel,
} from '@/app/console/_loaders/active-notes';
import { getScheduledPostsForModel } from '@/app/console/_loaders/scheduled-posts';
import { getCampsForAccount } from '@/app/console/_loaders/camps';
import { NoteListItem } from '@/app/console/_components/note-list-item';
import { ContentSourcesCard } from './_components/content-sources-card';
import { RemoveAccountButton } from './_components/remove-account-button';
import { RemoveModelCard } from './_components/remove-model-card';
import { AnchorNav, type AnchorItem } from './_components/anchor-nav';
import { SectionBlock } from './_components/section-block';
import { GenerateDraftButton } from './_components/generate-draft-button';

const ANCHOR_ITEMS: AnchorItem[] = [
  { id: 'overview', label: 'Overview', hint: 'identity + accounts' },
  { id: 'content', label: 'Content', hint: 'drive sources + library' },
  { id: 'scheduled', label: 'Scheduled', hint: 'posts (Build D)' },
  { id: 'notes', label: 'Context notes', hint: 'active steering (Build C)' },
  { id: 'settings', label: 'Settings' },
  { id: 'audit', label: 'Audit' },
];

const AUDIT_HUE: Record<string, Hue> = {
  STATUS_TRANSITION: 25,
  ASSET_DELETE: 25,
  ASSET_RESTORE: 135,
  ASSET_MANUAL_TAG_EDIT: 210,
  ASSET_REVIEW_OVERRIDE: 320,
  SYNC_SUCCEEDED: 135,
  SYNC_FAILED: 25,
};

type AuditEntry = {
  key: string;
  kind: string;
  label: string;
  occurredAt: Date;
  actor: string | null;
  detail: string;
};

export default async function ModelDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const model = await prisma.model.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      agency: { select: { id: true, name: true, slug: true } },
      accounts: {
        where: { deletedAt: null },
        orderBy: { handle: 'asc' },
        include: {
          phoneDevice: { select: { label: true } },
          statusTransitions: {
            orderBy: { occurredAt: 'desc' },
            take: 10,
            include: {
              actor: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      driveSources: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          folderName: true,
          status: true,
          syncs: {
            orderBy: { startedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              status: true,
              finishedAt: true,
              startedAt: true,
              filesIngested: true,
              error: true,
            },
          },
        },
      },
      contentAssets: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          type: true,
          tagStatus: true,
        },
      },
      _count: { select: { contentAssets: { where: { deletedAt: null } } } },
    },
  });
  if (!model) notFound();

  const [activeNotes, scheduledPosts, perAccountCamps] = await Promise.all([
    getActiveNotes(),
    getScheduledPostsForModel(model.id),
    Promise.all(
      model.accounts.map(async (a) =>
        [a.id, await getCampsForAccount(a.id)] as const,
      ),
    ),
  ]);
  const campsByAccount = new Map(perAccountCamps);
  const notesForModel = filterNotesForModel(activeNotes, {
    archetype: model.archetype,
    accountIds: model.accounts.map((a) => a.id),
  });

  const hardRules = Array.isArray(model.hardRules)
    ? (model.hardRules as string[])
    : [];
  const softPrefs = Array.isArray(model.softPreferences)
    ? (model.softPreferences as string[])
    : [];

  // Roll up audit events from StatusTransition + DriveSync across all
  // sources + accounts, newest first. AssetAuditEvent is scoped to
  // assets; pulling per-asset would be expensive and we already show
  // it on the asset detail page, so we omit it here intentionally and
  // link out to the library for that trail.
  const auditEntries: AuditEntry[] = [];
  for (const a of model.accounts) {
    for (const t of a.statusTransitions) {
      auditEntries.push({
        key: `st-${t.id}`,
        kind: 'STATUS_TRANSITION',
        label: `@${a.handle} ${t.fromStatus.toLowerCase()} → ${t.toStatus.toLowerCase()}`,
        occurredAt: t.occurredAt,
        actor: t.actor?.name ?? t.actor?.email ?? null,
        detail: t.reason ?? '',
      });
    }
  }
  for (const ds of model.driveSources) {
    for (const s of ds.syncs) {
      auditEntries.push({
        key: `sync-${s.id}`,
        kind: s.status === 'FAILED' ? 'SYNC_FAILED' : 'SYNC_SUCCEEDED',
        label: `${ds.folderName} · ${s.status.toLowerCase()}`,
        occurredAt: s.finishedAt ?? s.startedAt,
        actor: null,
        detail:
          s.status === 'FAILED'
            ? s.error ?? 'sync failed'
            : `${s.filesIngested} file${s.filesIngested === 1 ? '' : 's'} ingested`,
      });
    }
  }
  auditEntries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const recentAudit = auditEntries.slice(0, 20);

  return (
    <>
      <PageHeader
        kicker={`MODEL · ${model.agency.slug}`}
        title={model.displayName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Tag hue={OPS_HUES.models} size="sm">
              {model.archetype.toLowerCase().replace(/_/g, ' ')}
            </Tag>
            <span className="text-fg-muted">·</span>
            <Link
              href={`/console/agencies/${model.agency.id}`}
              className="text-fg-dim hover:text-fg"
            >
              {model.agency.name}
            </Link>
            <span className="text-fg-muted">·</span>
            <span>{model.accounts.length} accounts</span>
            <span className="text-fg-muted">·</span>
            <span>{model._count.contentAssets} assets</span>
          </span>
        }
        hue={OPS_HUES.models}
        icon="Md"
        actions={
          <Link href={`/console/accounts/new?modelId=${model.id}`}>
            <Button size="sm" hue={OPS_HUES.accounts}>
              Add account
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <AnchorNav items={ANCHOR_ITEMS} />

        <div className="flex flex-col gap-10">
          {/* --- Overview --------------------------------------------------- */}
          <SectionBlock
            id="overview"
            title="Overview"
            subtitle={`last activity ${relativeTime(model.updatedAt)}`}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card className="p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                  Voice / tone
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-dim">
                  {model.voiceToneNotes || (
                    <span className="text-fg-faint">—</span>
                  )}
                </p>
              </Card>
              <Card className="p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                  Hard rules
                </h3>
                {hardRules.length === 0 ? (
                  <p className="mt-2 text-[13px] text-fg-faint">—</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1 text-[13px] text-fg">
                    {hardRules.map((r) => (
                      <li key={r} className="flex items-start gap-2">
                        <span className="text-destructive">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                  Soft preferences
                </h3>
                {softPrefs.length === 0 ? (
                  <p className="mt-2 text-[13px] text-fg-faint">—</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1 text-[13px] text-fg-dim">
                    {softPrefs.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <span className="text-fg-muted">◦</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {model.accounts.length === 0 ? (
              <EmptyState
                hue={OPS_HUES.accounts}
                icon="Ac"
                title="No accounts for this model"
                description="Attach an X handle so content can flow."
                actions={
                  <Link href={`/console/accounts/new?modelId=${model.id}`}>
                    <Button size="sm" hue={OPS_HUES.accounts}>
                      Add account
                    </Button>
                  </Link>
                }
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Handle</TH>
                    <TH>Status</TH>
                    <TH>Device</TH>
                    <TH>Camps</TH>
                    <TH className="text-right tabular-nums">Followers</TH>
                    <TH className="w-24 text-right">&nbsp;</TH>
                  </TR>
                </THead>
                <TBody>
                  {model.accounts.map((a) => {
                    const camps = campsByAccount.get(a.id) ?? [];
                    return (
                      <TR key={a.id}>
                        <TD className="font-mono text-fg">@{a.handle}</TD>
                        <TD>
                          <Tag hue={ACCOUNT_STATUS_HUE[a.status]} size="sm">
                            {a.status.toLowerCase().replace(/_/g, ' ')}
                          </Tag>
                        </TD>
                        <TD className="text-fg-dim">
                          {a.phoneDevice ? (
                            a.phoneDevice.label
                          ) : (
                            <span className="text-fg-faint">—</span>
                          )}
                        </TD>
                        <TD>
                          {camps.length === 0 ? (
                            <span className="text-fg-faint">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {camps.map((c) => (
                                <Link
                                  key={c.campId}
                                  href={`/console/camps/${c.campId}`}
                                >
                                  <Tag hue={OPS_HUES.camps} size="sm">
                                    week of{' '}
                                    {c.weekOf.toISOString().slice(0, 10)}
                                  </Tag>
                                </Link>
                              ))}
                            </div>
                          )}
                        </TD>
                        <TD className="text-right tabular-nums">
                          {a.followerCount.toLocaleString()}
                        </TD>
                        <TD className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/console/accounts/${a.id}`}
                              className="text-[13px] text-fg-dim hover:text-fg"
                            >
                              Open →
                            </Link>
                            <RemoveAccountButton
                              accountId={a.id}
                              handle={a.handle}
                              modelId={model.id}
                            />
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </SectionBlock>

          {/* --- Content ---------------------------------------------------- */}
          <SectionBlock
            id="content"
            title="Content"
            subtitle={`${model._count.contentAssets} asset${model._count.contentAssets === 1 ? '' : 's'} in library`}
          >
            <ContentSourcesCard modelId={model.id} />

            {model._count.contentAssets > 0 ? (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                    Recent assets
                  </h3>
                  <Link
                    href={`/console/content?modelId=${model.id}`}
                    className="text-[12px] text-fg-dim hover:text-fg"
                  >
                    Browse library →
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
                  {model.contentAssets.map((a) => (
                    <Link
                      key={a.id}
                      href={`/console/content/${a.id}`}
                      className="group relative aspect-square overflow-hidden rounded-md border border-line bg-base"
                    >
                      {a.type === 'VIDEO' ? (
                        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-fg-faint">
                          video
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={`/api/drive/file/${a.id}`}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      )}
                    </Link>
                  ))}
                </div>
              </Card>
            ) : null}
          </SectionBlock>

          {/* --- Scheduled / pending posts --------------------------------- */}
          <SectionBlock
            id="scheduled"
            title="Scheduled & pending posts"
            subtitle={
              scheduledPosts.length > 0
                ? `${scheduledPosts.length} upcoming`
                : undefined
            }
          >
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                  Manual generation
                </span>
                {model.accounts.filter((a) =>
                  isGenerationEligible(a.status),
                ).length === 0 ? (
                  <span className="text-[12px] text-fg-faint">
                    No generation-eligible accounts. Move an account to
                    ACTIVE_RAMPING or later to enable.
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {model.accounts
                      .filter((a) => isGenerationEligible(a.status))
                      .map((a) => (
                        <GenerateDraftButton
                          key={a.id}
                          accountId={a.id}
                          handle={a.handle}
                        />
                      ))}
                  </div>
                )}
              </div>
            </Card>

            {scheduledPosts.length === 0 ? (
              <Card className="p-5">
                <p className="text-[13px] leading-relaxed text-fg-dim">
                  No drafts yet. Run manual generation above, or wait
                  for the scheduled cron (default every 4h — gated by
                  <code className="ml-1 font-mono text-fg-dim">
                    GENERATE_ENABLED
                  </code>
                  ).
                </p>
              </Card>
            ) : (
              <Card className="p-4">
                <ul className="flex flex-col divide-y divide-line text-[13px]">
                  {scheduledPosts.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-fg">
                          @{p.accountHandle}
                        </span>
                        <Tag
                          hue={
                            p.status === 'PENDING_APPROVAL'
                              ? 60
                              : p.status === 'SCHEDULED'
                                ? 135
                                : null
                          }
                          size="sm"
                        >
                          {p.status.toLowerCase().replace(/_/g, ' ')}
                        </Tag>
                        {p.confidenceScore !== null ? (
                          <Tag hue={OPS_HUES.formula} size="sm">
                            conf {(p.confidenceScore * 100).toFixed(0)}%
                          </Tag>
                        ) : null}
                        {p.scheduledFor ? (
                          <span className="text-[12px] text-fg-dim">
                            for {p.scheduledFor.toISOString().slice(0, 16).replace('T', ' ')} UTC
                          </span>
                        ) : null}
                        {p.status === 'PENDING_APPROVAL' ? (
                          <Link
                            href={`/console/review#post-${p.id}`}
                            className="text-[11px] font-medium text-fg-dim hover:text-fg"
                          >
                            review →
                          </Link>
                        ) : null}
                        <span className="ml-auto text-[11px] text-fg-faint">
                          {relativeTime(p.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-fg">
                        {p.copy}
                      </p>
                      {p.reasoning ? (
                        <p className="text-[11px] leading-relaxed text-fg-faint">
                          {p.reasoning}
                        </p>
                      ) : null}
                      {p.assetId ? (
                        <Link
                          href={`/console/content/${p.assetId}`}
                          className="text-[11px] text-fg-dim hover:text-fg"
                        >
                          view asset →
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </SectionBlock>

          {/* --- Context notes --------------------------------------------- */}
          <SectionBlock
            id="notes"
            title="Context notes"
            subtitle={
              notesForModel.length > 0
                ? `${notesForModel.length} affecting this model`
                : undefined
            }
          >
            {notesForModel.length === 0 ? (
              <Card className="p-5">
                <p className="text-[13px] leading-relaxed text-fg-dim">
                  No active notes apply to this model. Press{' '}
                  <kbd className="rounded border border-line bg-surface/40 px-1 font-mono text-[11px] text-fg-dim">
                    N
                  </kbd>{' '}
                  to create one — scope it to this archetype or these
                  accounts and it lands here.
                </p>
              </Card>
            ) : (
              <ul className="flex flex-col gap-2">
                {notesForModel.map((n) => (
                  <NoteListItem key={n.id} note={n} />
                ))}
              </ul>
            )}
          </SectionBlock>

          {/* --- Settings --------------------------------------------------- */}
          <SectionBlock id="settings" title="Settings">
            <Card className="p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                Editable fields
              </h3>
              <p className="mt-2 text-[13px] text-fg-dim">
                Voice/tone, archetype, hard rules and soft preferences are
                currently read-only. Edits land in a follow-up build — for
                now, remove &amp; re-onboard if you need to change them.
              </p>
            </Card>

            <RemoveModelCard
              modelId={model.id}
              displayName={model.displayName}
            />
          </SectionBlock>

          {/* --- Audit ------------------------------------------------------ */}
          <SectionBlock
            id="audit"
            title="Audit"
            subtitle={
              recentAudit.length > 0
                ? `last ${recentAudit.length}`
                : undefined
            }
          >
            {recentAudit.length === 0 ? (
              <Card className="p-5">
                <p className="text-[13px] text-fg-faint">
                  No audit events yet. Account status changes and Drive sync
                  results surface here as they happen.
                </p>
              </Card>
            ) : (
              <Card className="p-4">
                <ul className="flex flex-col divide-y divide-line text-[13px]">
                  {recentAudit.map((e) => (
                    <li key={e.key} className="flex flex-wrap items-center gap-2 py-2">
                      <Tag hue={AUDIT_HUE[e.kind] ?? null} size="sm">
                        {e.kind.toLowerCase().replace(/_/g, ' ')}
                      </Tag>
                      <span className="text-fg">{e.label}</span>
                      {e.detail ? (
                        <span className="text-fg-dim">· {e.detail}</span>
                      ) : null}
                      {e.actor ? (
                        <span className="text-fg-faint">· by {e.actor}</span>
                      ) : null}
                      <span className="ml-auto text-fg-faint">
                        {relativeTime(e.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </SectionBlock>
        </div>
      </div>
    </>
  );
}
