import { Button, EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function AgenciesPage() {
  return (
    <>
      <PageHeader
        kicker="AGENCIES"
        title="Agencies"
        subtitle="Prospect → active → paused → churned. Partner accounts, monthly fee, and portal access live here once CRUD lands in Phase 1."
        hue={OPS_HUES.agencies}
        icon="Ag"
        actions={<Button size="sm" hue={OPS_HUES.agencies}>New agency</Button>}
      />
      <EmptyState
        hue={OPS_HUES.agencies}
        icon="Ag"
        title="No agencies yet"
        description="Seed data surfaces here once the founder tools and partner invite flow ship."
      />
    </>
  );
}
