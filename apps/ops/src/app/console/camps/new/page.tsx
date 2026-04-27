'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button, Field, Input, OPS_HUES, PageHeader } from '@xcrm/ui';
import {
  createCamp,
  type CampFormState,
} from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.camps} disabled={pending}>
      {pending ? 'Creating…' : 'Create camp'}
    </Button>
  );
}

/**
 * /console/camps/new — minimum input: pick a `weekOf` date. The
 * camp lands as PROPOSED; operator adds members from the detail
 * page, then activates.
 */
export default function NewCampPage() {
  const [state, action] = useFormState<CampFormState, FormData>(
    createCamp,
    null,
  );

  // Default to next Sunday — most camps run weekend-to-weekend.
  const nextSunday = (() => {
    const d = new Date();
    const dow = d.getUTCDay();
    const daysUntilSunday = (7 - dow) % 7 || 7;
    d.setUTCDate(d.getUTCDate() + daysUntilSunday);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <>
      <PageHeader
        kicker="CAMPS · NEW"
        title="New camp"
        subtitle="Group accounts that share a content library so the generator avoids scheduling the same asset across them within 72h."
        hue={OPS_HUES.camps}
        icon="Ca"
        actions={
          <Link
            href="/console/camps"
            className="text-[13px] text-fg-dim hover:text-fg"
          >
            ← Back to camps
          </Link>
        }
      />

      <form action={action} className="flex max-w-md flex-col gap-4">
        <Field label="Week of" hint="Sunday is the conventional start.">
          <Input
            type="date"
            name="weekOf"
            required
            defaultValue={nextSunday}
          />
        </Field>
        {state?.error ? (
          <p className="text-[13px] text-destructive">{state.error}</p>
        ) : null}
        <div>
          <SubmitBtn />
        </div>
      </form>
    </>
  );
}
