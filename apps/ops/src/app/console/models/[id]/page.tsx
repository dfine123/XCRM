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
} from '@xcrm/ui';
import { ACCOUNT_STATUS_HUE } from '@/lib/status-hues';

export default async function ModelDetailPage({ params }: { params: { id: string } }) {
  const model = await prisma.model.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      agency: { select: { id: true, name: true, slug: true } },
      accounts: {
        where: { deletedAt: null },
        include: { phoneDevice: { select: { label: true } } },
        orderBy: { handle: 'asc' },
      },
      _count: { select: { contentAssets: true } },
    },
  });
  if (!model) notFound();

  const hardRules = Array.isArray(model.hardRules) ? (model.hardRules as string[]) : [];
  const softPrefs = Array.isArray(model.softPreferences)
    ? (model.softPreferences as string[])
    : [];

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
            Accounts
          </h2>
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
                  <TH className="text-right tabular-nums">Followers</TH>
                  <TH className="w-24 text-right">&nbsp;</TH>
                </TR>
              </THead>
              <TBody>
                {model.accounts.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-mono text-fg">@{a.handle}</TD>
                    <TD>
                      <Tag hue={ACCOUNT_STATUS_HUE[a.status]} size="sm">
                        {a.status.toLowerCase().replace(/_/g, ' ')}
                      </Tag>
                    </TD>
                    <TD className="text-fg-dim">
                      {a.phoneDevice ? a.phoneDevice.label : <span className="text-fg-faint">—</span>}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {a.followerCount.toLocaleString()}
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={`/console/accounts/${a.id}`}
                        className="text-[13px] text-fg-dim hover:text-fg"
                      >
                        Open →
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          <div className="mt-4 rounded-lg border border-dashed border-line bg-surface/40 p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Content Sources
            </h3>
            <p className="mt-2 text-sm text-fg-dim">
              Drive folder ingest lands in feature 2. Connect a folder to start auto-tagging assets
              for this model.
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Voice / tone
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-dim">
              {model.voiceToneNotes || <span className="text-fg-faint">—</span>}
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Hard rules
            </h3>
            {hardRules.length === 0 ? (
              <p className="mt-3 text-[13px] text-fg-faint">—</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5 text-[13px] text-fg">
                {hardRules.map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Soft preferences
            </h3>
            {softPrefs.length === 0 ? (
              <p className="mt-3 text-[13px] text-fg-faint">—</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5 text-[13px] text-fg-dim">
                {softPrefs.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span className="text-fg-muted">◦</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
