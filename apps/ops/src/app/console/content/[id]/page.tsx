import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@xcrm/db';
import {
  Card,
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
import { relativeTime } from '@/lib/relative-time';
import { computeNoveltyScore } from '@/lib/asset-novelty';
import { ManualTagsForm } from './_components/manual-tags-form';
import { DeleteAssetForm } from './_components/delete-asset-form';

type AutoTags = Partial<{
  setting: string;
  outfit: string;
  pose: string;
  aesthetic: string;
  nsfwRating: string;
  mood: string;
  lighting: string;
  colorPalette: string[];
  dominantSubject: string;
  composition: string;
  textInImage: string | null;
  faceCount: number;
  caption: string;
}>;

const STATUS_HUE: Record<'PENDING' | 'TAGGED' | 'FAILED', Hue> = {
  PENDING: 60,
  TAGGED: 135,
  FAILED: 25,
};

const AUDIT_HUE: Record<string, Hue> = {
  DELETE: 25,
  RESTORE: 135,
  MANUAL_TAG_EDIT: 210,
  REVIEW_OVERRIDE: 320,
};

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const asset = await prisma.contentAsset.findUnique({
    where: { id: params.id },
    include: {
      model: {
        select: {
          id: true,
          displayName: true,
          agency: { select: { id: true, name: true, slug: true } },
        },
      },
      driveSource: { select: { id: true, folderName: true, folderId: true } },
      usages: {
        orderBy: { usedAt: 'desc' },
        take: 20,
        include: {
          account: { select: { id: true, handle: true } },
          post: { select: { id: true, status: true } },
        },
      },
      auditEvents: {
        orderBy: { occurredAt: 'desc' },
        take: 30,
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!asset) notFound();

  const autoTags = (asset.autoTags ?? {}) as AutoTags;
  // Always go through our proxy — the stored Drive URLs are gated by
  // the service account's Google session and won't load in the
  // operator's browser. See /api/drive/file/[id].
  const src = `/api/drive/file/${asset.id}`;
  const isDeleted = asset.deletedAt !== null;
  const novelty = computeNoveltyScore({
    useCount: asset.useCount,
    lastUsedAt: asset.lastUsedAt,
  });
  const noveltyHue: Hue = novelty > 0.7 ? 135 : novelty > 0.3 ? 60 : 25;
  const colorPalette = Array.isArray(autoTags.colorPalette)
    ? autoTags.colorPalette.filter((c): c is string => typeof c === 'string')
    : [];

  return (
    <>
      <PageHeader
        kicker={`ASSET · ${asset.model.agency.slug}`}
        title={asset.type.toLowerCase()}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href={`/console/models/${asset.model.id}`}
              className="text-fg-dim hover:text-fg"
            >
              {asset.model.displayName}
            </Link>
            <span className="text-fg-muted">·</span>
            <Tag hue={STATUS_HUE[asset.tagStatus]} size="sm">
              {asset.tagStatus.toLowerCase()}
            </Tag>
            {isDeleted ? (
              <>
                <span className="text-fg-muted">·</span>
                <Tag hue={25} size="sm">
                  deleted
                </Tag>
              </>
            ) : null}
            <span className="text-fg-muted">·</span>
            <span>used {asset.useCount}x</span>
          </span>
        }
        hue={OPS_HUES.content}
        icon="Co"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col gap-4">
          <Card className="overflow-hidden p-0">
            <div className="relative aspect-video w-full bg-base">
              {asset.type === 'VIDEO' ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={src}
                  controls
                  className="h-full w-full object-contain"
                />
              ) : src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[12px] uppercase tracking-[0.2em] text-fg-faint">
                  no preview
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Usage history
            </h3>
            {asset.usages.length === 0 ? (
              <p className="mt-3 text-[13px] text-fg-faint">Never posted.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>When</TH>
                    <TH>Account</TH>
                    <TH>Post</TH>
                  </TR>
                </THead>
                <TBody>
                  {asset.usages.map((u) => (
                    <TR key={u.id}>
                      <TD className="text-fg-dim">{relativeTime(u.usedAt)}</TD>
                      <TD className="font-mono text-fg">@{u.account.handle}</TD>
                      <TD className="text-fg-dim">
                        {u.post ? (
                          <Tag hue={null} size="sm">
                            {u.post.status.toLowerCase()}
                          </Tag>
                        ) : (
                          <span className="text-fg-faint">—</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Audit trail
            </h3>
            {asset.auditEvents.length === 0 ? (
              <p className="mt-3 text-[13px] text-fg-faint">No edits yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2.5 text-[13px]">
                {asset.auditEvents.map((e) => (
                  <li key={e.id} className="flex items-start gap-2.5">
                    <Tag hue={AUDIT_HUE[e.kind] ?? null} size="sm">
                      {e.kind.toLowerCase().replace(/_/g, ' ')}
                    </Tag>
                    <span className="text-fg-dim">
                      {e.actor?.name || e.actor?.email || 'unknown'}
                    </span>
                    <span className="text-fg-faint">· {relativeTime(e.occurredAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <aside className="flex flex-col gap-4">
          {autoTags.caption ? (
            <Card className="p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                Caption
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-fg">
                {autoTags.caption}
              </p>
            </Card>
          ) : null}

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Signals
            </h3>
            <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
              <dt className="text-fg-muted">Novelty</dt>
              <dd className="flex items-center gap-2">
                <Tag hue={noveltyHue} size="sm">
                  {novelty.toFixed(2)}
                </Tag>
                <span className="text-[12px] text-fg-dim">
                  {asset.useCount === 0
                    ? 'never posted'
                    : `${asset.useCount}× posted, last ${asset.lastUsedAt ? relativeTime(asset.lastUsedAt) : '—'}`}
                </span>
              </dd>
              {typeof autoTags.faceCount === 'number' ? (
                <>
                  <dt className="text-fg-muted">Faces</dt>
                  <dd className="text-fg">{autoTags.faceCount}</dd>
                </>
              ) : null}
              {autoTags.textInImage ? (
                <>
                  <dt className="text-fg-muted">Text</dt>
                  <dd className="whitespace-pre-wrap text-fg">
                    &quot;{autoTags.textInImage}&quot;
                  </dd>
                </>
              ) : null}
            </dl>
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Auto-tags
            </h3>
            {Object.keys(autoTags).length === 0 ? (
              <p className="mt-3 text-[13px] text-fg-faint">
                {asset.tagStatus === 'PENDING'
                  ? 'Tagging in progress.'
                  : asset.tagStatus === 'FAILED'
                    ? 'Tagging failed — retry via re-sync.'
                    : '—'}
              </p>
            ) : (
              <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
                {(
                  [
                    'setting',
                    'outfit',
                    'pose',
                    'aesthetic',
                    'mood',
                    'lighting',
                    'dominantSubject',
                    'composition',
                    'nsfwRating',
                  ] as const
                ).map((k) => {
                  const v = autoTags[k];
                  if (typeof v !== 'string' || !v) return null;
                  const label =
                    k === 'nsfwRating'
                      ? 'NSFW'
                      : k === 'dominantSubject'
                        ? 'Subject'
                        : k;
                  return (
                    <Fragment key={k}>
                      <dt className="text-fg-muted capitalize">{label}</dt>
                      <dd className="text-fg">{v}</dd>
                    </Fragment>
                  );
                })}
                {colorPalette.length > 0 ? (
                  <>
                    <dt className="text-fg-muted">Colors</dt>
                    <dd className="flex flex-wrap gap-1">
                      {colorPalette.map((c) => (
                        <Tag key={c} hue={null} size="sm">
                          {c}
                        </Tag>
                      ))}
                    </dd>
                  </>
                ) : null}
              </dl>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Manual tags
            </h3>
            <div className="mt-3">
              {!isDeleted ? (
                <ManualTagsForm assetId={asset.id} currentTags={asset.manualTags} />
              ) : (
                <p className="text-[13px] text-fg-faint">Restore to edit tags.</p>
              )}
              {asset.manualTags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {asset.manualTags.map((t) => (
                    <Tag key={t} hue={OPS_HUES.content} size="sm">
                      {t}
                    </Tag>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          {asset.driveSource ? (
            <Card className="p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                Source
              </h3>
              <dl className="mt-3 grid grid-cols-[90px_1fr] gap-y-2 text-[13px]">
                <dt className="text-fg-muted">Folder</dt>
                <dd className="text-fg">{asset.driveSource.folderName}</dd>
                <dt className="text-fg-muted">File ID</dt>
                <dd className="font-mono text-[11px] text-fg-dim">{asset.driveFileId}</dd>
              </dl>
            </Card>
          ) : null}

          <Card className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
              Danger zone
            </h3>
            <div className="mt-3">
              <DeleteAssetForm assetId={asset.id} isDeleted={isDeleted} />
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
