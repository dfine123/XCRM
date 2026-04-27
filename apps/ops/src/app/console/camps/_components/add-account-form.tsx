'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button, Field, Input, OPS_HUES } from '@xcrm/ui';
import { addAccountToCamp, type CampFormState } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.camps} disabled={pending}>
      {pending ? 'Adding…' : 'Add account'}
    </Button>
  );
}

export function AddAccountForm({ campId }: { campId: string }) {
  const [state, action] = useFormState<CampFormState, FormData>(
    addAccountToCamp,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="campId" value={campId} />
      <Field
        label="Account handle"
        hint="Without the @. Resolved to the live account; soft-deleted accounts are rejected."
      >
        <Input
          name="handle"
          required
          maxLength={32}
          pattern="[A-Za-z0-9_]+"
          placeholder="modelhandle"
        />
      </Field>
      {state?.error ? (
        <p className="text-[12px] text-destructive">{state.error}</p>
      ) : null}
      <div>
        <SubmitBtn />
      </div>
    </form>
  );
}
