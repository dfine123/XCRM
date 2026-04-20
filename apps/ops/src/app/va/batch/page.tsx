import { EmptyState, VA_HUES } from '@xcrm/ui';
import { hue } from '@xcrm/ui';

export default function CurrentBatchPage() {
  // Full-screen task execution shell (spec §2.5) — interactive card UI lands in Phase 1.
  return (
    <div className="-mx-8 -my-8 flex min-h-[calc(100vh-57px)] flex-col bg-base">
      <div className="border-b border-line bg-surface/60 px-8 py-3 backdrop-blur-sm">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised shadow-depth-flat">
          <div
            className="h-full w-0 rounded-full"
            style={{ background: hue(VA_HUES.batch), boxShadow: `0 0 12px ${hue(VA_HUES.batch, 0.5)}` }}
          />
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-fg-muted">
          0 of 0 tasks · — remaining
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-10">
        <EmptyState
          hue={VA_HUES.batch}
          icon="Bt"
          title="No batch in progress"
          description="Pick one from Today's Batches to begin."
          className="max-w-xl"
        />
      </div>
    </div>
  );
}
