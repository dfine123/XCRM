'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@xcrm/ui';
import {
  softDeleteAsset,
  restoreAsset,
  type ContentActionState,
} from '../../actions';

function DeleteBtn() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={(e) => {
        if (!confirm('Soft-delete this asset? It can be restored later.')) {
          e.preventDefault();
        }
      }}
    >
      {pending ? 'Deleting…' : 'Delete asset'}
    </Button>
  );
}

function RestoreBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="ghost" disabled={pending}>
      {pending ? 'Restoring…' : 'Restore'}
    </Button>
  );
}

export function DeleteAssetForm({
  assetId,
  isDeleted,
}: {
  assetId: string;
  isDeleted: boolean;
}) {
  const [delState, delAction] = useFormState<ContentActionState, FormData>(
    softDeleteAsset,
    null,
  );
  const [resState, resAction] = useFormState<ContentActionState, FormData>(
    restoreAsset,
    null,
  );

  if (isDeleted) {
    return (
      <form action={resAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={assetId} />
        <RestoreBtn />
        {resState?.error ? (
          <p className="text-[12px] text-destructive">{resState.error}</p>
        ) : null}
      </form>
    );
  }

  return (
    <form action={delAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={assetId} />
      <input type="hidden" name="reason" value="" />
      <DeleteBtn />
      {delState?.error ? (
        <p className="text-[12px] text-destructive">{delState.error}</p>
      ) : null}
    </form>
  );
}
