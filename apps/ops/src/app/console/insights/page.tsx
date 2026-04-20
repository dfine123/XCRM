import { EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function InsightsPage() {
  return (
    <>
      <PageHeader
        kicker="INSIGHTS"
        title="Insights"
        subtitle="Nightly candidate queue. Promote to influence generation weights. Demote to archive."
        hue={OPS_HUES.insights}
        icon="In"
      />
      <EmptyState
        hue={OPS_HUES.insights}
        icon="In"
        title="No candidates tonight"
        description="The insight pipeline drops candidates here after the nightly batch."
      />
    </>
  );
}
