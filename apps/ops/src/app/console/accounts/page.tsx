import { Button, EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function AccountsPage() {
  return (
    <>
      <PageHeader
        kicker="ACCOUNTS"
        title="Accounts"
        subtitle="Status state machine enforced server-side. Filter by status, agency, archetype, and device in Phase 1."
        hue={OPS_HUES.accounts}
        icon="Ac"
        actions={<Button size="sm" hue={OPS_HUES.accounts}>New account</Button>}
      />
      <EmptyState
        hue={OPS_HUES.accounts}
        icon="Ac"
        title="No accounts yet"
        description="Account rows land here once the scheduler and device binding go live."
      />
    </>
  );
}
