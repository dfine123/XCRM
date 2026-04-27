'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Input, OPS_HUES } from '@xcrm/ui';
import {
  recordEngagement,
  type EngagementFormState,
} from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.insights} disabled={pending}>
      {pending ? 'Saving…' : 'Record snapshot'}
    </Button>
  );
}

/**
 * Inline engagement entry. Six number inputs + submit. No fancy
 * picker — operators paste totals from the X dashboard.
 *
 * `defaults` carry the latest snapshot's values forward so re-entry
 * is fewer keystrokes than fresh entry.
 */
export function EngagementForm({
  postId,
  defaults,
}: {
  postId: string;
  defaults?: {
    likes: number;
    reposts: number;
    replies: number;
    bookmarks: number;
    impressions: number;
    profileClicks: number;
  };
}) {
  const [state, action] = useFormState<EngagementFormState, FormData>(
    recordEngagement,
    null,
  );
  const [stale, setStale] = useState(false);

  // After a successful submit, mark the form as "saved" so a 2-tap
  // refresh isn't needed to know the action took.
  useEffect(() => {
    if (state?.ok) {
      setStale(true);
      const t = setTimeout(() => setStale(false), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="postId" value={postId} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <NumField name="likes" label="Likes" defaultValue={defaults?.likes} />
        <NumField
          name="reposts"
          label="Reposts"
          defaultValue={defaults?.reposts}
        />
        <NumField
          name="replies"
          label="Replies"
          defaultValue={defaults?.replies}
        />
        <NumField
          name="bookmarks"
          label="Bookmarks"
          defaultValue={defaults?.bookmarks}
        />
        <NumField
          name="impressions"
          label="Impressions"
          defaultValue={defaults?.impressions}
        />
        <NumField
          name="profileClicks"
          label="Profile clicks"
          defaultValue={defaults?.profileClicks}
        />
      </div>
      <div className="flex items-center gap-2">
        <SubmitBtn />
        {stale ? (
          <span className="text-[11px] text-fg-dim">Saved ✓</span>
        ) : null}
        {state?.error ? (
          <span className="text-[11px] text-destructive">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}

function NumField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.15em] text-fg-faint">
        {label}
      </span>
      <Input
        type="number"
        name={name}
        min={0}
        defaultValue={defaultValue ?? 0}
        className="font-mono text-[12px]"
      />
    </label>
  );
}
