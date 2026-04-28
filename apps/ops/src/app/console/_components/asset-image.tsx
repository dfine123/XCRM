'use client';

import { useState } from 'react';

/**
 * Robust `<img>` for the Drive proxy URL with a graceful onError
 * fallback. When the proxy 4xx/5xx-s (Drive permissions changed,
 * file deleted, file is a video, etc.) the browser gets a JSON body
 * and would otherwise render a broken-image icon. We swap to a
 * styled "image unavailable" placeholder so previews still look
 * intentional.
 *
 * Use everywhere we render an asset thumbnail/preview: the post
 * preview card, the asset detail page, the runner.
 */
export function AssetImage({
  assetId,
  alt = '',
  className,
  /** Optional fallback hint shown under the placeholder icon. */
  fallbackText = 'Image unavailable',
}: {
  assetId: string | null | undefined;
  alt?: string;
  className?: string;
  fallbackText?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!assetId || errored) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-base text-fg-faint ${className ?? ''}`}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span className="text-[10px] uppercase tracking-[0.2em]">
          {fallbackText}
        </span>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/api/drive/file/${assetId}`}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
