export default function VATodayPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Today&apos;s Batches</h1>
        <p className="text-sm text-muted-foreground">
          Your queue of pre-built task batches. Execute top to bottom.
        </p>
      </div>
      <div className="rounded-md border p-6 text-sm text-muted-foreground">
        No batches assigned yet. Tasks arrive in Phase 1 once the scheduler is wired.
      </div>
    </div>
  );
}
