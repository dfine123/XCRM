import { z } from 'zod';
import { Archetype } from '@xcrm/db';

/**
 * Scope discriminator for ContextNote.
 *
 * Stored in `ContextNote.scope` (Json column). Three cases for MVP —
 * adding a fourth is additive without a schema migration since the
 * column is already Json. Keep the kinds uppercase to match the rest
 * of the codebase's enum convention even though they aren't actual
 * Prisma enums.
 */
export const ScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ALL') }),
  z.object({
    kind: z.literal('ARCHETYPES'),
    archetypes: z.array(z.nativeEnum(Archetype)).min(1),
  }),
  z.object({
    kind: z.literal('ACCOUNTS'),
    accountIds: z.array(z.string().min(1)).min(1),
  }),
]);

export type Scope = z.infer<typeof ScopeSchema>;

/**
 * Duration keys map to a concrete `effectiveUntil` via {@link durationToEffectiveUntil}.
 * `UNTIL_REMOVED` is the only value that produces a null — notes with
 * no `effectiveUntil` persist until operator-cancelled.
 */
export const DurationKey = z.enum(['TODAY', 'THREE_DAYS', 'ONE_WEEK', 'UNTIL_REMOVED']);
export type DurationKeyT = z.infer<typeof DurationKey>;

export function durationToEffectiveUntil(
  key: DurationKeyT,
  now: Date = new Date(),
): Date | null {
  switch (key) {
    case 'TODAY': {
      // End of the current local day. The operator's intent is "just
      // today", not "24h from now".
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'THREE_DAYS':
      return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    case 'ONE_WEEK':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'UNTIL_REMOVED':
      return null;
  }
}

/**
 * Does a scope apply to a given model?
 *
 * The model passes in as a shape rather than a Prisma row so we can
 * unit-test without a DB and so callers can compose the check against
 * either the full model (with accounts loaded) or a stripped-down
 * projection. Pass empty `accountIds` for models with no accounts yet.
 */
export function noteAppliesTo(
  scope: Scope,
  model: { archetype: Archetype; accountIds: string[] },
): boolean {
  switch (scope.kind) {
    case 'ALL':
      return true;
    case 'ARCHETYPES':
      return scope.archetypes.includes(model.archetype);
    case 'ACCOUNTS':
      return model.accountIds.some((id) => scope.accountIds.includes(id));
  }
}

/**
 * Parse a raw Json value (from the DB column) into a typed Scope.
 * Tolerates malformed shapes by falling back to `{ kind: 'ALL' }` so
 * a bad historical row doesn't crash the roster render. Logs a warning
 * so we see it.
 */
export function parseScope(raw: unknown): Scope {
  const parsed = ScopeSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  console.warn('[context-notes] unrecognized scope shape, falling back to ALL:', raw);
  return { kind: 'ALL' };
}

/**
 * Human copy for the scope in the note-list row. Kept short so the
 * roster strip stays one-line-per-note.
 */
export function formatScope(scope: Scope): string {
  switch (scope.kind) {
    case 'ALL':
      return 'all models';
    case 'ARCHETYPES':
      return scope.archetypes.length === 1
        ? `archetype ${scope.archetypes[0]!.toLowerCase().replace(/_/g, ' ')}`
        : `${scope.archetypes.length} archetypes`;
    case 'ACCOUNTS':
      return scope.accountIds.length === 1
        ? '1 account'
        : `${scope.accountIds.length} accounts`;
  }
}

/**
 * "expires in 2d 4h" / "expires just now" / "until removed". Server-side
 * format so it doesn't require a client hydration boundary for every
 * note row.
 */
export function formatRemainingTime(
  effectiveUntil: Date | null,
  now: Date = new Date(),
): string {
  if (effectiveUntil === null) return 'until removed';
  const diffMs = effectiveUntil.getTime() - now.getTime();
  if (diffMs <= 0) return 'expired';
  const totalMins = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `expires in ${days}d ${hours}h`;
  if (hours > 0) return `expires in ${hours}h ${mins}m`;
  if (mins > 0) return `expires in ${mins}m`;
  return 'expires in <1m';
}
