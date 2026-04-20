import { PageHeader, StatCard, VA_HUES } from '@xcrm/ui';

export default function VAStatsPage() {
  return (
    <>
      <PageHeader
        kicker="STATS"
        title="My Stats"
        subtitle="Accuracy, throughput, and completion rate across your recent work."
        hue={VA_HUES.stats}
        icon="St"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Accuracy" value="—" icon="St" hue={VA_HUES.stats} caption="last 7 days" />
        <StatCard label="Throughput" value="—" icon="Td" hue={VA_HUES.today} caption="tasks / day" />
        <StatCard label="Completion" value="—" icon="Bt" hue={VA_HUES.batch} caption="batches finished" />
      </div>
    </>
  );
}
