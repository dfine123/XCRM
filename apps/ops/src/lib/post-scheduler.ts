/**
 * Post scheduler — pure logic.
 *
 * Per `/docs/operational-model.md`, generation and scheduling are
 * deliberately separate concerns. The LLM produces
 * {copy, assetId, confidence, reasoning} with no temporal reasoning.
 * This module takes that draft and picks `scheduledFor` based on:
 *   - account peak hours (hour-of-day integers 0..23)
 *   - minimum spacing between scheduled posts
 *   - existing scheduled posts for the same account
 *
 * v1 deliberately omits: per-account timezones (schedules in UTC),
 * cadence-per-day enforcement (we run at most once per cron tick per
 * account), and camp repost coordination (Build H).
 *
 * Returns `null` if no slot in the next 72h satisfies the constraints —
 * the caller then skips writing a row.
 */

export const DEFAULT_PEAK_HOURS = [9, 12, 18, 21];
export const SPACING_HOURS = 3;
const HORIZON_HOURS = 72;

export function pickScheduledTime(input: {
  peakHours: number[];
  existingScheduled: Date[];
  now?: Date;
}): Date | null {
  const now = input.now ?? new Date();
  const peaks = effectivePeakHours(input.peakHours);
  const occupied = [...input.existingScheduled].sort(
    (a, b) => a.getTime() - b.getTime(),
  );

  // Walk forward hour-by-hour from the next full hour, in UTC, until
  // we either find a peak-hour slot that is >= SPACING_HOURS from
  // every existing scheduled time OR exhaust the horizon.
  const cursor = new Date(now);
  cursor.setUTCMinutes(0, 0, 0);
  cursor.setUTCHours(cursor.getUTCHours() + 1);

  for (let h = 0; h < HORIZON_HOURS; h++) {
    if (peaks.includes(cursor.getUTCHours())) {
      if (clearFromAll(cursor, occupied, SPACING_HOURS)) {
        return new Date(cursor);
      }
    }
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }
  return null;
}

function effectivePeakHours(raw: number[]): number[] {
  const clean = Array.from(
    new Set(
      raw.filter((h) => Number.isInteger(h) && h >= 0 && h <= 23),
    ),
  ).sort((a, b) => a - b);
  return clean.length > 0 ? clean : DEFAULT_PEAK_HOURS;
}

function clearFromAll(
  slot: Date,
  occupied: Date[],
  spacingHours: number,
): boolean {
  const spacingMs = spacingHours * 60 * 60 * 1000;
  for (const o of occupied) {
    if (Math.abs(o.getTime() - slot.getTime()) < spacingMs) return false;
  }
  return true;
}
