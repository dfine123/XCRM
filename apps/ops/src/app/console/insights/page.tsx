export default function InsightsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Insights</h1>
      <p className="text-sm text-muted-foreground">
        Nightly candidate queue. Promote → influences generation weights. Demote → archived.
      </p>
    </div>
  );
}
