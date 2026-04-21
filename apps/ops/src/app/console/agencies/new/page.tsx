'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { AgencyStatus } from '@xcrm/db';
import {
  Button,
  Field,
  Input,
  OPS_HUES,
  PageHeader,
  Select,
} from '@xcrm/ui';
import { createAgency, type AgencyFormState } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.agencies} disabled={pending}>
      {pending ? 'Creating…' : 'Create agency'}
    </Button>
  );
}

export default function NewAgencyPage() {
  const [state, action] = useFormState<AgencyFormState, FormData>(createAgency, null);

  return (
    <>
      <PageHeader
        kicker="AGENCIES · NEW"
        title="New agency"
        subtitle="Slug is the short URL-safe handle we'll reference everywhere. Status can be changed later."
        hue={OPS_HUES.agencies}
        icon="Ag"
      />

      <form action={action} className="flex max-w-xl flex-col gap-4">
        <Field label="Name" hint="Human-readable name. Example: Deebo Personal.">
          <Input name="name" required minLength={2} maxLength={80} autoFocus />
        </Field>
        <Field label="Slug" hint="Lowercase letters, digits, hyphens. Example: deebo-personal.">
          <Input
            name="slug"
            required
            pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            minLength={2}
            maxLength={40}
          />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={AgencyStatus.ACTIVE}>
            {Object.values(AgencyStatus).map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>

        {state?.error ? (
          <p className="text-[13px] text-destructive">{state.error}</p>
        ) : null}

        <div className="mt-2 flex items-center gap-2">
          <SubmitBtn />
          <Link href="/console/agencies">
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </>
  );
}
