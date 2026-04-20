import { Button, EmptyState, PageHeader, PORTAL_HUES } from '@xcrm/ui';

export default function PortalRequests() {
  return (
    <>
      <PageHeader
        kicker="REQUESTS"
        title="Content Requests"
        subtitle="Each request links back to the insight that prompted it (§3.3.3)."
        hue={PORTAL_HUES.requests}
        icon="Rq"
        actions={<Button size="sm" hue={PORTAL_HUES.requests}>New request</Button>}
      />
      <EmptyState
        hue={PORTAL_HUES.requests}
        icon="Rq"
        title="No open requests"
        description="Insights that need fresh content will surface a request here."
      />
    </>
  );
}
