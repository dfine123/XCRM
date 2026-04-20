import { EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function CampsPage() {
  return (
    <>
      <PageHeader
        kicker="CAMPS"
        title="Camps"
        subtitle="Composition runs Sunday 09:00 UTC; auto-activates Sunday 20:00 if unapproved (§2.4.3)."
        hue={OPS_HUES.camps}
        icon="Ca"
      />
      <EmptyState
        hue={OPS_HUES.camps}
        icon="Ca"
        title="No camps awaiting approval"
        description="The weekly composer will drop drafts here every Sunday."
      />
    </>
  );
}
