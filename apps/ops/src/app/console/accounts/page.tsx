export default function AccountsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      <p className="text-sm text-muted-foreground">
        Status state machine enforced server-side. Filter by status / agency / archetype / device in Phase 1.
      </p>
    </div>
  );
}
