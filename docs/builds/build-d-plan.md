# Build D plan — Generation loop v1

## Context

Per `/docs/operational-model.md` "The generation loop (autonomous)".
This is the single most load-bearing build — it's what makes the system
actually run itself. Every prior build exists to feed this one: Build A
creates the model, B shapes the observability, C injects steering.

Scope is **v1**: one run per account per cron tick, one draft per run.
No engagement learning, no camps, no VA task creation. Produce a draft,
schedule it, route it by confidence, write it to the DB. The review
queue **UI** (Build E) is separate; D produces rows for E to render.

## What Build D ships end-to-end

1. Recurring cron (default every 4h) iterates active accounts.
2. For each, the orchestrator pulls: model profile + account state +
   active context notes (scoped) + candidate asset pool.
3. LLM call returns strictly `{ copy, assetId, confidence, reasoning }`.
4. Deterministic scheduler picks `scheduledFor`.
5. Confidence + account status decide `SCHEDULED` vs `PENDING_APPROVAL`.
6. Row written to `Post`.
7. Operator sees it on Surface 3 `#scheduled` block + the Runway /
   Review-queue signal lights on the Roster go from STUB to live.

## Off-spec carryover resolutions (per /docs/operational-model.md)

These items landed between A and B without a spec home. D is their
natural home — decisions locked in here:

- **Vision schema v2 (caption + mood + lighting + palette + …).**
  **Kept.** The `caption` field is what the generator feeds to Claude
  as retrieval-quality asset metadata — the whole reason we added it.
  Mood + lighting + aesthetic also go into the prompt so Claude can
  match tone to theme.
- **Novelty score.** **Kept.** Used to pre-rank the candidate pool
  before it reaches Claude (top 30 by novelty), so the prompt doesn't
  balloon with hundreds of similar assets.
- **Asset detail Signals + Caption cards.** **Kept as-is.** Operators
  want to see what Claude will see.

Followup commit will trim the "Off-spec carryovers" section of the
operational-model doc to reflect these adoptions.

## Schema impact

**No migrations.** `PostStatus`, `Post.confidenceScore`,
`Post.generationMeta`, `Post.assetIds`, `AssetUsage`, `Account.peakHours`
already exist.

## Data flow

```
cron tick
  └─ for each Account { status ∈ ACTIVE_*, deletedAt: null } :
       generateDraftForAccount(accountId)
         ├─ load model (voice, rules, prefs, archetype)
         ├─ load account (handle, status, peakHours)
         ├─ load active notes via getActiveNotes() + filter by scope
         ├─ pull candidate assets (see below)
         ├─ call LLM → { copy, assetId, confidence, reasoning }
         ├─ pickScheduledTime({ account, existingScheduled })
         ├─ decide status: needsReview(status, confidence)
         │      true  → PENDING_APPROVAL
         │      false → SCHEDULED
         └─ prisma.post.create({ ... })
```

### Candidate asset predicate
```
ContentAsset where:
  modelId              = account.modelId
  deletedAt            IS NULL
  tagStatus            = 'TAGGED'
  type                 IN ('PHOTO','GIF')   // VIDEO deferred
  usages               { none: { accountId: account.id } }
  // NOT already committed to a live/pending Post for this account:
  id NOT IN (Post{accountId, status ∈ PENDING_APPROVAL|APPROVED|SCHEDULED, deletedAt null}.assetIds flatten)
```
Then sort by `computeNoveltyScore` desc, take top 30.

### Scheduler (pure logic)
`apps/ops/src/lib/post-scheduler.ts`

Inputs:
- `account.peakHours: number[]` (fallback default `[9, 12, 18, 21]` when empty)
- list of existing `Post.scheduledFor` for this account in the next 72h
- `now: Date` (injectable for tests)

Output: a `Date` within the next 72h that:
- Is a peak-hour slot (on the wall clock in the account's "operator
  local" — for v1 we use UTC; per-account timezone is a future
  refinement since `Account` has no `timezone` field yet).
