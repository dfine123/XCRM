import { EmptyState, PageHeader } from '@xcrm/ui';

export default function PortalSettings() {
  return (
    <>
      <PageHeader
        kicker="SETTINGS"
        title="Settings"
        subtitle="Team management, notification preferences, and workspace defaults."
      />
      <EmptyState
        title="Nothing to configure yet"
        description="Your ops partner controls workspace-level defaults during Phase 0."
      />
    </>
  );
}
