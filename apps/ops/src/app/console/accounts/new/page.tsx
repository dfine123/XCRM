import Link from 'next/link';
import { prisma, AccountStatus } from '@xcrm/db';
import { Button, OPS_HUES, PageHeader } from '@xcrm/ui';
import { NewAccountForm } from './new-account-form';

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams?: { modelId?: string };
}) {
  const [models, devices] = await Promise.all([
    prisma.model.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        displayName: true,
        agency: { select: { name: true } },
      },
      orderBy: [{ agency: { name: 'asc' } }, { displayName: 'asc' }],
    }),
    prisma.phoneDevice.findMany({
      select: { id: true, label: true, status: true },
      orderBy: { label: 'asc' },
    }),
  ]);

  if (models.length === 0) {
    return (
      <>
        <PageHeader
          kicker="ACCOUNTS · NEW"
          title="New account"
          hue={OPS_HUES.accounts}
          icon="Ac"
        />
        <div className="rounded-lg border border-dashed border-line bg-surface/40 p-6 text-[13px] text-fg-dim">
          You need a model before you can create an account.{' '}
          <Link href="/console/models/new" className="underline hover:text-fg">
            Create a model →
          </Link>
        </div>
      </>
    );
  }

  if (devices.length === 0) {
    return (
      <>
        <PageHeader
          kicker="ACCOUNTS · NEW"
          title="New account"
          hue={OPS_HUES.accounts}
          icon="Ac"
        />
        <div className="rounded-lg border border-dashed border-line bg-surface/40 p-6 text-[13px] text-fg-dim">
          Every account binds to a phone device.{' '}
          <Link href="/console/devices/new" className="underline hover:text-fg">
            Register a device →
          </Link>
        </div>
      </>
    );
  }

  const firstModel = models[0]!;
  const defaultModelId =
    searchParams?.modelId && models.some((m) => m.id === searchParams.modelId)
      ? searchParams.modelId
      : firstModel.id;

  return (
    <>
      <PageHeader
        kicker="ACCOUNTS · NEW"
        title="New account"
        subtitle="The handle is permanent. Device binding is required — the VA always knows which phone to grab."
        hue={OPS_HUES.accounts}
        icon="Ac"
        actions={
          <Link href="/console/accounts">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>
        }
      />
      <NewAccountForm
        models={models.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          agencyName: m.agency.name,
        }))}
        devices={devices}
        statuses={Object.values(AccountStatus)}
        defaultModelId={defaultModelId}
      />
    </>
  );
}

