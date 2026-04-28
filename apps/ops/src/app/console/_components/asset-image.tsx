'use client';

import { useEffect, useState } from 'react';

/**
 * Robust `<img>` for the Drive proxy URL.
 *
 * Two layers of fallback:
 *   1. onError swaps the broken-image to a styled placeholder
 *   2. The placeholder fetches `?probe=1` against the same proxy and
 *      surfaces the actual cause (Drive 502, HEIC not browser-
 *      renderable, asset deleted, etc.) so the operator can act.
 *
 * The probe path is cheap — same auth, same DB lookup, but returns
 * JSON metadata instead of bytes. See the route handler.
 */
type ProbeResult = {
  ok: boolean;
  error?: string;
  detail?: string;
  mime?: string;
  size?: number;
  browserRenderable?: boolean;
};

export function AssetImage({
  assetId,
  alt = '',
  className,
  fallbackText = 'Image unavailable',
}: {
  assetId: string | null | undefined;
  alt?: string;
  className?: string;
  fallbackText?: string;
}) {
  const [errored, setErrored] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);

  // When the <img> fails, fetch the probe endpoint to learn why.
  useEffect(() => {
    if (!errored || !assetId) return;
    let cancelled = false;
    fetch(`/api/drive/file/${assetId}?probe=1`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as ProbeResult | null;
        if (!cancelled && body) setProbe(body);
      })
      .catch(() => {
        /* ignore — we'll show generic fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [errored, assetId]);

  if (!assetId) {
    return <Placeholder className={className} title={fallbackText} />;
  }

  if (errored) {
    const reason = explainProbe(probe);
    return (
      <Placeholder
        className={className}
        title={reason.title}
        subtitle={reason.subtitle}
      />
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

function explainProbe(probe: ProbeResult | null): {
  title: string;
  subtitle?: string;
} {
  if (!probe) {
    return { title: 'Image unavailable' };
  }
  if (probe.ok && probe.mime && probe.browserRenderable === false) {
    // Most common: HEIC from iPhone. Surface the workaround.
    return {
      title: `${probe.mime.replace(/^image\//, '')} not browser-renderable`,
      subtitle: 'Re-export the source as JPEG or PNG and re-sync.',
    };
  }
  if (probe.error === 'drive fetch failed') {
    return {
      title: 'Drive fetch failed',
      subtitle:
        probe.detail?.slice(0, 120) ??
        'Reshare the folder with the service account, then re-sync.',
    };
  }
  if (probe.error === 'asset not found') {
    return { title: 'Asset not found' };
  }
  if (probe.error === 'asset has no drive file') {
    return { title: 'Not a Drive asset', subtitle: probe.detail };
  }
  if (probe.error === 'unauthorized' || probe.error === 'forbidden') {
    return { title: 'Sign-in required' };
  }
  return {
    title: probe.error ?? 'Image unavailable',
    subtitle: probe.detail,
  };
}

function Placeholder({
  className,
  title,
  subtitle,
}: {
  className?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 bg-base p-4 text-center text-fg-faint ${className ?? ''}`}
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
      <span className="text-[11px] uppercase tracking-[0.2em]">{title}</span>
      {subtitle ? (
        <span className="max-w-xs text-[11px] normal-case tracking-normal text-fg-dim">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}
