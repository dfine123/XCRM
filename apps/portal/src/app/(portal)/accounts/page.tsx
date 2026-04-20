import { EmptyState, PageHeader, PORTAL_HUES } from '@xcrm/ui';

export default function PortalAccounts() {
  return (
    <>
      <PageHeader
        kicker="ACCOUNTS"
        title="Accounts"
        subtitle="Your managed X handles, their posting cadence, and live runway."
        hue={PORTAL_HUES.accounts}
        icon="Ac"
      />
      <EmptyState
        hue={PORTAL_HUES.accounts}
        icon="Ac"
        title="No accounts yet"
        description="Your ops team wires accounts to your agency during onboarding."
      />
    </>
  );
}
