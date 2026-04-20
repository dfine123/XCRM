import { Button, EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function ModelsPage() {
  return (
    <>
      <PageHeader
        kicker="MODELS"
        title="Models"
        subtitle="Real names stay internal (§1.2). Only stage identity and archetype surface beyond ops."
        hue={OPS_HUES.models}
        icon="Md"
        actions={<Button size="sm" hue={OPS_HUES.models}>New model</Button>}
      />
      <EmptyState
        hue={OPS_HUES.models}
        icon="Md"
        title="No models yet"
        description="Create a model to attach accounts, content, and archetypes."
      />
    </>
  );
}
