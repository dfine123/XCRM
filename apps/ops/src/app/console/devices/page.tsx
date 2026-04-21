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
import { PHONE_STATUS_HUE } from '@/lib/status-hues';

export default async function DevicesPage() {
  const devices = await prisma.phoneDevice.findMany({
    include: { _count: { select: { accounts: true } } },
    orderBy: { label: 'asc' },
  });

  return (
    <>
      <PageHeader
        kicker="DEVICES"
        title="Phone devices"
        subtitle="Physical phone farm. Each account binds to one device — the VA switches devices as rarely as possible."
        hue={OPS_HUES.devices}
        icon="Dv"
        actions={
          <Link href="/console/devices/new">
            <Button size="sm" hue={OPS_HUES.devices}>
              New device
            </Button>
          </Link>
        }
      />

      {devices.length === 0 ? (
        <EmptyState
          hue={OPS_HUES.devices}
          icon="Dv"
          title="No devices registered"
          description="Register a phone to bind it to accounts."
          actions={
            <Link href="/console/devices/new">
              <Button size="sm" hue={OPS_HUES.devices}>
                New device
              </Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Label</TH>
              <TH>Status</TH>
              <TH className="text-right tabular-nums">Accounts</TH>
              <TH>Added</TH>
              <TH className="w-24 text-right">&nbsp;</TH>
            </TR>
          </THead>
          <TBody>
            {devices.map((d) => (
              <TR key={d.id}>
                <TD className="font-medium">{d.label}</TD>
                <TD>
                  <Tag hue={PHONE_STATUS_HUE[d.status]} size="sm">
                    {d.status.toLowerCase()}
                  </Tag>
                </TD>
                <TD className="text-right tabular-nums">{d._count.accounts}</TD>
                <TD className="text-fg-muted">{d.createdAt.toISOString().slice(0, 10)}</TD>
                <TD className="text-right">
                  <Link
                    href={`/console/devices/${d.id}`}
                    className="text-[13px] text-fg-dim hover:text-fg"
                  >
                    Edit →
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
