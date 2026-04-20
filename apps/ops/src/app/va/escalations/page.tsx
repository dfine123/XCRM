import { EmptyState, PageHeader, VA_HUES } from '@xcrm/ui';

export default function VAEscalationsPage() {
  return (
    <>
      <PageHeader
        kicker="ESCALATIONS"
        title="Escalations"
        subtitle="Tasks you've flagged, awaiting partner resolution."
        hue={VA_HUES.escalations}
        icon="Es"
      />
      <EmptyState
        hue={VA_HUES.escalations}
        icon="Es"
        title="No open escalations"
        description="Flagged tasks appear here until a partner resolves them."
      />
    </>
  );
}
