import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma, AgencyStatus } from '@xcrm/db';
import {
  Button,
  Card,
  EmptyState,
  OPS_HUES,
  PageHeader,
  Select,
  Tag,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@xcrm/ui';
import { AGENCY_STATUS_HUE } from '@/lib/status-hues';
import { updateAgencyStatus } from '../actions';

export default async function AgencyDetailPage({ params }: { params: { id: string } }) {
  const agency = await prisma.agency.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      models: {
        where: { deletedAt: null },
        include: { _count: { select: { accounts: true } } },
        orderBy: { displayName: 'asc' },
      },
      _count: { select: { agencyUsers: true } },
    },
  });
  if (!agency) notFound();

  return (
    <>
      <PageHeader
        kicker={`AGENCY · ${agency.slug}`}
        title={agency.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Tag hue={AGENCY_STATUS_HUE[agency.status]} size="sm">
              {agency.status.toLowerCase()}
            </Tag>
            <span className="text-fg-muted">·</span>
            <span>{agency.models.length} models</span>
            <span className="text-fg-muted">·</span>
            <span>{agency._count.agencyUsers} portal users</span>
          </span>
        }
        hue={OPS_HUES.agencies}
        icon="Ag"
        actions={
          <Link href={`/console/models/new?agencyId=${agency.id}`}>
            <Button size="sm" hue={OPS_HUES.models}>
              Add model
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
            Models
          </h2>
          {agency.models.length === 0 ? (
            <EmptyState
              hue={OPS_HUES.models}
              icon="Md"
              title="No models yet"
              description="Add a model to this agency to start ingesting content and handles."
              actions={
                <Link href={`/console/models/new?agencyId=${agency.id}`}>
                  <Button size="sm" hue={OPS_HUES.models}>
                    Add model
                  </Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Display name</TH>
                  <TH>Archetype</TH>
                  <TH className="text-right tabular-nums">Accounts</TH>
                  <TH className="w-24 text-right">&nbsp;</TH>
                </TR>
              </THead>
              <TBody>
                {agency.models.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-medium">{m.displayName}</TD>
                    <TD className="text-fg-dim">{m.archetype.toLowerCase().replace(/_/g, ' ')}</TD>
                    <TD className="text-right tabular-nums">{m._count.accounts}</TD>
                    <TD className="text-right">
                      <Link
                        href={`/console/models/${m.id}`}
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
        </section>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Status
            </h3>
            <form action={updateAgencyStatus} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="id" value={agency.id} />
              <Select name="status" defaultValue={agency.status}>
                {Object.values(AgencyStatus).map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </Select>
              <Button type="submit" size="sm" variant="outline">
                Save
              </Button>
            </form>
          </Card>

          <Card className="p-5 text-[13px] text-fg-dim">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Meta
            </h3>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-fg-muted">Slug</dt>
              <dd className="font-mono text-fg">{agency.slug}</dd>
              <dt className="text-fg-muted">Created</dt>
              <dd className="text-fg">{agency.createdAt.toISOString().slice(0, 10)}</dd>
              <dt className="text-fg-muted">Updated</dt>
              <dd className="text-fg">{agency.updatedAt.toISOString().slice(0, 10)}</dd>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}
