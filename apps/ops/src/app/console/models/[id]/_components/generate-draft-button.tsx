'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, OPS_HUES } from '@xcrm/ui';

type GenerateResponse = {
  accountId: string;
  outcome:
    | { kind: 'SKIPPED'; reason: string }
    | { kind: 'NO_SLOT' }
    | { kind: 'LLM_ERROR'; error: string }
    | {
        kind: 'CREATED';
        postId: string;
        status: 'PENDING_APPROVAL' | 'SCHEDULED';
        confidence: number;
        assetId: string;
        scheduledFor: string;
      };
};

/**
 * Manual "Generate draft" button rendered per-account on the model
 * detail page. POSTs to /api/generate/[accountId] and surfaces the
 * orchestrator's outcome inline. Bypasses GENERATE_ENABLED by design
 * — a manual click is always deliberate.
 */
export function GenerateDraftButton({
  accountId,
  handle,
}: {
  accountId: string;
  handle: string;
}) {
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
      const res = await fetch(`/api/generate/${accountId}`, {
        method: 'POST',
      });
      const body = (await res.json()) as GenerateResponse;
      if (!res.ok) {
        setIsError(true);
        setMsg(
          body.outcome?.kind === 'LLM_ERROR'
            ? body.outcome.error
            : `HTTP ${res.status}`,
        );
      } else {
        switch (body.outcome.kind) {
          case 'CREATED':
            setMsg(
              `Draft ${body.outcome.status === 'SCHEDULED' ? 'scheduled' : 'pending review'} · conf ${(body.outcome.confidence * 100).toFixed(0)}%`,
            );
            break;
          case 'NO_SLOT':
            setIsError(true);
            setMsg('No open slot in the next 72h');
            break;
          case 'SKIPPED':
            setIsError(true);
            setMsg(`Skipped — ${body.outcome.reason}`);
            break;
          case 'LLM_ERROR':
            setIsError(true);
            setMsg(body.outcome.error);
            break;
        }
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setIsError(true);
      setMsg(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setInflight(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        hue={OPS_HUES.formula}
        disabled={busy}
        onClick={handleClick}
      >
        {busy ? 'Generating…' : `Generate for @${handle}`}
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
