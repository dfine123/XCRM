'use client';

import { useFormStatus } from 'react-dom';
import { Button, Card } from '@xcrm/ui';
import { softDeleteModel } from '@/app/console/models/actions';

function ConfirmButton({ displayName }: { displayName: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      className="border-destructive/40 text-destructive hover:bg-destructive/10"
      disabled={pending}
      onClick={(e) => {
        const expected = displayName.trim();
        const entered = window.prompt(
          `Type "${expected}" to confirm removing this model. All accounts will be removed and Drive folders disconnected. Content assets and audit history stay.`,
        );
        if (entered === null) {
          e.preventDefault();
          return;
        }
        if (entered.trim() !== expected) {
          e.preventDefault();
          window.alert('Name did not match — cancelled.');
        }
      }}
    >
      {pending ? 'Removing…' : 'Remove model'}
    </Button>
  );
}

export function RemoveModelCard({
  modelId,
  displayName,
}: {
  modelId: string;
  displayName: string;
}) {
  return (
    <Card className="border-destructive/30 p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-destructive/80">
        Danger zone
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
        Removing a model soft-deletes all its accounts (freeing the handles)
        and marks every connected Drive folder DISCONNECTED. Content assets
        and audit history are preserved.
      </p>
      <form action={softDeleteModel} className="mt-3">
        <input type="hidden" name="id" value={modelId} />
        <ConfirmButton displayName={displayName} />
      </form>
    </Card>
  );
}
