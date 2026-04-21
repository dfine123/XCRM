'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button, Input, OPS_HUES } from '@xcrm/ui';
import {
  updateManualTags,
  type ContentActionState,
} from '../../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.content} disabled={pending}>
      {pending ? 'Saving…' : 'Save tags'}
    </Button>
  );
}

export function ManualTagsForm({
  assetId,
  currentTags,
}: {
  assetId: string;
  currentTags: string[];
}) {
  const [state, action] = useFormState<ContentActionState, FormData>(
    updateManualTags,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={assetId} />
      <Input
        name="tags"
        defaultValue={currentTags.join(', ')}
        placeholder="beach, denim, afternoon"
        maxLength={1000}
      />
      <p className="text-[11px] text-fg-faint">
        Comma-separated. Max 32 tags, 40 chars each. Lowercased on save.
      </p>
      {state?.error ? (
        <p className="text-[12px] text-destructive">{state.error}</p>
      ) : null}
      <div>
        <SubmitBtn />
      </div>
    </form>
  );
}
