import { Button, OPS_HUES } from '@xcrm/ui';
import { activateCamp, completeCamp } from '../actions';

/**
 * Server-action forms for the camp's status transition buttons.
 * Server-side render keeps it simple — these are atomic operations,
 * no client state needed.
 */
export function LifecycleButtons({
  campId,
  status,
}: {
  campId: string;
  status: 'PROPOSED' | 'ACTIVE' | 'COMPLETED';
}) {
  return (
    <div className="flex gap-2">
      {status === 'PROPOSED' ? (
        <form action={activateCamp}>
          <input type="hidden" name="id" value={campId} />
          <Button type="submit" size="sm" hue={OPS_HUES.camps}>
            Activate
          </Button>
        </form>
      ) : null}
      {status === 'ACTIVE' ? (
        <form action={completeCamp}>
          <input type="hidden" name="id" value={campId} />
          <Button type="submit" size="sm" variant="ghost">
            Complete
          </Button>
        </form>
      ) : null}
    </div>
  );
}
