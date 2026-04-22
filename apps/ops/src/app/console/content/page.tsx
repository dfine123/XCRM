import Link from 'next/link';
import {
  prisma,
  AssetType,
  AssetTagStatus,
  type Prisma,
} from '@xcrm/db';
import { Button, EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';
import { ThumbnailCard } from './_components/thumbnail-card';

function parseType(raw: string | string[] | undefined): AssetType | undefined {
  if (typeof raw !== 'string') return undefined;
  return (Object.values(AssetType) as string[]).includes(raw)
    ? (raw as AssetType)
    : undefined;
}

function parseTagStatus(raw: string | string[] | undefined): AssetTagStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  return (Object.values(AssetTagStatus) as string[]).includes(raw)
    ? (raw as AssetTagStatus)
    : undefined;
}

function parseHidePosted(raw: string | string[] | undefined): boolean {
  if (typeof raw !== 'string') return true;
  return raw !== '0' && raw !== 'false';
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams?: {
    modelId?: string;
    type?: string;
    tagStatus?: string;
    hidePosted?: string;
  };
}) {
  const modelId =
    typeof searchParams?.modelId === 'string' && searchParams.modelId
      ? searchParams.modelId
      : undefined;
  const type = parseType(searchParams?.type);
  const tagStatus = parseTagStatus(searchParams?.tagStatus);
  const hidePosted = parseHidePosted(searchParams?.hidePosted);

  const where: Prisma.ContentAssetWhereInput = {
    deletedAt: null,
    ...(modelId ? { modelId } : {}),
    ...(type ? { type } : {}),
    ...(tagStatus ? { tagStatus } : {}),
    ...(hidePosted ? { usages: { none: {} } } : {}),
  };

  const [models, assets] = await Promise.all([
    prisma.model.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        displayName: true,
        agency: { select: { name: true } },
      },
      orderBy: [{ agency: { name: 'asc' } }, { displayName: 'asc' }],
    }),
    prisma.contentAsset.findMany({
      where,
      select: {
        id: true,
        type: true,
        tagStatus: true,
        autoTags: true,
        manualTags: true,
        useCount: true,
      },
      orderBy: [{ uploadedAt: 'desc' }],
      take: 120,
    }),
  ]);

  const filtersActive = !!(modelId || type || tagStatus || !hidePosted);

  return (
    <>
      <PageHeader
        kicker="CONTENT"
        title="Content"
        subtitle="Per-model library, auto-tagged on ingest. Hide-posted is on by default."
        hue={OPS_HUES.content}
        icon="Co"
      />

      <form className="mb-4 flex flex-wrap items-center gap-3 text-[13px]">
        <label className="text-fg-muted">Model</label>
        <select
          name="modelId"
          defaultValue={modelId ?? ''}
          className="h-8 rounded-md border border-line bg-base px-2 text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.agency.name} — {m.displayName}
            </option>
          ))}
        </select>

        <label className="text-fg-muted">Type</label>
        <select
          name="type"
          defaultValue={type ?? ''}
          className="h-8 rounded-md border border-line bg-base px-2 text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All</option>
          {Object.values(AssetType).map((t) => (
            <option key={t} value={t}>
              {t.toLowerCase()}
            </option>
          ))}
        </select>

        <label className="text-fg-muted">Tag</label>
        <select
          name="tagStatus"
          defaultValue={tagStatus ?? ''}
          className="h-8 rounded-md border border-line bg-base px-2 text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All</option>
          {Object.values(AssetTagStatus).map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1.5 text-fg-muted">
          <input
            type="checkbox"
            name="hidePosted"
            value="1"
            defaultChecked={hidePosted}
            className="h-3.5 w-3.5 rounded border-line"
          />
          Hide already-posted
        </label>

        <Button type="submit" size="sm" variant="ghost">
          Filter
        </Button>
        {filtersActive ? (
          <Link href="/console/content" className="text-[12px] text-fg-muted hover:text-fg">
            Clear
          </Link>
        ) : null}
      </form>

      {assets.length === 0 ? (
        <EmptyState
          hue={OPS_HUES.content}
          icon="Co"
          title={filtersActive ? 'No assets match this filter' : 'Library is empty'}
          description={
            filtersActive
              ? 'Try loosening the filters or showing already-posted assets.'
              : 'Connect a Drive folder on a model to start ingesting assets.'
          }
          actions={
            <Link href="/console/models">
              <Button size="sm" hue={OPS_HUES.models}>
                Browse models
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((a) => (
            <ThumbnailCard key={a.id} asset={a} />
          ))}
        </div>
      )}
    </>
  );
}
