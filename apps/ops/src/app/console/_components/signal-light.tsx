import { Tag, type Hue } from '@xcrm/ui';
import type { SignalLightState } from '@/lib/signal-lights';

/**
 * One signal pill on the Roster row.
 *
 * Hue map matches the OKLCH rainbow elsewhere in the app:
 *   RED     → 25  (accounts hue — alarm tone)
 *   YELLOW  → 60  (camps hue — warning tone)
 *   GREEN   → 135 (content hue — healthy tone)
 *   NEUTRAL → null (Tag renders gray, count only)
 *   STUB    → not rendered at all
 *
 * Count-only pills (review queue) pass `count` in addition to state.
 */
const STATE_HUE: Record<SignalLightState, Hue> = {
  RED: 25,
  YELLOW: 60,
  GREEN: 135,
  NEUTRAL: null,
  STUB: null,
};

export function SignalLight({
  state,
  label,
  count,
  title,
}: {
  state: SignalLightState;
  label: string;
  count?: number;
  title?: string;
}) {
  if (state === 'STUB') return null;

  const text = typeof count === 'number' ? `${label} ${count}` : label;

  return (
    <span title={title}>
      <Tag hue={STATE_HUE[state]} size="sm">
        {text}
      </Tag>
    </span>
  );
}
