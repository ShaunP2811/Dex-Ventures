---
name: ad-image-gen
description: Generate on-brand ad creative background images driven by the campaign objective (Awareness / Traffic / Conversion) and platform format. Use when building, prompting, or debugging the Prism ad-creative image pipeline, choosing an image model/provider, or writing objective-aware image prompts for Meta / Google / TikTok / LinkedIn ad units.
---

# Ad Image Generation (objective-driven)

Prism composes each ad from three layers: **copy** (language layer), a
**background image**, and a deterministic **brand frame**. This skill governs the
background image so it matches the *campaign objective*, not just the brand.

## The core idea: objective sets the creative direction

The same brand/subject is shot very differently depending on what the campaign is
trying to do. Encode that in the prompt:

| Objective | Creative direction | Shot / composition |
| --- | --- | --- |
| **Awareness** | Aspirational, emotional, brand-world. Sell the feeling, not the product. | Wide cinematic scene, people enjoying the experience, lots of atmosphere. |
| **Traffic** | Curiosity + momentum. Make them want to click through. | Dynamic mid-shot, a moment mid-action, vibrant, "there's more to see". |
| **Conversion** | Product/benefit hero. Clear, commercial, decisive. | Single focal subject, premium studio lighting, generous negative space for the CTA. |

Segment shifts tone: **B2C** = lifestyle/consumer; **B2B** = professional/context.

## Prompt template

```
Advertising background image for {client}, a {industry} brand, {segment} setting.
Creative direction for a {objective} campaign: {direction}.
Brand context: {siteDescription}.            # optional, from the client's website
Photographic, on-brand, premium and uncluttered. No text, no logos, no watermarks.
```

Always include the **negative constraints** ("no text, no logos, no watermarks")
— the copy + brand frame are added deterministically on top; the image must stay
clean behind them. Reserve safe space per platform (see below) so the headline
and CTA never collide with a busy area.

## Platform formats & safe zones

| Platform | Ratio | Request size | Text safe zone |
| --- | --- | --- | --- |
| Meta (Feed) | 4:5 | 1080×1350 | keep top ~15% / bottom ~20% low-detail |
| Google (Display) | 1.91:1 | 1200×628 | keep the left third calm (headline + CTA) |
| TikTok (In-Feed) | 9:16 | 1080×1920 | keep bottom ~25% and right edge calm (UI + CTA) |
| LinkedIn (Sponsored) | 1.91:1 | 1200×627 | keep the left third calm |

## Wiring in the app

- `src/lib/image.ts`
  - `buildImagePrompt({ client, objective, isB2b, industry, siteDescription })` —
    returns the objective-aware prompt above. **Extend the `direction` map here**
    to tune tone per objective.
  - `generateAdBackground(prompt)` — calls an **OpenAI-compatible images endpoint**
    when `IMAGE_API_KEY` is set; returns a URL/data-URI or `null`.
- `src/lib/proposal.ts` resolves the ad image with this priority:
  1. **Generated** image (if `IMAGE_API_KEY` set) — prompt from `buildImagePrompt`.
  2. The client's **own hero/OG image** (from their website).
  3. A branded gradient (the always-demoable default).

## Provider config (env, server-side only)

```
IMAGE_API_KEY   = <key>                       # enables generation
IMAGE_BASE_URL  = https://api.openai.com/v1   # or any OpenAI-compatible images API
IMAGE_MODEL     = gpt-image-1                  # e.g. gpt-image-1, or a compatible model
```

Never expose the key to the browser (generation runs in the `/api/plan` server
route). Keep a graceful fallback: any failure or missing key must fall back to the
site image, then the gradient — the demo never hard-fails.

## Guardrails

- The image is **decoration**, not data — no numbers, prices, or claims baked in.
- Respect brand/IP: don't fabricate a real brand's logo; frame with Prism's own
  brand chrome instead.
- For regulated verticals (finance, health), avoid implied guarantees in imagery.
