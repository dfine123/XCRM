'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { AccountStatus, PhoneDeviceStatus } from '@xcrm/db';
import { Button, Field, Input, OPS_HUES, Select } from '@xcrm/ui';
import { createAccount, type AccountFormState } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.accounts} disabled={pending}>
      {pending ? 'Creating…' : 'Create account'}
    </Button>
  );
}

type ModelOption = { id: string; displayName: string; agencyName: string };
type DeviceOption = { id: string; label: string; status: PhoneDeviceStatus };

export function NewAccountForm({
  models,
  devices,
  statuses,
  defaultModelId,
}: {
  models: ModelOption[];
  devices: DeviceOption[];
  statuses: AccountStatus[];
  defaultModelId: string;
}) {
  const [state, action] = useFormState<AccountFormState, FormData>(createAccount, null);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <Field label="Model">
        <Select name="modelId" defaultValue={defaultModelId} required>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.agencyName} — {m.displayName}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Handle" hint="Without the @. Letters, numbers, and underscores only.">
        <Input
          name="handle"
          required
          maxLength={32}
          pattern="[A-Za-z0-9_]+"
          autoComplete="off"
          placeholder="your_handle"
        />
      </Field>

      <Field label="Initial status" hint="Status transitions are walked — start where the account actually is today.">
        <Select name="status" defaultValue={AccountStatus.PROSPECT}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase().replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Phone device" hint="Required. The VA will always operate this handle from this device.">
        <Select name="phoneDeviceId" defaultValue={devices[0]?.id} required>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} ({d.status.toLowerCase()})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Starting follower count" hint="0 for a fresh build. Enter the current count for takeovers and acquired accounts.">
        <Input name="followerCount" type="number" min={0} defaultValue={0} />
      </Field>

      {state?.error ? (
        <p className="text-[13px] text-destructive">{state.error}</p>
      ) : null}

      <div className="mt-2">
        <SubmitBtn />
      </div>
    </form>
  );
}
