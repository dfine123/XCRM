'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  Button,
  Field,
  Input,
  OPS_HUES,
  Select,
  Tag,
} from '@xcrm/ui';
import { AccountStatus } from '@xcrm/db';
import { submitStep3, advanceFromStep3, type OnboardFormState } from '../actions';

function AddBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.accounts} disabled={pending}>
      {pending ? 'Saving…' : 'Add account'}
    </Button>
  );
}

function ContinueBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.models} disabled={pending}>
      {pending ? 'Saving…' : 'Continue →'}
    </Button>
  );
}

type ExistingAccount = { id: string; handle: string; status: AccountStatus };
type ExistingDevice = { id: string; label: string };

export function Step3Accounts({
  modelId,
  accounts,
  devices,
}: {
  modelId: string;
  accounts: ExistingAccount[];
  devices: ExistingDevice[];
}) {
  const [state, action] = useFormState<OnboardFormState, FormData>(submitStep3, null);
  const [deviceMode, setDeviceMode] = useState<'pick' | 'create'>(
    devices.length > 0 ? 'pick' : 'create',
  );

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {accounts.length > 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
            Added so far ({accounts.length})
          </h4>
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="font-mono text-fg">@{a.handle}</span>
                <Tag hue={null} size="sm">
                  {a.status.toLowerCase().replace(/_/g, ' ')}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="modelId" value={modelId} />
        <input type="hidden" name="deviceMode" value={deviceMode} />

        <Field label="Handle" hint="Without the @.">
          <Input
            name="handle"
            required
            maxLength={32}
            placeholder="modelhandle"
            autoFocus
            pattern="[A-Za-z0-9_]+"
          />
        </Field>

        <Field label="Status">
          <Select name="status" defaultValue={AccountStatus.FRESH_BUILD} required>
            {Object.values(AccountStatus).map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Starting follower count" hint="Leave at 0 if brand new.">
          <Input name="followerCount" type="number" min={0} defaultValue={0} />
        </Field>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] text-fg-dim">Phone device</label>
          <div className="flex gap-2 text-[13px]">
            <button
              type="button"
              className={`rounded-md border px-3 py-1.5 ${
                deviceMode === 'pick'
                  ? 'border-fg-muted text-fg'
                  : 'border-line text-fg-dim hover:text-fg'
              }`}
              onClick={() => setDeviceMode('pick')}
              disabled={devices.length === 0}
            >
              Pick existing ({devices.length})
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-1.5 ${
                deviceMode === 'create'
                  ? 'border-fg-muted text-fg'
                  : 'border-line text-fg-dim hover:text-fg'
              }`}
              onClick={() => setDeviceMode('create')}
            >
              Create new
            </button>
          </div>
          {deviceMode === 'pick' ? (
            <Select name="existingDeviceId" defaultValue={devices[0]?.id} required>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              name="newDeviceLabel"
              required
              maxLength={40}
              placeholder="iPhone 14 - closet"
            />
          )}
        </div>

        {state?.error ? (
          <p className="text-[13px] text-destructive">{state.error}</p>
        ) : null}
        <div className="flex items-center gap-2">
          <AddBtn />
          <span className="text-[12px] text-fg-faint">
            Add as many accounts as this model owns.
          </span>
        </div>
      </form>

      {accounts.length > 0 ? (
        <form action={advanceFromStep3} className="border-t border-line pt-4">
          <input type="hidden" name="modelId" value={modelId} />
          <ContinueBtn />
        </form>
      ) : null}
    </div>
  );
}
