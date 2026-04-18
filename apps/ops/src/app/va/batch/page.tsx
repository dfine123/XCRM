export default function CurrentBatchPage() {
  // Full-screen task execution shell (spec §2.5) — interactive card UI lands in Phase 1.
  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col">
      <div className="border-b px-6 py-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-0 bg-primary" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">0 of 0 tasks · — remaining</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="rounded-md border p-10 text-center text-muted-foreground">
          No batch in progress. Pick one from Today&apos;s Batches.
        </div>
      </div>
    </div>
  );
}
