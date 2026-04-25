'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Textarea, Input, OPS_HUES } from '@xcrm/ui';
import {
  editAndApprovePost,
  type ReviewActionState,
} from '../actions';
import type { AssetAlternative } from '@/app/console/_loaders/asset-alternatives';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      hue={OPS_HUES.formula}
      disabled={pending}
    >
      {pending ? 'Saving…' : 'Save & approve'}
    </Button>
  );
}

/**
 * Inline edit-and-approve form. Click "Edit" on a review-item to open
 * — operator can:
 *   - Tune copy (textarea, 280-char counter)
 *   - Swap asset by clicking an alternative thumbnail OR by pasting a
 *     specific assetId (escape hatch for assets outside the top-N
 *     novelty list)
 *
 * Submit calls editAndApprovePost which validates the assetId belongs
 * to the same model and flips status to SCHEDULED.
 */
export function EditForm({
  postId,
  initialCopy,
  initialAssetId,
  alternatives,
}: {
  postId: string;
  initialCopy: string;
  initialAssetId: string | null;
  alternatives: AssetAlternative[];
}) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState(initialCopy);
  const [assetId, setAssetId] = useState(initialAssetId ?? '');
  const [state, action] = useFormState<ReviewActionState, FormData>(
    editAndApprovePost,
    null,
  );

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-md border border-line bg-bg/40 p-3"
    >
      <input type="hidden" name="id" value={postId} />
      <input type="hidden" name="assetId" value={assetId} />

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[12px] text-fg-dim">Copy</label>
          <span
            className={`text-[11px] tabular-nums ${
              copy.length > 280 ? 'text-destructive' : 'text-fg-faint'
            }`}
          >
            {copy.length}/280
          </span>
        </div>
        <Textarea
          name="copy"
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          rows={3}
          maxLength={280}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[12px] text-fg-dim">
          Asset (click to swap, or paste an ID below)
        </label>
        <div className="flex flex-wrap items-start gap-2">
          {/* Current pick */}
          {initialAssetId ? (
            <button
              type="button"
              onClick={() => setAssetId(initialAssetId)}
              className={`flex flex-col items-center gap-1 rounded-md border p-1.5 ${
                assetId === initialAssetId
                  ? 'border-fg-muted bg-surface/60'
                  : 'border-line hover:border-fg-muted'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/drive/file/${initialAssetId}`}
                alt=""
                loading="lazy"
                className="h-16 w-16 rounded object-cover"
              />
              <span className="text-[10px] uppercase tracking-[0.2em] text-fg-faint">
                current
              </span>
            </button>
          ) : null}

          {/* Alternatives */}
          {alternatives.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAssetId(a.id)}
              title={a.caption ?? a.aesthetic ?? ''}
              className={`flex flex-col items-center gap-1 rounded-md border p-1.5 ${
                assetId === a.id
                  ? 'border-fg-muted bg-surface/60'
                  : 'border-line hover:border-fg-muted'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/drive/file/${a.id}`}
                alt=""
                loading="lazy"
                className="h-16 w-16 rounded object-cover"
              />
              <span className="text-[10px] tabular-nums text-fg-faint">
                {(a.novelty * 100).toFixed(0)}%
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-fg-faint">
            Or paste an asset ID
          </label>
          <Input
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            placeholder="ck…"
            className="font-mono text-[12px]"
          />
        </div>
      </div>

      {state?.error ? (
        <p className="text-[12px] text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <SubmitBtn />
      </div>
    </form>
  );
}
