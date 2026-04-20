/**
 * Section hues. Every hue is oklch(72% 0.17 h) — fixed lightness,
 * fixed chroma, only the hue angle changes. That's the contract:
 * no section visually outranks another.
 *
 * Hue is identity, not decoration. It appears on: icon chip, active
 * nav accent bar, card top strip, focus ring, and tag pill. Never
 * as a fill. If you catch yourself tinting a whole surface with a
 * section hue, stop — rework the affordance.
 *
 * Section → hue mapping lives here so all surfaces agree. To add a
 * new section, pick a 30°+ gap from the nearest neighbor.
 */

export const OPS_HUES = {
  dashboard: null,
  agencies: 250,
  models: 290,
  accounts: 25,
  camps: 60,
  content: 135,
  formula: 170,
  'context-notes': 210,
  insights: 320,
  vas: 100,
  devices: 200,
  settings: null,
} as const;

export const VA_HUES = {
  today: 100,
  batch: 60,
  escalations: 25,
  stats: 320,
} as const;

export const PORTAL_HUES = {
  overview: 250,
  accounts: 25,
  library: 135,
  requests: 60,
  insights: 320,
  billing: 170,
  settings: null,
} as const;

export type Hue = number | null | undefined;

export function hue(h: Hue, alpha = 1): string | undefined {
  if (h === null || h === undefined) return undefined;
  return `oklch(72% 0.17 ${h} / ${alpha})`;
}

export function hueMuted(h: Hue): string | undefined {
  if (h === null || h === undefined) return undefined;
  return `oklch(72% 0.17 ${h} / 0.08)`;
}

export function hueGlow(h: Hue): string | undefined {
  if (h === null || h === undefined) return undefined;
  return `oklch(72% 0.17 ${h} / 0.28)`;
}
