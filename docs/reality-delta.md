# Reality delta

Per spec §10. Raw log of every deviation between the build spec and what actually happens when the system meets users. This file is the primary input for Phase 2+ refinement. The spec is a starting point, not a cage.

## Entries

### Console navigation sidebar is too broad (Build B carryover)

**Today.** `apps/ops/src/app/console/layout.tsx` renders a 12-item left-rail:

```
Dashboard · Onboard
Workspace: Agencies · Models · Accounts · Camps · Content · Formula · Context Notes · Insights
Ops: VAs · Devices · Settings
```

**Per the doc.** `/docs/operational-model.md` describes three operator surfaces — **Onboarding**, **Roster**, **Model detail** — accessed via the drill-down pattern. The doc's "What is NOT on the operator surfaces" section explicitly names standalone CRUD list pages for agencies / accounts / devices / context-notes as anti-goals at the top level.

**Why the current shape exists.** Feature 1 built Phase-0 CRUD pages for every entity before the operational model was written. Feature 2 added Content. Those pages remain useful for debugging and for bulk operations the Roster doesn't surface (filtering content library by model, etc.). Cutting them right now would remove affordances that have no replacement yet.

**Resolution plan.** After **Build C** (Context note overlay) and **Build E** (Review queue UI) land, the nav shrinks to match the three-surface model: "Onboard" + "Roster" as primary; context notes + review queue surface via the roster header strip and model-detail anchor blocks, not as top-level nav items. Deeper routes like `/console/models`, `/console/accounts`, `/console/content` can stay as debug tools, reachable via a secondary menu rather than primary nav.

**Tracking.** Follow-up build tagged `nav-shrink` to land after C + E. Build B deliberately does not touch the sidebar — reshaping it mid-sequence would ripple through screens that don't yet exist.
