'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@xcrm/ui';
import { softDeleteAccount } from '@/app/console/accounts/actions';

function Inner({ handle }: { handle: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={(e) => {
        if (
          !confirm(
            `Remove @${handle}? The account row is kept for audit trail, but its handle is freed so you can reuse it.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? 'Removing…' : 'Remove'}
    </Button>
  );
}

export function RemoveAccountButton({
  accountId,
  handle,
  modelId,
}: {
  accountId: string;
  handle: string;
  modelId: string;
}) {
  return (
    <form action={softDeleteAccount} className="inline">
      <input type="hidden" name="id" value={accountId} />
      <input type="hidden" name="redirectTo" value={`/console/models/${modelId}`} />
      <Inner handle={handle} />
    </form>
  );
}
