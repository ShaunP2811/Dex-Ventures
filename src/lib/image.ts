/**
 * image.ts — optional generative ad-background seam. Activates only when
 * IMAGE_API_KEY is set (OpenAI-compatible images endpoint). Given a prompt built
 * from the client's site + brief, it synthesises a background image; otherwise
 * the app uses the site's own hero/OG image. Server-side only; graceful null.
 */

import type { Objective } from "./config";

/**
 * Objective-aware ad-image prompt. The campaign objective sets the creative
 * direction — the same subject shot very differently for Awareness vs Traffic
 * vs Conversion. (See the ad-image-gen skill for the full strategy.)
 */
export function buildImagePrompt(opts: {
  client: string;
  objective: Objective;
  isB2b: boolean;
  industry?: string;
  siteDescription?: string;
}): string {
  const { client, objective, isB2b, industry, siteDescription } = opts;
  const direction: Record<Objective, string> = {
    Awareness:
      "aspirational lifestyle scene with broad emotional appeal, brand-world atmosphere, wide cinematic composition, people enjoying the experience",
    Traffic:
      "inviting, dynamic scene that sparks curiosity, mid-shot, vibrant and clickable, a moment that makes you want to explore further",
    Conversion:
      "clean commercial product-hero shot, one clear focal subject, benefit-led, premium studio lighting, generous negative space for a call-to-action",
  };
  const segment = isB2b
    ? "professional B2B setting"
    : "consumer lifestyle setting";
  const brand = industry ? `${industry} brand` : "brand";
  return [
    `Advertising background image for ${client}, a ${brand}, ${segment}.`,
    `Creative direction for a ${objective} campaign: ${direction[objective]}.`,
    siteDescription ? `Brand context: ${siteDescription}.` : "",
    "Photographic, on-brand, premium and uncluttered. No text, no logos, no watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateAdBackground(prompt: string): Promise<string | null> {
  const key = process.env.IMAGE_API_KEY;
  if (!key) return null;

  const base = process.env.IMAGE_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.IMAGE_MODEL ?? "gpt-image-1";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { url?: string; b64_json?: string }[];
    };
    const first = data.data?.[0];
    if (first?.url) return first.url;
    if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
