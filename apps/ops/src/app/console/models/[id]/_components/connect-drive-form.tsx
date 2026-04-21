'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button, Field, Input, OPS_HUES } from '@xcrm/ui';
import {
  connectDriveSource,
  type DriveSourceFormState,
} from '@/app/console/drive-sources/actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" hue={OPS_HUES.content} disabled={pending}>
      {pending ? 'Connecting…' : 'Connect folder'}
    </Button>
  );
}

export function ConnectDriveForm({ modelId }: { modelId: string }) {
  const [state, action] = useFormState<DriveSourceFormState, FormData>(
    connectDriveSource,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="modelId" value={modelId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Folder ID" hint="Paste the ID from the Drive URL (after /folders/).">
          <Input
            name="folderId"
            required
            minLength={10}
            maxLength={200}
            placeholder="1AbCdEfGhIjKlMnOpQrSt"
            autoComplete="off"
          />
        </Field>
        <Field label="Label" hint="How this folder appears in the list.">
          <Input name="folderName" required maxLength={120} placeholder="Summer drop 2026" />
        </Field>
        <SubmitBtn />
      </div>
      <p className="text-[11px] leading-relaxed text-fg-faint">
        Share the folder with the service-account email before connecting, or the first sync
        will fail with a permissions error.
      </p>
      {state?.error ? (
        <p className="text-[13px] text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
