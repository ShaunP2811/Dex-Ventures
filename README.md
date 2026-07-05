# Prism — Automated Media Planner

_Refract a budget into a plan._

Turn a few campaign constraints into a **client-ready media plan proposal** —
defensible fees, dynamic channel allocation, paste-ready per-platform targeting,
and on-brand ad creative — in one click. The name says it: one budget goes in,
and Prism refracts it into an optimal spectrum of channels.

Built for the AI Solutions Architect assignment (ROOTS / DEX). Graded on three
things: **defensible fee logic**, **dynamic channel allocation**, and
**paste-ready targeting**. The architecture is organised entirely around getting
those three right and being able to *defend every number*.

---

## The one architectural decision that matters

> **No number that matters ever passes through the language model.**

Every figure a client sees — media spend, management fee, tax, the budget split,
the dropped-channel floor — is produced by a **pure, deterministic engine**. The
LLM is used for exactly one thing: turning free-text audience guidance into
platform-ready *targeting language*. It never sees a budget and never emits a
number.

```
                 ┌──────────────────────────────────────────┐
   Campaign      │  DETERMINISTIC ENGINE  (src/lib/engine.ts) │
   brief  ─────► │  • fee back-solve   • objective allocation │ ──►  every RM,
   (form)        │  • minimum-spend floor (drop + redistribute)│      %, and fee
                 └──────────────────────────────────────────┘
                        │ surviving channel NAMES + guidance
                        │ (no budgets, ever)
                        ▼
                 ┌──────────────────────────────────────────┐
                 │  LLM LAYER  (src/lib/targeting.ts)         │ ──►  targeting
                 │  • prompt → per-platform JSON              │      language
                 │  • defensive parse, guard, mock fallback   │      only
                 └──────────────────────────────────────────┘
                        │
                        ▼   proposal.ts assembles both halves
                 ┌──────────────────────────────────────────┐
                 │  CLIENT-READY PROPOSAL  (React, /api/plan) │
                 └──────────────────────────────────────────┘
```

**Why this wins the "can we trust these figures?" question:** the money math is
reproducible and unit-tested to the cent, so it is auditable. The creative,
fuzzy part (targeting) is where an LLM genuinely adds value, and a wrong word
there costs nothing. Most naive builds pipe the whole thing through a model and
can't defend a single figure.

Corollaries that are enforced in code:

- The LLM receives only the **surviving** channels + guidance — never budgets,
  never a dropped channel. Its output is re-filtered to surviving channels, so it
  can't add one back.
- The API key is **server-side only** (`/api/plan` route). It never reaches the
  browser.
- Output **reconciles**: the five fee lines sum to the committed budget
  **exactly**, for every input (proven by a 20,000-budget sweep test).

---

## The three graded pieces

### 1. Fee model — back-solve, not add-on

The input budget is the client's **total committed wallet**, not a media number
with fees bolted on. The engine back-solves to true media spend in closed form:

```
fixed = SETUP_FEE + REPORTING_FEE_PER_MONTH × months
media = (total − fixed × (1 + SST)) / (1 + MGMT × (1 + SST))
mgmt  = MGMT × media
sst   = SST × (fixed + mgmt)          # tax on SERVICE fees only, never on media
```

Defaults (all tunable in `src/lib/config.ts`): setup **RM1,500** flat ·
reporting **RM800/mo** · management **15%** of media · **SST 8%** on services.

> Reconciliation note: fee lines are rounded for display with the SST line
> absorbing the sub-cent residual (standard invoice practice), so the five items
> always sum to the committed budget exactly.

### 2. Allocation — objective-driven and dynamic

A base matrix per objective, split B2C vs B2B. Moving **Awareness → Conversion**
migrates budget toward Google (captures intent) and away from TikTok (top-funnel
discovery); Meta stays high full-funnel. **B2B** activates LinkedIn and kills
TikTok. Every share carries a deterministic rationale from `config.REASON_MAP` —
the LLM never explains a number.

### 3. Minimum-spend floor — the standout

A platform needs enough budget to exit its learning phase. Any channel allocated
below **RM2,000/month × months** is **dropped smallest-first**, its budget
redistributed to survivors, iterating until stable. Small budgets concentrate on
the 1–2 channels that can actually perform, and the proposal states the drop
reason explicitly. Budgets too small to fund even one channel are rejected at the
API with a clear minimum (`minViableBudget`).

---

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Click **"Load example (Aura Fitness)"** to prefill the graded scenario, then
**Generate media plan**. Use **Print / Save as PDF** on the proposal for a
client-ready document.

```bash
npm test           # 77 deterministic-engine tests incl. the locked scenarios
npm run typecheck  # strict TS, whole app
```

### Targeting: mock by default, live when you want it

With no key set, the targeting layer returns a **deterministic mock seeded from
sample data** — the app is always demoable. To use a real model, set a key for
any **OpenAI-compatible** endpoint (Groq, OpenRouter, Together, … all have free
tiers). Provider-agnostic, server-side only:

```bash
# .env.local  (see .env.example)
LLM_API_KEY=your_key
LLM_BASE_URL=https://api.groq.com/openai/v1      # optional, this is the default
LLM_MODEL=llama-3.3-70b-versatile                 # optional
```

The pipeline is unchanged either way — same prompt contract, same defensive
parse, and it **falls back to the mock on any error** so a demo never hard-fails.
The proposal's source pill shows which path produced the targeting.

---

## Deploy (MVP)

One repo, one runtime, one deploy:

```bash
vercel deploy
```

Set `LLM_API_KEY` (and optionally `LLM_BASE_URL` / `LLM_MODEL`) as Vercel
environment variables — the key stays server-side in the `/api/plan` function.

## Backend workflow blueprint

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the pipeline diagrams (rendered by
GitHub) — a system flowchart and a request sequence that show the actual logic
and the deterministic/LLM boundary.

The single integration seam is **`POST /api/plan`** (JSON in, JSON out). Any
automation platform (Make, Zapier, Pipedream), CRM, or intake form can trigger a
plan by calling that one endpoint — the deterministic logic stays in the tested
app, never in low-code workflow nodes.

---

## Project map

```
src/lib/
  config.ts      all tunable numbers: fees, matrices, floor, rationale, LLM cfg
  engine.ts      pure fee back-solve + allocation + iterative floor (+ reconcile)
  engine.test.ts 77 tests: locked scenarios + invariants + reconciliation sweep
  targeting.ts   LLM layer: prompt contract, mock (sample), live provider, guard
  proposal.ts    assembles engine + targeting into the client-ready proposal
  types.ts       shared contracts (server ↔ client)
  format.ts      display helpers (RM, %, field titles)
app/
  api/plan/route.ts   server-side endpoint: validate → engine → targeting → JSON
  page.tsx            two-pane app: brief form + proposal document
  components/          PlannerForm, Proposal, ThemeToggle, icons
  globals.css         design tokens (light/dark), tabular figures, print styles
```

## Deliverables map

| Deliverable | Where |
| --- | --- |
| Backend workflow blueprint | this repo + [ARCHITECTURE.md](ARCHITECTURE.md) diagrams |
| MVP (deployed app) | `app/` — Next.js, `vercel deploy` |
| Sample output | `SAMPLE_PROPOSAL.md`, or the app's "Download proposal (.md)" |
| Walkthrough (optional) | [WALKTHROUGH.md](WALKTHROUGH.md) — written; or a short Loom |
