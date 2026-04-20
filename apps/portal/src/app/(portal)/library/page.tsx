import { Button, EmptyState, PageHeader, PORTAL_HUES } from '@xcrm/ui';

export default function PortalLibrary() {
  return (
    <>
      <PageHeader
        kicker="CONTENT LIBRARY"
        title="Content Library"
        subtitle="Per-model tabs with runway badges (§3.3.2). Upload assets; ops generates captions."
        hue={PORTAL_HUES.library}
        icon="Lb"
        actions={<Button size="sm" hue={PORTAL_HUES.library}>Upload assets</Button>}
      />
      <EmptyState
        hue={PORTAL_HUES.library}
        icon="Lb"
        title="Library is empty"
        description="Upload photos and videos to build runway for each model."
      />
    </>
  );
}
