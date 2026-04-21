import Link from 'next/link';
import { prisma } from '@xcrm/db';
import {
  Button,
  EmptyState,
  OPS_HUES,
  PageHeader,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@xcrm/ui';

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: { agencyId?: string };
}) {
  const agencyFilter = searchParams.agencyId;
  const models = await prisma.model.findMany({
    where: {
      deletedAt: null,
      ...(agencyFilter ? { agencyId: agencyFilter } : {}),
    },
    include: {
      agency: { select: { id: true, name: true, slug: true } },
      _count: { select: { accounts: true, contentAssets: true } },
    },
    orderBy: { displayName: 'asc' },
  });

  const newHref = agencyFilter ? `/console/models/new?agencyId=${agencyFilter}` : '/console/models/new';

  return (
    <>
      <PageHeader
        kicker={agencyFilter ? 'MODELS · FILTERED' : 'MODELS'}
        title="Models"
        subtitle="Real names stay internal (§1.2). Archetype and voice notes feed generation; hard rules are never violated."
        hue={OPS_HUES.models}
        icon="Md"
        actions={
          <Link href={newHref}>
            <Button size="sm" hue={OPS_HUES.models}>
              New model
            </Button>
          </Link>
        }
      />

      {models.length === 0 ? (
        <EmptyState
          hue={OPS_HUES.models}
          icon="Md"
          title="No models yet"
          description="Add a model so content and accounts have something to attach to."
          actions={
            <Link href={newHref}>
              <Button size="sm" hue={OPS_HUES.models}>
                New model
              </Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Display name</TH>
              <TH>Agency</TH>
              <TH>Archetype</TH>
              <TH className="text-right tabular-nums">Accounts</TH>
              <TH className="text-right tabular-nums">Assets</TH>
              <TH className="w-24 text-right">&nbsp;</TH>
            </TR>
          </THead>
          <TBody>
            {models.map((m) => (
              <TR key={m.id}>
                <TD className="font-medium">{m.displayName}</TD>
                <TD>
                  <Link
                    href={`/console/agencies/${m.agency.id}`}
                    className="text-fg-dim hover:text-fg"
                  >
                    {m.agency.name}
                  </Link>
                </TD>
                <TD className="text-fg-dim">{m.archetype.toLowerCase().replace(/_/g, ' ')}</TD>
                <TD className="text-right tabular-nums">{m._count.accounts}</TD>
                <TD className="text-right tabular-nums">{m._count.contentAssets}</TD>
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
    </>
  );
}
