import { EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function FormulaPage() {
  return (
    <>
      <PageHeader
        kicker="FORMULA"
        title="Content Formula"
        subtitle="Versioned, never mutated. New version = new row (§0.3 rule 6)."
        hue={OPS_HUES.formula}
        icon="Fo"
      />
      <EmptyState
        hue={OPS_HUES.formula}
        icon="Fo"
        title="No formula versions yet"
        description="Draft a formula to begin — previous versions remain immutable."
      />
    </>
  );
}
