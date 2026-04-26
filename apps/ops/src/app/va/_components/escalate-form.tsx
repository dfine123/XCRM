'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Textarea } from '@xcrm/ui';
import { escalateTask } from '../actions';

function ConfirmBtn() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      className="border-destructive/40 text-destructive hover:bg-destructive/10"
      disabled={pending}
    >
      {pending ? 'Escalating…' : 'Send to operator'}
    </Button>
  );
}

/**
 * Inline escalate form for the runner. Click "Escalate (E)" → reveal
 * reason textarea + confirm. Submit posts the task back to the
 * operator's review queue with the reason.
 */
export function EscalateForm({
  taskId,
  open,
  onClose,
}: {
  taskId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  if (!open) return null;

  return (
    <form
      action={escalateTask}
      className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3"
    >
      <input type="hidden" name="id" value={taskId} />
      <label className="text-[12px] text-fg-dim">
        Reason — what should the operator know?
      </label>
      <Textarea
        name="reason"
        rows={3}
        maxLength={500}
        required
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. account locked, asset missing, copy violates current platform policy"
      />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <ConfirmBtn />
      </div>
    </form>
  );
}
