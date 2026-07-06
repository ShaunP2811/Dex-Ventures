---
name: ad-caption-writing
description: Write ad copy (headline, primary text, CTA) tailored to each platform's voice and format — Meta, Google, TikTok, LinkedIn — and adapted to the campaign objective (Awareness / Traffic / Conversion). Use when building, prompting, or debugging Prism's ad-creative copy, tuning per-platform captions, or setting character limits and CTAs.
---

# Ad Caption Writing (per-platform)

Each platform rewards a different voice. The *same* offer should read differently
on a LinkedIn banner than in a TikTok caption. This skill defines that voice per
platform, layered on top of the campaign objective.

## Voice per platform

| Platform | Voice | Do | Don't |
| --- | --- | --- | --- |
| **Meta** | Warm, benefit-led, social | Lead with the benefit; friendly, inclusive ("made for you"); social proof | Corporate jargon, hard-sell first line |
| **Google** | Search-intent, direct | Answer the query; state the value + a clear next step; mirror what they searched | Vague brand poetry; clickbait |
| **TikTok** | Native, casual, hook-first | Lowercase, conversational, a strong first-second hook ("POV:", "wait…"); sound like a creator, not a brand | Formal tone, salesy CTAs, stock-photo language |
| **LinkedIn** | Professional, credible | Outcomes and proof; speak to teams/decision-makers; ROI and "why leaders choose" | Slang, hype, emoji spam |

## Adapt by objective

- **Awareness** — introduce the brand, sell the feeling, low pressure.
- **Traffic** — spark curiosity, invite a click, "there's more to see".
- **Conversion** — clear value + a decisive push to act now.

CTA by objective (segment-aware): Awareness → *Learn More*; Traffic → *Shop Now*
(B2C) / *Visit Site* (B2B); Conversion → *Sign Up* (B2C) / *Book a Demo* (B2B).

## Format limits (copy is clamped to these)

| Platform | Headline | Primary text | Placement |
| --- | ---: | ---: | --- |
| Meta | 40 | 125 | Feed (4:5) |
| Google | 30 | 90 | Responsive Display (1.91:1) |
| TikTok | 34 | 100 | In-Feed (9:16) |
| LinkedIn | 70 | 150 | Sponsored Content (1.91:1) |

Always keep the headline within the limit — front-load the meaning so a clamp
never cuts the point. Never bake numbers/prices/claims you can't stand behind
into copy.

## Where it lives in the app

- `src/lib/creative.ts` → `copyFor(channel, objective, client, topic)` holds the
  per-platform × objective copy table. **Tune the voice here.**
- `generateCreatives()` clamps each field to the limits in `src/lib/config.ts`
  (`AD_FORMATS`) and attaches the objective/segment CTA.
- Today the copy is a deterministic generator (always demoable). The same live-LLM
  seam used for targeting can write these instead — feed it this per-platform
  brief so the model matches each platform's voice.

## Quick checklist

- [ ] Reads native to the platform (a TikTok caption shouldn't sound like LinkedIn)
- [ ] Objective is obvious from the copy (awareness vs. push-to-act)
- [ ] Headline is within limit and front-loaded
- [ ] CTA matches objective + segment
- [ ] No unverifiable claims, prices, or fabricated stats
