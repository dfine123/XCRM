'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import {
  Button,
  Field,
  Input,
  OPS_HUES,
  Select,
  Textarea,
} from '@xcrm/ui';
import { createModel, type ModelFormState } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.models} disabled={pending}>
      {pending ? 'Creating…' : 'Create model'}
    </Button>
  );
}

export function NewModelForm({
  agencies,
  defaultAgencyId,
  archetypes,
}: {
  agencies: { id: string; name: string; slug: string }[];
  defaultAgencyId?: string;
  archetypes: string[];
}) {
  const [state, action] = useFormState<ModelFormState, FormData>(createModel, null);
  const initialAgency =
    defaultAgencyId && agencies.some((a) => a.id === defaultAgencyId)
      ? defaultAgencyId
      : agencies[0]?.id;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <Field label="Agency">
        <Select name="agencyId" defaultValue={initialAgency} required>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.slug})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Display name" hint="What we call the model everywhere except internal context.">
        <Input name="displayName" required maxLength={80} autoFocus />
      </Field>

      <Field label="Real name" hint="Optional. Internal only — never surfaced to VAs or portal.">
        <Input name="realName" maxLength={120} />
      </Field>

      <Field label="Archetype">
        <Select name="archetype" defaultValue={archetypes[0]} required>
          {archetypes.map((a) => (
            <option key={a} value={a}>
              {a.toLowerCase().replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Voice / tone notes"
        hint="Free-form. Style, vocabulary, forbidden phrases. Plugged into generation context."
      >
        <Textarea name="voiceToneNotes" rows={5} maxLength={4000} />
      </Field>

      <Field
        label="Hard rules"
        hint="Comma-separated absolutes that must never be violated. Example: no crypto talk, no politics."
      >
        <Input name="hardRules" placeholder="no crypto talk, no politics, brand-safe only" />
      </Field>

      <Field
        label="Soft preferences"
        hint="Comma-separated gentle steers. Example: prefer morning posts, avoid food photos."
      >
        <Input name="softPreferences" placeholder="prefer morning posts, avoid food photos" />
      </Field>

      {state?.error ? (
        <p className="text-[13px] text-destructive">{state.error}</p>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <SubmitBtn />
        <Link href="/console/models">
          <Button type="button" variant="ghost" size="sm">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
