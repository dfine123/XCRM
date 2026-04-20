import { Button, EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function VAsPage() {
  return (
    <>
      <PageHeader
        kicker="VAS"
        title="Virtual Assistants"
        subtitle="Roster, accuracy leaderboard, and the sample review queue ship in Phase 1."
        hue={OPS_HUES.vas}
        icon="VA"
        actions={<Button size="sm" hue={OPS_HUES.vas}>Invite VA</Button>}
      />
      <EmptyState
        hue={OPS_HUES.vas}
        icon="VA"
        title="No VAs on the roster"
        description="Invite the first VA to start seeding the leaderboard."
      />
    </>
  );
}
