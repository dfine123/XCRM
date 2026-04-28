import { AssetImage } from './asset-image';

/**
 * X-style post preview card. Mimics the shape of a real tweet so the
 * operator sees what the post will look like in-feed, not just a wall
 * of metadata. Server component — pure render.
 *
 * Action-row icons are visual only (no functionality); they help the
 * preview feel like a tweet without inviting the operator to click.
 *
 * Operator metadata (status chip, confidence, scheduled time, review
 * link) lives OUTSIDE this card. Keeping the inside of the card pure
 * "what the audience will see" prevents the preview from drifting
 * into a dashboard.
 */
export function PostPreview({
  displayName,
  handle,
  copy,
  assetId,
  postedTimestamp,
  variant = 'photo',
}: {
  displayName: string;
  handle: string;
  copy: string;
  assetId: string | null;
  /** Optional timestamp-line text, e.g. "Apr 28" or "scheduled". */
  postedTimestamp?: string;
  /** "video" disables the proxy thumbnail (videos can't render via <img>). */
  variant?: 'photo' | 'video';
}) {
  const initial = displayName.trim().slice(0, 1).toUpperCase() || '·';

  return (
    <div className="rounded-2xl border border-line bg-bg/60 p-4">
      <header className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-[15px] font-semibold text-fg"
          aria-hidden
        >
          {initial}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold text-fg">
            {displayName}
          </span>
          <span className="text-[14px] text-fg-faint">
            @{handle}
            {postedTimestamp ? (
              <>
                <span className="mx-1">·</span>
                {postedTimestamp}
              </>
            ) : null}
          </span>
        </div>
      </header>

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-snug text-fg">
        {copy}
      </p>

      {assetId ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-base">
          {variant === 'video' ? (
            <div className="flex aspect-video w-full items-center justify-center text-[11px] uppercase tracking-[0.2em] text-fg-faint">
              video
            </div>
          ) : (
            <AssetImage
              assetId={assetId}
              alt=""
              className="aspect-[4/5] w-full max-h-[520px] object-cover"
              fallbackText="Image unavailable"
            />
          )}
        </div>
      ) : null}

      <footer
        className="mt-3 flex max-w-md justify-between text-fg-faint"
        aria-hidden
      >
        <ActionIcon path="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        <ActionIcon path="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
        <ActionIcon path="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        <ActionIcon path="M3 3v18h18M7 16l4-4 4 4 6-6" />
      </footer>
    </div>
  );
}

function ActionIcon({ path }: { path: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
