import { EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function ContextNotesPage() {
  return (
    <>
      <PageHeader
        kicker="CONTEXT NOTES"
        title="Context Notes"
        subtitle="Weighted signals injected into generation context. Partner notes surface here for triage."
        hue={OPS_HUES['context-notes']}
        icon="Ct"
      />
      <EmptyState
        hue={OPS_HUES['context-notes']}
        icon="Ct"
        title="No notes in the queue"
        description="New partner notes land here for review before influencing weights."
      />
    </>
  );
}
