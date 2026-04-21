# Operational model

This document is the authoritative spec for how XCRM is actually used. Every
other feature document, PRD, or UI decision yields to this one. If the spec
and this doc disagree, this doc wins and the spec gets updated.

It was written after Features 1–2 shipped, based on a reframing of the product
from "a multi-page CRM the operator drives" into "an autonomous runner with
three steering surfaces". The reframing matters enough to capture here before
any more code gets written, because it changes what home looks like, what
nav looks like, and which screens deserve craft.

## The mental model

There are two human user modes and one non-human one:

1. **Operators** — founder and partner roles. They touch the system *rarely*.
   They onboard a model once. They inject context notes when trends warrant
   it. They check health when curious. The system runs without them by
   default. If the system requires an operator to log in every morning for
   it to function, the product has failed.

2. **VAs** — executors. They live inside the checklist runner, doing tasks
   the system has produced and escalating anomalies. When the operator needs
   to execute a task themselves (e.g. a quarantine, a partner posting
   personally during a surge), they switch hats and become a VA — same UI,
   same queue.

3. **The system itself** — the third "user". Autonomously:
   - syncs content from Drive (feature 2 — done)
   - generates post drafts on a schedule
   - schedules posts
   - captures engagement
   - learns from performance
   - feeds the VA queue

The operator interface exists for the rare moments of steering, not daily
babysitting. **Autonomous-by-default is the principle that supersedes every
"dashboard" instinct.**

## Success, six months in

The operator logs in 3–4 times a week, 10 minutes each. Adds a context note
now and then. Onboards a new model when one comes in. The system has
produced thousands of posts, VAs have executed tens of thousands of tasks,
engagement data has trained the generator into something genuinely smart.

The operator never "runs" the accounts. The accounts run themselves, and
the operator tunes the runner.

## The three operator surfaces

Not pages. **Surfaces** — purposeful destinations that map to the three
rare reasons an operator returns to the app.

### Surface 1 — Onboarding (linear, once per model)

A guided flow. Steps, in order:

1. **Agency** — pick existing or create a new one.
2. **Model basics** — display name, archetype, voice/tone notes, hard rules.
3. **Accounts** — one or more. Handle, status, phone device.
4. **Drive folder** — paste URL or folder ID. Confirm the first sync starts.
5. **Review & activate**.

Target: under 10 minutes end-to-end for a new model including Drive
connection. After completing this flow, the operator does not return to
the onboarding surface for that model again.

**Save and resume.** The wizard persists incrementally — an agency created
in step 1 exists as a real row before step 2 opens. If the operator bails
mid-flow, the partially-onboarded model is not lost: it surfaces as a
signal light on the roster with a **"Resume onboarding"** action that
drops the operator back at the step they left off.

### Surface 2 — Roster (the "is everything OK?" view)

The default home after login. Checked when the operator wants to, not on
a schedule.

**Shape:** one row per model. Columns:

- Name + archetype
- Account handles with follower counts
- **Signal lights** — concrete thresholds below
- Last activity timestamp

**Signal light thresholds** (tunable later; these exist so no component
invents its own colors):

| Signal              | Green             | Yellow                                      | Red                                       |
| ------------------- | ----------------- | ------------------------------------------- | ----------------------------------------- |
| Content runway      | > 7 days          | 3–7 days                                    | < 3 days                                  |
| Escalated tasks     | 0 unresolved      | 1–2 unresolved on any of the model's accts  | 3+ unresolved                             |
| Failed syncs        | 0 in last 24h     | 1–2 in last 24h                             | 3+ consecutive                            |
| Quarantined accts   | 0                 | —                                           | any                                       |
| Incomplete onboard  | —                 | `onboardingCompletedAt IS NULL`             | —                                         |
| Review queue depth  | Count only — no color coding.                                                                            |

**Sort order:** models with red signals first, then yellow, then alphabetical.
If every model is green, the whole list is green and boring — that is the
success state. A healthy roster looks like nothing.

**Header strip:** a compact "Active notes: N" indicator, click to expand.
**Hotkey `N`** opens the note overlay directly (see the context-note
mechanic below). A full command palette (Cmd+K) is deferred to Build C at
earliest — one-shot hotkey for now, palette once there are enough verbs
to justify one.

**Click a row →** model detail.

### Surface 3 — Model detail (drill-down when something surfaces)

Per-model view. A reactive screen — operator opens it because a signal on
the roster said "look here", deals with the thing, closes it.

**Model detail is one URL** with internal sections rendered as
anchor-navigable blocks on the page (not tabs, not sub-routes): overview,
content, scheduled/recent posts, context notes, settings, audit. Density
and scroll, not navigation. The operator finds what they're looking for
by scanning vertically; anchor links in a sticky side-rail jump to the
section without a page load.

Contents:

- Account(s) status and metrics
- Content library (synced assets with tags)
- Recent posts and engagement
- Active context notes affecting this model
- Audit trail of recent changes

Actions available from here:

- Change account status
- Add / remove accounts
- Reconfigure Drive source (connect / disconnect / sync now — shipped in
  feature 2)
- Override a generated post
- Add a context note scoped to this model
- Request more content from the agency

## The context note mechanic (the steering wheel)

Context notes are the operator's lever for injecting real-world signal
into generation. They are **optional and occasional**, not mandatory.
The generator must produce great output even when zero notes are active.

### How operators invoke

Globally available via the **`N` hotkey** (single-action, no command
palette yet — palette is deferred to Build C at earliest). Opens a small
overlay, not a page. Fields:

