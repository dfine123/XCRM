'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, OPS_HUES } from '@xcrm/ui';

type SyncResponse = {
  ok: boolean;
  filesSeen: number;
  filesIngested: number;
  filesSkipped: number;
  taggingQueued: number;
  error?: string;
};

export function SyncNowButton({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inflight, setInflight] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const busy = inflight || isPending;

  async function handleClick() {
    setInflight(true);
    setMsg(null);
    setIsError(false);
    try {
      const res = await fetch(`/api/drive/sync/${sourceId}`, { method: 'POST' });
      const body = (await res.json()) as SyncResponse;
      if (!res.ok || !body.ok) {
        setIsError(true);
        setMsg(body.error ?? `HTTP ${res.status}`);
      } else {
        const tagSuffix = body.taggingQueued > 0 ? `, tagging ${body.taggingQueued}` : '';
        setMsg(
          body.filesIngested > 0
            ? `Synced ${body.filesIngested} new file${body.filesIngested === 1 ? '' : 's'}${tagSuffix}`
            : 'Up to date',
        );
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setIsError(true);
      setMsg(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setInflight(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        hue={OPS_HUES.content}
        disabled={busy}
        onClick={handleClick}
      >
        {busy ? 'Syncing…' : 'Sync now'}
      </Button>
      {msg ? (
        <span
          className={`text-[11px] ${isError ? 'text-destructive' : 'text-fg-dim'}`}
        >
          {msg}
        </span>
      ) : null}
    </div>
  );
}
