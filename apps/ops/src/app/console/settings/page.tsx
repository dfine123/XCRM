import { EmptyState, PageHeader } from '@xcrm/ui';

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        kicker="SETTINGS"
        title="Settings"
        subtitle="Ops configuration — feature flags, scheduler controls, and partner defaults."
      />
      <EmptyState
        title="Nothing to configure yet"
        description="Configurable knobs land here as features come online."
      />
    </>
  );
}
