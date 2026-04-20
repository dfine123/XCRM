import { EmptyState, PageHeader, StatCard, VA_HUES } from '@xcrm/ui';

export default function VATodayPage() {
  return (
    <>
      <PageHeader
        kicker="TODAY"
        title="Today's Batches"
        subtitle="Your queue of pre-built task batches. Work top to bottom — each batch runs to completion before the next opens."
        hue={VA_HUES.today}
        icon="Td"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Tasks queued" value="—" icon="Td" hue={VA_HUES.today} caption="across all batches" />
        <StatCard label="Completed today" value="—" icon="Td" hue={VA_HUES.today} caption="tasks shipped" />
        <StatCard label="Accuracy" value="—" icon="St" hue={VA_HUES.stats} caption="last 7 days" />
      </div>

      <div className="mt-6">
        <EmptyState
          hue={VA_HUES.today}
          icon="Td"
          title="No batches assigned yet"
          description="Tasks arrive once the scheduler is wired in Phase 1."
        />
      </div>
    </>
  );
}
