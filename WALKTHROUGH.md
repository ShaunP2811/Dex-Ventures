# Prism — Walkthrough

A written walkthrough in place of the optional demo video: **what it is, how it's
built, and a step-by-step of the input → plan journey.** Drop a few screenshots in
where marked if you like — the text stands on its own.

## What it is

Prism turns a short campaign brief into a client-ready media plan: a defensible
fee breakdown, a dynamic budget split across Meta / Google / TikTok / LinkedIn,
paste-ready audience targeting, and on-brand ad creative — in one click.

## How it's built

One Next.js app, with the work split in two on purpose:

- **The numbers** — fees, the budget split, the minimum-spend floor, and the
  result estimates — are computed by fixed, deterministic rules. Every figure is
  exact and can be checked by hand.
- **The words** — targeting and ad copy — are written by an AI layer that **never
  sees a budget**; it only receives the surviving channels and a plain-English
  description of the audience.

That split is the whole point: you can trust every number because **no number ever
passes through the AI.** See [ARCHITECTURE.md](ARCHITECTURE.md) for the diagram.
It's backed by 107 automated tests.

## The journey — input to plan

1. **Enter the brief.** Client, budget (drag the slider or type), goal
   (Awareness / Traffic / Conversion), B2C or B2B, market (Malaysia RM /
   Singapore S$), which channels to include, an optional company website, and a
   plain-English audience description.
   _Tip: "Load example (Aura Fitness)" fills in a ready scenario._
   <!-- screenshot: the brief form -->

2. **Generate.** In a second or two the full proposal appears:
   - **Investment summary** — grouped as Working media → Agency services (with a
     subtotal) → Tax → Total, each showing its share of budget. For
     RM50,000 / 2 months: media RM40,148.02, management RM6,022.20, setup
     RM1,500, reporting RM1,600, SST RM729.78 — **totalling exactly
     RM50,000.00.**
   - **Channel allocation** — a one-line summary of the strategy, then the split:
     Google 45% · Meta 40% · TikTok 15%, each with a reason.
   - **Projected delivery** — illustrative reach / clicks / conversions.
   - **Audience targeting** — paste-ready, per platform.
   - **Ad creative** — a mockup per platform in its real ad format.
   <!-- screenshot: the generated proposal -->

## The moments that show the thinking

- **The minimum-spend floor.** Drop the budget to RM15,000 and TikTok falls below
  the RM4,000 learning-phase floor — Prism removes it and redistributes to Google
  (~52.9%) and Meta (~47.1%), and the fees still reconcile exactly.
- **Market switch.** Toggle Singapore and the currency becomes S$ and the tax
  becomes GST 9% — same logic, different market.
- **Customise the mix.** Turn a channel off and its budget redistributes to the
  rest (you can't turn them all off — it's guarded).
- **Real brand visuals.** Add a company website and the ad mockups are built on
  the brand's own hero image, not a generic template.

## Why it's trustworthy

Every figure is deterministic and unit-tested — including a 20,000-budget sweep
proving the fees always reconcile to the cent, and a test that fails if any money
figure ever leaks into the AI-facing targeting. The AI is used only for the
creative wording, where it genuinely adds value.