- Is at least `SPACING_HOURS = 3` after every existing scheduled time.
- If no slot fits within 72h, returns `null` (caller skips writing).

Unit-tested cases: empty peakHours, no existing posts, all slots
taken within 24h, midnight rollover.

### Confidence routing
`apps/ops/src/lib/confidence-routing.ts`

```
FRESH_BUILD, ACQUIRED_IN_NICHE, TAKEOVER → always PENDING_APPROVAL
ACTIVE_RAMPING                            → PENDING_APPROVAL if confidence < 0.8
ACTIVE_ESTABLISHED                        → PENDING_APPROVAL if confidence < 0.7
ACTIVE_MATURE                             → PENDING_APPROVAL if confidence < 0.6
PAUSED, OFFBOARDING, ARCHIVED, QUARANTINED, PROSPECT → skip generation
```
Unit-tested boundary cases.

## Component inventory

### New — backend (chunk 1)
- `packages/shared/src/prompts/draft-post.ts` — prompt template fn.
- `packages/ai/src/draft-post.ts` — `draftPost(input) → DraftResult`.
- `packages/ai/src/draft-post.test.ts`.
- `packages/ai/src/types.ts` — export `DraftResult` zod schema.
- `apps/ops/src/lib/post-scheduler.ts` + `.test.ts`.
- `apps/ops/src/lib/confidence-routing.ts` + `.test.ts`.

### New — orchestrator + cron (chunk 2)
- `apps/ops/src/services/generate-draft.ts` — orchestrator.
  Exposes `generateDraftForAccount(accountId, opts?)` used by both the
  cron and the manual trigger.
- `apps/ops/src/app/api/generate/cron/route.ts` — CRON_SECRET-gated.
- `apps/ops/src/app/api/generate/[accountId]/route.ts` — session-gated
  manual trigger (FOUNDER | PARTNER).
- `apps/ops/src/instrumentation.ts` — register third cron alongside
  drive-sync and context-notes-expire.
- `apps/ops/src/app/console/_loaders/candidate-assets.ts` — shared
  candidate-pool query.

### New — UI (chunk 3)
- `apps/ops/src/app/console/models/[id]/_components/generate-draft-button.tsx`
  — client button that POSTs the manual endpoint.
- `apps/ops/src/app/console/_loaders/scheduled-posts.ts` — pulls the
  next N scheduled + pending posts for a model.

### Updated
- `apps/ops/src/app/console/models/[id]/page.tsx` — `#scheduled` block
  goes from stub to real list (scheduled + pending-approval, newest
  first, 10 cap), header includes the "Generate draft" manual button.
- `apps/ops/src/lib/signal-lights.ts` — thresholds stay identical;
  just stop returning `STUB` for runway + review queue when real counts
  are in hand.
- `apps/ops/src/app/console/_loaders/roster.ts` — adds `scheduledIn14d`
  and `pendingApprovalCount` per model, passes to signal helpers.
- `apps/ops/src/lib/asset-novelty.ts` — no change needed; re-used.
- `docs/operational-model.md` — trim the "off-spec carryovers" block
  since vision-v2 + novelty are now formally adopted by D.
- `infra/env/.env.example` — `GENERATE_CRON` (default `0 */4 * * *`),
  `GENERATE_ENABLED` separate opt-in so we don't fire an LLM call
  every 4h on a preview deploy.

