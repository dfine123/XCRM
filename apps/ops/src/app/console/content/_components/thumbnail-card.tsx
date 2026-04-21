import Link from 'next/link';
import { AssetType, AssetTagStatus } from '@xcrm/db';
import { Tag, type Hue } from '@xcrm/ui';

const TYPE_HUE: Record<AssetType, Hue> = {
  PHOTO: 135,
  VIDEO: 210,
  GIF: 320,
};

const STATUS_HUE: Record<AssetTagStatus, Hue> = {
  PENDING: 60,
  TAGGED: 135,
  FAILED: 25,
};

type AutoTags = Partial<
  Record<'setting' | 'outfit' | 'pose' | 'aesthetic' | 'nsfwRating', string>
>;

export function ThumbnailCard({
  asset,
}: {
  asset: {
    id: string;
    type: AssetType;
    tagStatus: AssetTagStatus;
    thumbnailUrl: string | null;
    storageUrl: string;
    autoTags: unknown;
    manualTags: string[];
    useCount: number;
  };
}) {
  const tags = (asset.autoTags ?? {}) as AutoTags;
  const src = asset.thumbnailUrl || asset.storageUrl;

  return (
    <Link
      href={`/console/content/${asset.id}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface/40 transition hover:border-fg-muted"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-base">
        {asset.type === 'VIDEO' ? (
          <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.2em] text-fg-faint">
            video
          </div>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.2em] text-fg-faint">
            no preview
          </div>
        )}

        <div className="absolute left-2 top-2 flex gap-1.5">
          <Tag hue={TYPE_HUE[asset.type]} size="sm">
            {asset.type.toLowerCase()}
          </Tag>
          {asset.tagStatus !== 'TAGGED' ? (
            <Tag hue={STATUS_HUE[asset.tagStatus]} size="sm">
              {asset.tagStatus.toLowerCase()}
            </Tag>
          ) : null}
        </div>

        {asset.useCount > 0 ? (
          <div className="absolute right-2 top-2">
            <Tag hue={null} size="sm">
              used {asset.useCount}x
            </Tag>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 px-3 py-2.5">
        <div className="flex flex-wrap gap-1 text-[11px] text-fg-dim">
          {tags.setting ? <span>{tags.setting}</span> : null}
          {tags.outfit ? <span>· {tags.outfit}</span> : null}
          {tags.aesthetic ? <span>· {tags.aesthetic}</span> : null}
          {!tags.setting && !tags.outfit && !tags.aesthetic ? (
            <span className="text-fg-faint">untagged</span>
          ) : null}
        </div>
        {tags.nsfwRating && tags.nsfwRating !== 'SFW' ? (
          <span className="text-[10px] uppercase tracking-[0.2em] text-fg-faint">
            {tags.nsfwRating}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
