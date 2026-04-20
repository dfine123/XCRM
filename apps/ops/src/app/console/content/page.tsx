import { EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function ContentPage() {
  return (
    <>
      <PageHeader
        kicker="CONTENT"
        title="Content"
        subtitle="Asset library and per-model runway. Upload lives in the agency portal."
        hue={OPS_HUES.content}
        icon="Co"
      />
      <EmptyState
        hue={OPS_HUES.content}
        icon="Co"
        title="Library is empty"
        description="Assets appear here as partners upload them from the portal."
      />
    </>
  );
}
