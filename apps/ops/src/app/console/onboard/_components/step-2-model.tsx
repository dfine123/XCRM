'use client';

import { useFormState, useFormStatus } from 'react-dom';
import {
  Button,
  Field,
  Input,
  OPS_HUES,
  Select,
  Textarea,
} from '@xcrm/ui';
import { submitStep2, type OnboardFormState } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.models} disabled={pending}>
      {pending ? 'Saving…' : 'Continue →'}
    </Button>
  );
}

export function Step2Model({
  agencyId,
  agencyName,
  archetypes,
}: {
  agencyId: string;
  agencyName: string;
  archetypes: string[];
}) {
  const [state, action] = useFormState<OnboardFormState, FormData>(submitStep2, null);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="agencyId" value={agencyId} />
      <p className="text-[12px] text-fg-dim">
        Agency: <span className="text-fg">{agencyName}</span>
      </p>

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
        <Textarea name="voiceToneNotes" rows={4} maxLength={4000} />
      </Field>

      <Field
        label="Hard rules"
        hint="Comma-separated absolutes. Example: no crypto talk, no politics."
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
      <div>
        <SubmitBtn />
      </div>
    </form>
  );
}