- **Text** — the note itself. E.g. "@grok recreate me in this position is
  viral, weight heavily toward this format".
- **Scope** — all models / specific archetypes / specific accounts.
- **Weight** — 1–10 slider. How aggressively generation should incorporate it.
- **Duration** — today / 3 days / 1 week / until removed. Sets
  `effectiveUntil` accordingly.

Submit. Done.

### How the system uses them

On every generation call, the generator pulls every `ContextNote` where
`status = ACTIVE` and `effectiveFrom <= now()` and (`effectiveUntil IS NULL
OR effectiveUntil > now()`) whose scope matches the model being generated
for. Higher weight = stronger steering. When zero notes are active, the
generator runs on baseline signals (archetype, formula, engagement history).

Notes auto-expire via a recurring job flipping `status` to `EXPIRED` when
`effectiveUntil` passes. Operator does not clean up.

### Visibility

- Active scoped notes appear on each affected model's detail page.
- Roster header shows "N notes active" — click to expand inline.
- Expired notes are archived, still queryable for audit and for "did this
  note move the numbers?" analysis later.

Most days, zero notes are active. That is correct.

## The generation loop (autonomous)

Runs on a schedule (every 2–4 hours), no operator required.

For each active account, for the upcoming window:

1. Load model profile + account state + content formula for
   `(archetype, status)`.
2. Load available content assets (not used recently on this account —
   reuses the `AssetUsage.none()` predicate shipped in feature 2).
3. Load active context notes in scope.
4. Load engagement history (what's performed well).
5. **Draft generation (LLM).** Call the LLM with a structured prompt.
   Output is strictly: `{ copy, assetId, confidence, reasoning }`. The
   LLM does **not** pick scheduled time. Creative work only — no timing
   heuristics baked into the prompt, no temporal reasoning leaking into
   the model's output. Keeping these concerns separate lets us iterate
   on timing independently of prompt engineering.
6. **Scheduling (deterministic component).** A separate scheduler takes
   the draft and picks `scheduledFor` based on:
   - account **peak hours** (from engagement history per account)
   - daily **cadence** for the `(archetype, status)` formula
   - **spacing** from other items already scheduled for this account
   - eventually: **camp repost coordination** (Build H) so a shared
     asset isn't fired across multiple accounts within the same hour
   The scheduler is pure logic — no LLM call. It's testable in isolation
   and tunable without retraining prompts.
7. **Route by confidence.** Thresholds are per account status and tunable:
   - `FRESH_BUILD` → always review (building generator trust for this account)
   - `ACTIVE_RAMPING` → review if confidence < 0.8
   - `ACTIVE_ESTABLISHED` → review if confidence < 0.7
   - `ACTIVE_MATURE` → review if confidence < 0.6
   - High confidence → task queue directly
   - Medium confidence → review queue
   - Low confidence → review queue with a warning flag

Rejected drafts emit a negative signal that the generator weighs on future
runs for that account.

## The review queue

Not a daily destination. Surfaces in the roster as a signal light (e.g.
"3 posts pending review") when there's something to look at. The operator
opens it when convenient.

Per item, the queue shows:

- Model, account, scheduled time
- Generated copy + suggested asset
- Confidence score + reasoning
- Buttons: **Approve** / **Edit & Approve** / **Reject**

Approve ships to the VA task queue. Edit lets the operator tune copy or
swap asset. Reject kills it and emits the negative signal.

## The VA checklist runner (the primary product surface)

Fullscreen, card-by-card, keyboard-driven. It is where *hours* get spent
daily. Every polish cycle invested here pays back manyfold.

Key behaviors:

- Tasks arrive in batches grouped by action type and device affinity.
- VA opens a batch, executes card-by-card, marks **done / escalate / skip**.
- Pre-generated content flow: VA copies copy, opens the asset, executes on
  the phone, marks done.
- Escalation routes back to the operator's review queue with a reason.

This is the build that deserves the most craft. It ships **last** so we've
dogfooded the pipeline enough to know what tasks actually need to look like.

## Build sequence

In order — each build depends on the prior.

- **A. Onboarding flow** — linear guided flow per Surface 1. Under 10 min
  end-to-end.
- **B. Roster + model detail** — Surface 2 + Surface 3, signal-light
  oriented, not dashboard-oriented. Reuses all feature 1–2 entities.
- **C. Context note system** — Cmd+K overlay, storage + scope + weight +
  duration, expiration job, visibility on affected models + roster header.
- **D. Generation loop v1** — runs on schedule, produces drafts, routes
  by confidence into task queue or review queue.
- **E. Review queue UI** — operator-facing, approve / edit / reject per item.
- **F. VA checklist runner** — fullscreen, keyboard-driven. Ships last.
- **G. Engagement ingest** — pulls engagement data from X (API or scraping
  fallback). Feeds the generator's learning loop.
- **H. Camps** — deferred. Single-account loop must be working first. Camps
  are a grouping primitive layered on top, not a prerequisite.

## What is NOT on the operator surfaces

Explicit anti-goals, to prevent dashboard-instinct drift:

- No "today's weather" screen with stat tiles.
- No cross-model feeds, inbox-style unread counters, or Slack-style chrome.
- No settings pages the operator opens daily (thresholds live in one place
  behind model detail).
- No standalone CRUD list pages for agencies / accounts / devices /
  context-notes as top-level nav items — these are accessed through the
  onboarding flow or the model detail drill-down.

If a proposed screen doesn't serve onboarding, roster-at-a-glance, or
model-detail drill-down, it probably does not belong in the operator
surface.
