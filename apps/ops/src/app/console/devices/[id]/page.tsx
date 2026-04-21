import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma, PhoneDeviceStatus } from '@xcrm/db';
import {
  Button,
  Field,
  Input,
  OPS_HUES,
  PageHeader,
  Select,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@xcrm/ui';
import { ACCOUNT_STATUS_HUE } from '@/lib/status-hues';
import { Tag } from '@xcrm/ui';
import { updateDevice } from '../actions';

export default async function EditDevicePage({ params }: { params: { id: string } }) {
  const device = await prisma.phoneDevice.findUnique({
    where: { id: params.id },
    include: {
      accounts: {
        where: { deletedAt: null },
        include: { model: { select: { id: true, displayName: true } } },
        orderBy: { handle: 'asc' },
      },
    },
  });
  if (!device) notFound();

  return (
    <>
      <PageHeader
        kicker="DEVICES · EDIT"
        title={device.label}
        hue={OPS_HUES.devices}
        icon="Dv"
        actions={
          <Link href="/console/devices" className="text-[13px] text-fg-dim hover:text-fg">
            ← Back
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
        <form action={updateDevice} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={device.id} />
          <Field label="Label">
            <Input name="label" required maxLength={40} defaultValue={device.label} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={device.status}>
              {Object.values(PhoneDeviceStatus).map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <Button type="submit" size="sm" hue={OPS_HUES.devices}>
              Save changes
            </Button>
          </div>
        </form>

        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
            Bound accounts ({device.accounts.length})
          </h2>
          {device.accounts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface/40 p-5 text-[13px] text-fg-muted">
              No accounts currently bound to this device.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Handle</TH>
                  <TH>Model</TH>
                  <TH>Status</TH>
                  <TH className="w-20 text-right">&nbsp;</TH>
                </TR>
              </THead>
              <TBody>
                {device.accounts.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-mono text-fg">@{a.handle}</TD>
                    <TD>
                      <Link
                        href={`/console/models/${a.model.id}`}
                        className="text-fg-dim hover:text-fg"
                      >
                        {a.model.displayName}
                      </Link>
                    </TD>
                    <TD>
                      <Tag hue={ACCOUNT_STATUS_HUE[a.status]} size="sm">
                        {a.status.toLowerCase().replace(/_/g, ' ')}
                      </Tag>
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
        </section>
      </div>
    </>
  );
}
