/**
 * Pure spacing logic for Build H (camps).
 *
 * The candidate-asset loader feeds rows from "live" Posts on this
 * account's camp-mates; this module decides which assets fall
 * inside the spacing window and should therefore be excluded from
 * the target account's pool.
 *
 * Window is symmetric around `now`: an asset is blocked when its
 * scheduledFor (or postedAt as fallback) is within
 * ±CAMP_ASSET_SPACING_HOURS of now. That covers both "we just
 * posted this on a camp-mate" and "a camp-mate has it scheduled
 * imminently".
 */

export const CAMP_ASSET_SPACING_HOURS = 72;

export type CampMatePostRow = {
  assetId: string;
  scheduledFor: Date | null;
  postedAt: Date | null;
};

export function assetsBlockedByCampMates(
  rows: CampMatePostRow[],
  now: Date = new Date(),
  spacingHours: number = CAMP_ASSET_SPACING_HOURS,
): Set<string> {
  const spacingMs = spacingHours * 60 * 60 * 1000;
  const nowMs = now.getTime();
  const blocked = new Set<string>();

  for (const r of rows) {
    const ts = (r.postedAt ?? r.scheduledFor)?.getTime();
    if (ts === undefined) continue;
    if (Math.abs(ts - nowMs) <= spacingMs) {
      blocked.add(r.assetId);
    }
  }
  return blocked;
}
