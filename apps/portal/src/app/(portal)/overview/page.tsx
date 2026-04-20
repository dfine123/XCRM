import { PageHeader, PORTAL_HUES, StatCard } from '@xcrm/ui';

export default function Overview() {
  return (
    <>
      <PageHeader
        kicker="OVERVIEW"
        title="Overview"
        subtitle="Your roster at a glance — follower growth, posting cadence, and engagement across all accounts."
        hue={PORTAL_HUES.overview}
        icon="Ov"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accounts" value="—" icon="Ac" hue={PORTAL_HUES.accounts} caption="managed handles" />
        <StatCard
          label="30d follower growth"
          value="—"
          icon="Ov"
          hue={PORTAL_HUES.overview}
          caption="net new followers"
        />
        <StatCard
          label="Posts published"
          value="—"
          icon="Lb"
          hue={PORTAL_HUES.library}
          caption="last 30 days"
        />
        <StatCard
          label="Engagement rate"
          value="—"
          icon="In"
          hue={PORTAL_HUES.insights}
          caption="7d average"
        />
      </div>
    </>
  );
}
