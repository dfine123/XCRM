'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Field, Input, Select, OPS_HUES } from '@xcrm/ui';
import { submitStep1, type OnboardFormState } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.models} disabled={pending}>
      {pending ? 'Saving…' : 'Continue →'}
    </Button>
  );
}

export function Step1Agency({
  agencies,
}: {
  agencies: { id: string; name: string; slug: string }[];
}) {
  const [state, action] = useFormState<OnboardFormState, FormData>(submitStep1, null);
  const [mode, setMode] = useState<'pick' | 'create'>(
    agencies.length > 0 ? 'pick' : 'create',
  );

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="flex gap-2 text-[13px]">
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 ${
            mode === 'pick'
              ? 'border-fg-muted text-fg'
              : 'border-line text-fg-dim hover:text-fg'
          }`}
          onClick={() => setMode('pick')}
          disabled={agencies.length === 0}
        >
          Pick existing ({agencies.length})
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 ${
            mode === 'create'
              ? 'border-fg-muted text-fg'
              : 'border-line text-fg-dim hover:text-fg'
          }`}
          onClick={() => setMode('create')}
        >
          Create new
        </button>
      </div>

      {mode === 'pick' ? (
        <Field label="Agency">
          <Select name="existingId" defaultValue={agencies[0]?.id} required>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.slug})
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <>
          <Field label="Name">
            <Input name="name" required maxLength={80} autoFocus />
          </Field>
          <Field
            label="Slug"
            hint="Lowercase letters, digits, hyphens. Used in URLs and display."
          >
            <Input name="slug" required maxLength={40} placeholder="acme-agency" />
          </Field>
        </>
      )}

      {state?.error ? (
        <p className="text-[13px] text-destructive">{state.error}</p>
      ) : null}
      <div>
        <SubmitBtn />
      </div>
    </form>
  );
}
