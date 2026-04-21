import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma, Archetype } from '@xcrm/db';
import { PageHeader, OPS_HUES } from '@xcrm/ui';
import { NewModelForm } from './new-model-form';

export default async function NewModelPage({
  searchParams,
}: {
  searchParams: { agencyId?: string };
}) {
  const agencies = await prisma.agency.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
  if (agencies.length === 0) notFound();

  return (
    <>
      <PageHeader
        kicker="MODELS · NEW"
        title="New model"
        subtitle="Display name is what we use everywhere. Real name stays internal. Hard rules are absolute."
        hue={OPS_HUES.models}
        icon="Md"
        actions={
          <Link
            href="/console/models"
            className="text-[13px] text-fg-dim hover:text-fg"
          >
            ← Back to models
          </Link>
        }
      />
      <NewModelForm
        agencies={agencies}
        defaultAgencyId={searchParams.agencyId}
        archetypes={Object.values(Archetype)}
      />
    </>
  );
}
