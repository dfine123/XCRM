# Build G plan — Engagement ingest + learning loop

## Context

Per `/docs/operational-model.md` "G. Engagement ingest — pulls
engagement data from X (API or scraping fallback). Feeds the
generator's learning loop." Build G closes the feedback half of the
v1 loop: posts go out (Build F), engagement comes back (G), the
generator gets smarter on the next run (D, with G's data).

## Realistic v1 scope

Real X API access is non-trivial (paid tier, OAuth, rate limits) and
scraping is messier still. v1 ships everything **except** the wire
protocol to X:

- **Schema usage** — `PostEngagement` already exists.
- **Ingest endpoint** — `POST /api/engagement/ingest` receives metrics
  for a given `platformPostId` (or `Post.id`) + auth via `CRON_SECRET`.
  This is the seam: when API/scraping integration lands, that
  integration just hits this endpoint. The endpoint itself is
  source-agnostic.
- **Manual entry UI** — operator can paste numbers into a form for
  any POSTED post. Stop-gap, low-friction, lives on `/console/engagement`
  + on the model-detail `#scheduled` block for POSTED rows.
- **Aggregation library** — pure functions that turn engagement
  history into signals (per-account peak hours, per-aesthetic
  average, etc.). Unit-tested.
- **Account peak-hour learning** — cron (`*/30 * * * *` default)
  reads each account's last-N-days of engagement, recomputes the
  top-engagement hours, writes `Account.peakHours`. Build D's
  scheduler already reads `peakHours` — it'll start using real
  data the moment any rows exist.
- **Generator prompt integration** — `buildDraftPostUserPrompt`
  gains an "Engagement insights" section: top-performing
  `aesthetic` / `mood` / `lighting` for this account in the recent
  window, with average engagement per impression. The LLM uses
  this as a soft signal alongside context notes.

## What v1 does NOT include

- **No X API client.** That's a follow-up. The seam is the
  `/api/engagement/ingest` endpoint.
- **No scraping client.** Same.
- **No engagement-driven cadence tuning.** Build D currently uses a
  fixed `DEFAULT_CADENCE_PER_DAY = 3`; engagement data could one day
  drive per-account cadence but that's its own sub-build.
- **No per-formula tuning.** `ContentFormula.timeOfDayWeights` exists
  but only Build I or wherever formulas come alive uses it.
- **No "stale engagement" roster signal.** With no real data flowing
  yet, that pill would be perpetually yellow and add noise.
- **No `Insights`-table generation.** That's a separate phase
  (Insights pipeline in the broader spec).

## Schema impact

**None.** `PostEngagement` exists. `Account.peakHours` exists. We're
populating tables that have been waiting.

## Component inventory

### New (backend)
- `apps/ops/src/lib/engagement-aggregation.ts` + `.test.ts` — pure
  functions:
  - `summarisePostEngagement(posts) → { byAesthetic, byMood, byLighting, byHour }`
  - `derivePeakHours(samples, k = 4) → number[]` — picks the top-k
    UTC hours by total engagement, dedupes, sorts ascending.
  - `latestEngagement(post) → PostEngagement | null` — most recent
    snapshot per post.
- `apps/ops/src/app/api/engagement/ingest/route.ts` — `POST`,
  CRON_SECRET-gated. Body: `{ postId | platformPostId, likes,
  reposts, replies, bookmarks, impressions, profileClicks, capturedAt? }`.
  Validates with zod, resolves the Post, inserts a PostEngagement
  snapshot. Returns `{ ok, engagementId }`. Fully replaceable when a
  real ingestor lands.
- `apps/ops/src/app/api/engagement/recompute-peak-hours/cron/route.ts`
  — `POST`, CRON_SECRET-gated. Iterates eligible accounts, calls
  the aggregation lib, writes back `Account.peakHours`.
- `apps/ops/src/services/recompute-peak-hours.ts` — the
  orchestrator the cron route calls; testable directly.
- `apps/ops/src/app/console/engagement/actions.ts` — server action
  `recordEngagement` for the manual form.
- `apps/ops/src/app/console/_loaders/engagement-pending.ts` —
  `getPostsNeedingEngagement()` for the operator-facing list.

### Updated
- `apps/ops/src/services/generate-draft.ts` — load engagement
  summary for the account, pass into the user prompt.
- `packages/shared/src/prompts/draft-post.ts` — extend the prompt
  shape with an `engagement` field; render "Engagement insights"
  block when present.
- `apps/ops/src/instrumentation.ts` — register the
  `recompute-peak-hours` cron (default `*/30 * * * *`).
- `infra/env/.env.example` — `ENGAGEMENT_PEAK_RECOMPUTE_CRON`.

### New UI
- `apps/ops/src/app/console/engagement/page.tsx` — list of
  POSTED posts with no engagement OR oldest engagement > 6h ago,
  newest first. Each row is a quick-entry form.
- `apps/ops/src/app/console/engagement/_components/engagement-form.tsx`
  — inline form: 6 number inputs + submit. `useFormState` for the
  mutation.
- `apps/ops/src/app/console/models/[id]/_components/log-engagement-button.tsx`
  — surfaced beside POSTED rows in the `#scheduled` block. Opens the
  same form inline.

### Not changed
- Build D scheduler reads `Account.peakHours` already; nothing to
  change there. When peak-hours go from `[]` (default fallback) to
  real values, the next scheduler call picks them up.

## Aggregation algorithm

`derivePeakHours(samples, k = 4)`:
1. Group samples by `Post.scheduledFor.getUTCHours()` (the hour the
   post was scheduled — proxy for "when it went up").
2. For each hour bucket, sum a weighted score:
   `likes * 1 + reposts * 3 + replies * 2 + bookmarks * 2 + (impressions ? 0 : profileClicks * 0.5)`.
   Tunable; pinned in tests.
3. Sort hours by score desc, take top `k`, sort ascending.
4. If fewer than `k` hours have any signal, fall back to merging
   `DEFAULT_PEAK_HOURS = [9, 12, 18, 21]` until we have `k` distinct
   values.

`summarisePost*` functions group + average `(likes + reposts*3 +
replies*2) / max(impressions, 1)` to surface a "performance per view"
score per facet.

## Recompute cadence

Per-account peak-hour recompute every 30 minutes is generous — the
underlying engagement data updates much slower than that, but the
cron is cheap (one query per active account). Tunable via
`ENGAGEMENT_PEAK_RECOMPUTE_CRON`.

Eligibility: `Account.status ∈ ACTIVE_*`, `deletedAt IS NULL`,
**at least 5 PostEngagement samples in the last 30 days**. Below the
threshold we leave `peakHours` untouched (the scheduler's defaults
keep working).

## Generator prompt addition

New section in `buildDraftPostUserPrompt`:

```
## Engagement insights (last 30 days, last snapshot per post)
Top aesthetics: clean-girl (avg eng/imp 4.2%), cottagecore (3.7%)
Top moods: confident (3.9%), playful (3.5%)
Best UTC hours: 12, 18, 21
(if no data: "(no engagement data yet; running on baseline signals.)")
```

Soft signal — the system prompt's calibration text reminds the LLM
that engagement is one input among many, not a hard rule.

## Verification

Tests:
- `engagement-aggregation.test.ts` — every function with fixture
  arrays. Edge cases: empty input, all-zero metrics, ties broken
  deterministically, fewer-than-k hours, fallback merge with
  defaults.
- `engagement/actions.test.ts` — recordEngagement validates +
  inserts snapshot.
- `recompute-peak-hours.test.ts` — orchestrator picks eligible
  accounts, writes peakHours, skips below-threshold ones.

Manual smoke after deploy:
1. Mark a few Posts POSTED via the runner.
2. Visit `/console/engagement` → list shows them with empty engagement.
3. Type some numbers, submit → row updates with the snapshot.
4. After a few snapshots: trigger
   `POST /api/engagement/recompute-peak-hours/cron` →
   `Account.peakHours` populates with the top-engagement hours.
5. Click "Generate draft" on the model detail → orchestrator log
   shows the engagement-insights section in the prompt.

## Anti-goals — explicitly NOT in G

- No X API integration / scraping.
- No engagement-driven cadence tuning (Build D's per-day cap stays
  fixed at 3).
- No engagement-derived signal lights on the roster.
- No bulk-edit / undo / per-snapshot history UI — operators see
  the latest snapshot; per-snapshot inspection is deferred.
- No `ContentFormula` integration.
- No per-asset performance UI on the asset detail page (it's
  computable but the data won't be meaningful until a real
  ingestor is wired).

## Commit plan

Three chunks:
1. **Backend** — aggregation lib + tests, ingest API route,
   recompute orchestrator + cron route + instrumentation
   registration, server action for manual entry.
2. **UI** — `/console/engagement` page + form, model-detail
   log-engagement button on POSTED rows.
3. **Generator integration** — extend prompt + orchestrator to
   include engagement insights; changelog entry.
