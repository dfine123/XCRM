import { EmptyState, OPS_HUES, PageHeader } from '@xcrm/ui';

export default function DevicesPage() {
  return (
    <>
      <PageHeader
        kicker="DEVICES"
        title="Devices"
        subtitle="Phone farm status and the account-to-device assignment matrix."
        hue={OPS_HUES.devices}
        icon="Dv"
      />
      <EmptyState
        hue={OPS_HUES.devices}
        icon="Dv"
        title="No devices registered"
        description="Register a phone to bind it to accounts."
      />
    </>
  );
}