### Not changed
- Post model, AssetUsage model — as-is.
- ContextNote model — as-is (we read via Build C's loader).

## Prompt shape

System prompt (ephemeral-cached so repeat calls stay cheap):

```
You are a content generation assistant for a social-media ops
system. You will receive:
 - a Model profile (voice, hard rules, soft preferences, archetype)
 - an Account state (handle, status, follower count)
 - active context notes with weights
 - a pool of candidate Content Assets, each with caption + tags

Your job: pick ONE asset from the pool, write the post copy for it,
rate your own confidence.

Output STRICTLY this JSON, nothing else:
  { copy: string, assetId: string, confidence: number 0..1, reasoning: string }

Rules:
 - Obey every hard rule. If no asset can satisfy the rules, return
   confidence 0 and explain in reasoning.
 - Copy must be ≤ 280 characters.
 - No emoji, hashtags, or @mentions unless the model explicitly
   allows them in voice/tone or hard rules.
 - assetId must match exactly one of the provided asset IDs.
 - Weight active context notes proportionally — a weight-10 note
   is binding, a weight-1 note is a nudge.
```

User message is a structured rendering of the inputs. Asset list is
compact: `id · caption · mood · lighting · aesthetic · novelty`.

## Signal-light unstubbing

Roster loader adds two counts per model:
- `scheduledIn14d = count(Post where accountId in model.accounts, status=SCHEDULED, scheduledFor between now and now+14d, deletedAt null)`
- `pendingApprovalCount = count(Post where accountId in model.accounts, status=PENDING_APPROVAL, deletedAt null)`

Runway days = `scheduledIn14d / (accounts_count * DEFAULT_CADENCE_PER_DAY)` where `DEFAULT_CADENCE_PER_DAY = 3`. Thresholds stay
the same: >7d green / 3-7d yellow / <3d red. A model with no accounts
yields NaN — treat as STUB (can't compute).

Review queue pill becomes NEUTRAL with the real count when
pendingApprovalCount > 0, STUB when it's 0 AND no post rows exist yet
anywhere (so a fresh system still doesn't show "Review 0" as noise).
Actually simpler: NEUTRAL whenever pendingApprovalCount >= 0 and the
model has at least one Post in any state. Until the generator has
ever run for this model, stay STUB. This avoids empty "Review 0"
pills on day-1.

## Anti-goals — explicitly NOT in D

- **Review queue UI** — Build E. D just writes PENDING_APPROVAL rows;
  E renders the queue + approve/edit/reject.
- **VA task queue** — Build F. APPROVED/SCHEDULED posts don't produce
  Tasks yet.
- **Engagement ingest & peak-hour learning** — Build G. Peak-hour
  fallback is a hard-coded default array.
- **Camps** — Build H.
- **Actual posting** — VA runner does it. v1 just schedules the
  intent.
- **Rejected-draft negative-signal loop** — spec mentions it; we
  record `generationMeta.rejected` when Build E adds the reject action,
  but D doesn't train on it. No insights pipeline yet.
- **Asset images in the prompt** — text-only Claude call using the
  caption + tags. Cheap and deterministic. If generation quality is
  weak, revisit then.
- **Per-account timezones** — `Account` has no `timezone` column;
  v1 schedules in UTC. Timezone-awareness follows Build G.
- **Multiple drafts per run per account** — one call, one draft. If
  the scheduler returns null (no slot), skip quietly.

## Verification

Unit tests:
- `post-scheduler.test.ts` — empty peak hours, existing-post collisions,
  midnight rollover, no-slot-within-72h returns null.
- `confidence-routing.test.ts` — each account status, boundary values
  (0.79, 0.8, 0.69, 0.7, …).
- `draft-post.test.ts` — well-formed JSON parse, surrounding prose
  tolerance, schema rejection on bad confidence or missing assetId,
  cache_control on system prompt (mirrors tag-asset tests).

Manual smoke:
1. Onboard a model with one ACTIVE_ESTABLISHED account + tagged assets.
2. Click "Generate draft" on the model detail.
3. See Post row created. If confidence ≥ 0.7 → SCHEDULED, else
   PENDING_APPROVAL.
4. #scheduled block shows it with scheduledFor, confidence, reasoning.
5. Roster Runway pill flips from STUB → yellow/green as drafts
   accumulate. Review queue shows count as PENDING_APPROVAL fills.

## Commit plan

Four commits:
1. Plan doc (this file) + off-spec-carryover trim.
2. **Chunk 1** — pure logic + prompts + Claude call + unit tests.
3. **Chunk 2** — orchestrator + API routes + cron registration.
4. **Chunk 3** — `#scheduled` block real data + "Generate draft"
   button + roster signal unstubbing + changelog.
