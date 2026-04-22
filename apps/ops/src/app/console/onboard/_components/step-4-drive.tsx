'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button, Field, Input, OPS_HUES } from '@xcrm/ui';
import { submitStep4, type OnboardFormState } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.content} disabled={pending}>
      {pending ? 'Connecting…' : 'Connect folder →'}
    </Button>
  );
}

export function Step4Drive({ modelId }: { modelId: string }) {
  const [state, action] = useFormState<OnboardFormState, FormData>(submitStep4, null);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="modelId" value={modelId} />

      <Field
        label="Drive folder"
        hint="Paste the folder URL or the raw folder ID. We'll extract the ID."
      >
        <Input
          name="folderInput"
          required
          autoFocus
          placeholder="https://drive.google.com/drive/folders/1AbCdEf…"
        />
      </Field>

      <Field
        label="Label"
        hint="How this folder appears on the model's content sources list."
      >
        <Input name="folderName" required maxLength={120} placeholder="Primary folder" />
      </Field>

      <p className="rounded-md border border-line bg-surface/40 p-3 text-[12px] leading-relaxed text-fg-dim">
        Before submitting, share the folder with the service-account email
        configured in <code className="font-mono text-fg">GOOGLE_SERVICE_ACCOUNT_JSON</code>.
        If the folder isn&apos;t shared, the first sync will fail and you&apos;ll see
        a red signal on the model detail — reconnect after fixing the share.
      </p>

      {state?.error ? (
        <p className="text-[13px] text-destructive">{state.error}</p>
      ) : null}
      <div>
        <SubmitBtn />
      </div>
    </form>
  );
}
