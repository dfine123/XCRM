'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { PhoneDeviceStatus } from '@xcrm/db';
import {
  Button,
  Field,
  Input,
  OPS_HUES,
  PageHeader,
  Select,
} from '@xcrm/ui';
import { createDevice, type DeviceFormState } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.devices} disabled={pending}>
      {pending ? 'Creating…' : 'Create device'}
    </Button>
  );
}

export default function NewDevicePage() {
  const [state, action] = useFormState<DeviceFormState, FormData>(createDevice, null);
  return (
    <>
      <PageHeader
        kicker="DEVICES · NEW"
        title="New device"
        subtitle="Label is how the VA will recognize the phone. Pick something unambiguous — iPhone 12 Pro (white), Pixel 7 (back shelf)."
        hue={OPS_HUES.devices}
        icon="Dv"
      />
      <form action={action} className="flex max-w-lg flex-col gap-4">
        <Field label="Label">
          <Input name="label" required maxLength={40} autoFocus />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={PhoneDeviceStatus.ACTIVE}>
            {Object.values(PhoneDeviceStatus).map((s) => (
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
          <Link href="/console/devices">
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </>
  );
}
