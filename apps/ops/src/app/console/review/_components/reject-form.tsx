'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Textarea } from '@xcrm/ui';
import { rejectPost } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      className="border-destructive/40 text-destructive hover:bg-destructive/10"
      disabled={pending}
    >
      {pending ? 'Rejecting…' : 'Confirm reject'}
    </Button>
  );
}

/**
 * Inline reject confirm. Click "Reject" → reveals reason textarea +
 * confirm button. Cancel collapses back. Reason is optional; submit
 * sends the post to status=CANCELLED via the server action.
 *
 * Negative-signal feedback for Build G's generator-learning loop is
 * just persisted metadata at this stage.
 */
export function RejectForm({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-fg-faint hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        Reject
      </Button>
    );
  }

  return (
    <form action={rejectPost} className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
      <input type="hidden" name="id" value={postId} />
      <label className="text-[12px] text-fg-dim">
        Reason (optional — recorded for the generator&apos;s feedback loop)
      </label>
      <Textarea
        name="reason"
        rows={2}
        maxLength={500}
        placeholder="e.g. tone is off / asset doesn't match the active note"
      />
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
