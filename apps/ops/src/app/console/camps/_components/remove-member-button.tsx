'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@xcrm/ui';
import { removeAccountFromCamp } from '../actions';

function Inner({ handle }: { handle: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(`Remove @${handle} from this camp?`)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? 'Removing…' : 'Remove'}
    </Button>
  );
}

export function RemoveMemberButton({
  membershipId,
  handle,
}: {
  membershipId: string;
  handle: string;
}) {
  return (
    <form action={removeAccountFromCamp} className="inline">
      <input type="hidden" name="membershipId" value={membershipId} />
      <Inner handle={handle} />
    </form>
  );
}
