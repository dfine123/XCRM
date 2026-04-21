import Link from 'next/link';
import { prisma } from '@xcrm/db';
import {
  Button,
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
import { AGENCY_STATUS_HUE } from '@/lib/status-hues';

export default async function AgenciesPage() {
  const agencies = await prisma.agency.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { models: true } } },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeader
        kicker="AGENCIES"
        title="Agencies"
        subtitle="Prospect → active → paused → churned. Partner accounts and models live under each agency."
        hue={OPS_HUES.agencies}
        icon="Ag"
        actions={
          <Link href="/console/agencies/new">
            <Button size="sm" hue={OPS_HUES.agencies}>
              New agency
            </Button>
          </Link>
        }
      />

      {agencies.length === 0 ? (
        <EmptyState
          hue={OPS_HUES.agencies}
          icon="Ag"
          title="No agencies yet"
          description="Create an agency to start onboarding models and accounts."
          actions={
            <Link href="/console/agencies/new">
              <Button size="sm" hue={OPS_HUES.agencies}>
                New agency
              </Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Slug</TH>
              <TH>Name</TH>
              <TH>Status</TH>
              <TH className="text-right tabular-nums">Models</TH>
              <TH>Created</TH>
              <TH className="w-24 text-right">&nbsp;</TH>
            </TR>
          </THead>
          <TBody>
            {agencies.map((a) => (
              <TR key={a.id}>
                <TD>
                  <code className="rounded bg-base px-1.5 py-0.5 text-[12px] text-fg-dim">
                    {a.slug}
                  </code>
                </TD>
                <TD className="font-medium">{a.name}</TD>
                <TD>
                  <Tag hue={AGENCY_STATUS_HUE[a.status]} size="sm">
                    {a.status.toLowerCase()}
                  </Tag>
                </TD>
                <TD className="text-right tabular-nums">{a._count.models}</TD>
                <TD className="text-fg-muted">{a.createdAt.toISOString().slice(0, 10)}</TD>
                <TD className="text-right">
                  <Link
                    href={`/console/agencies/${a.id}`}
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
    </>
  );
}
