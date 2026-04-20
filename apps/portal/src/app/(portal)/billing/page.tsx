import { EmptyState, PageHeader, PORTAL_HUES } from '@xcrm/ui';

export default function PortalBilling() {
  return (
    <>
      <PageHeader
        kicker="BILLING"
        title="Billing"
        subtitle="Monthly invoice, payment method, and contract info."
        hue={PORTAL_HUES.billing}
        icon="Bl"
      />
      <EmptyState
        hue={PORTAL_HUES.billing}
        icon="Bl"
        title="No invoices yet"
        description="Your first invoice drops on the 1st of next month."
      />
    </>
  );
}
