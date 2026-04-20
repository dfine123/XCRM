import { EmptyState, PageHeader, PORTAL_HUES } from '@xcrm/ui';

export default function PortalInsights() {
  return (
    <>
      <PageHeader
        kicker="INSIGHTS"
        title="Insights"
        subtitle="Screenshot-ready, plain-language cards you can forward to your model (§3.3.4)."
        hue={PORTAL_HUES.insights}
        icon="In"
      />
      <EmptyState
        hue={PORTAL_HUES.insights}
        icon="In"
        title="No insights yet"
        description="Insights arrive after the nightly pipeline approves candidates."
      />
    </>
  );
}
