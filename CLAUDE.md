# CLAUDE.md — Prism design guardrails

Context for Claude Code. These decisions are locked in — don't silently change
them. (Prism = automated media planner; interview build for ROOTS / DEX.)
Run: `npm run dev` · `npm test` (107 tests) · `npm run typecheck`.

## THE INVARIANT (never violate)

**No number that matters ever passes through the LLM.** All money maths — fees,
budget splits, tax, the minimum-spend floor, delivery estimates — is pure,
deterministic code. The LLM only writes *language* (targeting + ad copy): it sees
only surviving channel names + free-text guidance, never a budget, and its output
is re-filtered to surviving channels. API keys stay server-side. Fee lines always
reconcile exactly to the input budget.

## Locked logic

### Fees — back-solve, not add-on
The input budget is the client's total commitment; media spend is solved from it:

    fixed = SETUP + REPORTING*months
    media = (total − fixed*(1+tax)) / (1 + MGMT*(1+tax))
    mgmt  = MGMT*media   ·   tax = tax%*(fixed + mgmt)      # tax on services only

Defaults: SETUP 1500 · REPORTING 800/mo · MGMT 15% · tax = MY SST 8% / SG GST 9%.
The tax line absorbs sub-cent rounding so the lines always sum to the budget.

### Allocation — objective-driven
Base matrix per objective × segment. Awareness→Conversion shifts budget toward
Google and away from TikTok; Meta stays high; B2B activates LinkedIn and drops
TikTok. B2C (Meta/Google/TikTok/LinkedIn) — Awareness 40/25/35/0 · Traffic
40/40/20/0 · Conversion 40/45/15/0. Users can exclude channels; the floor then
redistributes their budget.

### Minimum-spend floor
Below RM2,000/month a channel can't exit its learning phase, so it's dropped
smallest-first and its budget shared out; repeat until stable. Below the
minimum-viable budget the request is rejected with a clear message.

## Regression — must stay identical (asserted in tests)

- **A** — Aura Fitness, Conversion, B2C, RM50,000, 2mo → Media 40,148.02 · Mgmt
  6,022.20 · Setup 1,500 · Reporting 1,600 · SST 729.78 · TOTAL 50,000.00 ·
  Google 45% / Meta 40% / TikTok 15%.
- **B** — same at RM15,000 → TikTok dropped (below RM4,000 floor); Google ~52.9%
  + Meta ~47.1%.

## Where things live

- `src/lib/config.ts` — every tunable number (fees, matrices, floor, benchmarks, markets, ad formats)
- `src/lib/engine.ts` — fees, allocation, floor, delivery (pure, unit-tested)
- `src/lib/targeting.ts` · `creative.ts` — targeting + ad copy (mock or live LLM)
- `src/lib/site.ts` · `image.ts` — brand-image fetch (SSRF-guarded) + optional generation
- `src/lib/proposal.ts` — assembles the full proposal
- `src/lib/*.test.ts` — 107 tests (locked scenarios, invariants, reconciliation sweep, guards)
- `app/` — form, `/api/plan`, proposal UI, design tokens
- `ARCHITECTURE.md` — plain-language blueprint · `SAMPLE_PROPOSAL.md` — sample output
