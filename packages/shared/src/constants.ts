/**
 * Global constants. Product name lives here as a single var (spec §0 meta).
 * Swap PRODUCT_NAME once the real name is picked.
 */
export const PRODUCT_NAME = 'camp';
export const PRODUCT_TAGLINE = 'X management CRM';

export const CAMP_SIZE = 5;
export const CAMP_PAIRING_LOOKBACK_DAYS = 60;
export const CAMP_PAIRING_RECENT_PENALTY_DAYS = 30;

export const ASSET_REUSE_COOLDOWN_DAYS = 7;

export const DEFAULT_CONFIDENCE_THRESHOLDS: Record<string, number> = {
  FRESH_BUILD: 2, // never auto-approve
  ACTIVE_RAMPING: 0.85,
  ACTIVE_ESTABLISHED: 0.78,
  ACTIVE_MATURE: 0.7,
};

export const VA_DEFAULT_TASKS_PER_DAY: Record<'VA_T1' | 'VA_T2' | 'VA_T3', number> = {
  VA_T1: 80,
  VA_T2: 40,
  VA_T3: 60,
};

export const RUNWAY_COLOR_THRESHOLDS = {
  RED_DAYS: 7,
  YELLOW_DAYS: 14,
} as const;

export const CAMP_AUTO_ACTIVATE_HOUR_UTC = 20; // Sunday 8pm operator-TZ, mapped in scheduler
