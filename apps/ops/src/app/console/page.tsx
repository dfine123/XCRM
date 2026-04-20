import { OPS_HUES, PageHeader, StatCard } from '@xcrm/ui';

export default function Dashboard() {
  return (
    <>
      <PageHeader
        kicker="OVERVIEW"
        title="Dashboard"
        subtitle="Phase 0 shell. Feature dashboards land in Phase 1 once the scheduler and insight pipeline are online."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accounts"
          value="—"
          icon="Ac"
          hue={OPS_HUES.accounts}
          caption="managed handles"
        />
        <StatCard
          label="Posts today"
          value="—"
          icon="Co"
          hue={OPS_HUES.content}
          caption="across all accounts"
        />
        <StatCard label="Active VAs" value="—" icon="VA" hue={OPS_HUES.vas} caption="currently online" />
        <StatCard
          label="Runway at risk"
          value="—"
          icon="In"
          hue={OPS_HUES.insights}
          caption="agencies below 7d"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="Open escalations"
          value="—"
          icon="Ag"
          hue={OPS_HUES.agencies}
          caption="awaiting partner review"
        />
        <StatCard
          label="Camps awaiting approval"
          value="—"
          icon="Ca"
          hue={OPS_HUES.camps}
          caption="auto-activate Sun 20:00 UTC"
        />
        <StatCard
          label="Insight candidates"
          value="—"
          icon="In"
          hue={OPS_HUES.insights}
          caption="nightly queue"
        />
      </div>
    </>
  );
}
