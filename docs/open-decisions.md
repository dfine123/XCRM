# Open decisions

Mirror of spec §8. These are blocking for the phases they're attached to. Operator owes Claude Code answers.

## Before Phase 1

- [ ] Final product name (or confirm `camp` as placeholder — lives in `@xcrm/shared/constants.PRODUCT_NAME`)
- [ ] Timezone policy — scheduler stores UTC, displays in operator TZ; confirm TZ
- [ ] VA capacity defaults (tasks per day per VA) — currently `{ VA_T1: 80, VA_T2: 40, VA_T3: 60 }` in `@xcrm/shared/constants.VA_DEFAULT_TASKS_PER_DAY`

## Before Phase 2

- [ ] ContentFormula v0 written as prose by partner (goes into `ContentFormula.rawPlaybook`)
- [ ] Archetype list finalized (current enum is a proposal — partner edits via migration)
- [ ] Confidence threshold per account status — currently in `DEFAULT_CONFIDENCE_THRESHOLDS`
- [ ] How many camps to run simultaneously (pilot = 1? scales how?)

## Before Phase 3

- [ ] Pricing tiers finalized
- [ ] Agency onboarding flow — self-serve or founder-created?
- [ ] Invoice generation — Stripe Billing integration, or export for human accountant?

## Before Phase 4

- [ ] Revenue data format if agencies share (CSV upload? API? read-only OF scraper?)
