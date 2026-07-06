/**
 * targeting.ts — The LLM layer. Its ONLY job: translate free-text audience
 * guidance into paste-ready, per-platform targeting for the channels that
 * survived allocation. It never sees budgets and never produces a number.
 *
 * Two paths, one contract:
 *   • MOCK (default): an adaptive, deterministic generator seeded from a light
 *     "brief" derived from the guidance. Known verticals get curated sets;
 *     anything else is synthesised from the brief, so arbitrary campaigns still
 *     produce tailored (not canned) targeting. Always demoable, no key needed.
 *   • LIVE: any OpenAI-compatible endpoint when LLM_API_KEY is set, with a
 *     timeout and graceful fallback to the mock.
 * The `source` marker keeps mock vs live output honest end-to-end.
 */

import type { Channel, MarketCode, Objective } from "./config";
import type { PlatformTargeting, Targeting, TargetingResult } from "./types";

// Platform-specific fields the model must return — this is what "platform-ready"
// means: each channel in its own ad-manager taxonomy, not generic prose.
export const PLATFORM_SCHEMA: Record<Channel, string> = {
  Meta: "interests[], behaviors[], demographics, lookalike, retargeting",
  Google: "keywords[] (each {term, match: exact|phrase|broad}), in_market[], custom_intent",
  TikTok: "interests[], behaviors[], demographics",
  LinkedIn: "job_titles[], seniority[], functions[], industries[], company_size",
};

// ---------------------------------------------------------------------------
// Adaptive mock: derive a light brief from the free-text guidance so arbitrary
// campaigns produce tailored targeting. Known verticals (fitness, B2B) get
// curated high-quality sets; anything else is synthesised. Fully deterministic.
// ---------------------------------------------------------------------------

interface Brief {
  geo: string;
  age: string;
  vertical: "fitness" | "b2b" | "generic";
  interests: string[]; // titleized topic terms from the brief (may be empty)
  topic: string; // primary topic phrase for keywords
}

const LOCATIONS: [RegExp, string][] = [
  [/\bkuala lumpur\b|\bkl\b/, "Kuala Lumpur"],
  [/\bselangor\b/, "Selangor"],
  [/\bpetaling jaya\b|\bpj\b/, "Petaling Jaya"],
  [/\bklang valley\b/, "Klang Valley"],
  [/\bpenang\b/, "Penang"],
  [/\bjohor(?: bahru)?\b/, "Johor"],
  [/\bipoh\b/, "Ipoh"],
  [/\bmelaka\b|\bmalacca\b/, "Melaka"],
  [/\bsabah\b/, "Sabah"],
  [/\bsarawak\b/, "Sarawak"],
  [/\bmalaysia\b/, "Malaysia"],
  [/\bsingapore\b/, "Singapore"],
  [/\borchard\b/, "Orchard"],
  [/\bjurong\b/, "Jurong"],
  [/\btampines\b/, "Tampines"],
];

const STOPWORDS = new Set([
  "the", "and", "for", "who", "are", "with", "want", "wants", "looking", "join",
  "into", "their", "they", "that", "this", "you", "your", "our", "aged", "age",
  "years", "year", "old", "based", "near", "around", "plus", "people", "adults",
  "adult", "users", "user", "customers", "customer", "audience", "audiences",
  "target", "targeting", "new", "high", "value", "conscious", "aware",
  "competitor", "access", "convenience", "hour", "hours", "from", "get", "gets",
  "them", "she", "her", "his", "him", "men", "women", "male", "female", "want",
  "using", "use", "across", "key", "main", "want", "very", "more", "most",
]);

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveBrief(
  guidance: string,
  isB2b: boolean,
  industry = "",
  market: MarketCode = "MY",
): Brief {
  const g = `${industry} ${guidance}`.toLowerCase();

  const geos: string[] = [];
  for (const [re, name] of LOCATIONS) {
    if (re.test(g) && !geos.includes(name)) geos.push(name);
  }
  const defaultGeo = market === "SG" ? "Singapore" : "Kuala Lumpur & Selangor";
  const geo =
    geos.length === 0
      ? defaultGeo
      : geos.slice(0, 2).join(" & ") + (geos.length > 2 ? " +" : "");

  const ageMatch = g.match(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})/);
  const age = ageMatch
    ? `Age ${ageMatch[1]}-${ageMatch[2]}`
    : isB2b
      ? "Age 28-50"
      : "Age 25-45";

  const vertical: Brief["vertical"] = /\b(gym|fitness|workout|wellness|exercise)\b/.test(g)
    ? "fitness"
    : isB2b || /\b(b2b|saas|software|enterprise|platform|agency|crm)\b/.test(g)
      ? "b2b"
      : "generic";

  const locationWords = new Set(geos.flatMap((n) => n.toLowerCase().split(/\s+/)));
  const tokens = g
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !locationWords.has(w));
  const seen = new Set<string>();
  const uniq = tokens.filter((w) => (seen.has(w) ? false : seen.add(w)));
  const ind = industry.trim();
  const rawInterests = ind
    ? [titleCase(ind), ...uniq.map(titleCase)]
    : uniq.map(titleCase);
  const interests = [...new Set(rawInterests)].slice(0, 4);
  const topic = ind
    ? ind.toLowerCase()
    : uniq.slice(0, 2).join(" ") || (vertical === "fitness" ? "gym" : "");

  return { geo, age, vertical, interests, topic };
}

function metaTargeting(brief: Brief): PlatformTargeting {
  const demographics = `${brief.age}, ${brief.geo}`;
  if (brief.vertical === "fitness") {
    return {
      interests: ["Physical fitness", "Gym", "Weight training", "Bodybuilding", "Healthy diet", "Physical exercise"],
      behaviors: ["Engaged Shoppers", "Health & wellness buyers"],
      demographics,
      lookalike: "1% Lookalike of existing member purchase list (LAL-MY)",
      retargeting: "Website visitors last 30 days + video viewers 50%+",
    };
  }
  if (brief.vertical === "b2b") {
    return {
      interests: brief.interests.length ? brief.interests : ["Business software", "Digital marketing", "Entrepreneurship", "Small and medium-sized enterprises"],
      behaviors: ["Engaged Shoppers", "Business decision-makers"],
      demographics,
      lookalike: "1% Lookalike of closed-won CRM accounts (LAL-MY)",
      retargeting: "Website visitors last 30 days + lead-form openers (no submit)",
    };
  }
  return {
    interests: brief.interests.length ? brief.interests : ["Online shopping", "Retail"],
    behaviors: ["Engaged Shoppers", "Category content engagers"],
    demographics,
    lookalike: "1% Lookalike of existing customer purchase list (LAL-MY)",
    retargeting: "Website visitors last 30 days + add-to-cart (no purchase)",
  };
}

function googleTargeting(brief: Brief, objective: Objective): PlatformTargeting {
  if (brief.vertical === "fitness") {
    return {
      keywords: [
        { term: "gym membership kl", match: "exact" },
        { term: "fitness centre near me", match: "phrase" },
        { term: "best gym petaling jaya", match: "phrase" },
        { term: "24 hour gym kuala lumpur", match: "phrase" },
      ],
      in_market: ["Fitness Products & Services", "Gym Memberships & Fitness Clubs"],
      custom_intent: "Users searching competitor gym brands (Celebrity Fitness, Fitness First, Anytime Fitness) + membership terms",
    };
  }
  if (brief.vertical === "b2b") {
    return {
      keywords: [
        { term: "marketing automation platform", match: "phrase" },
        { term: "b2b lead generation agency", match: "phrase" },
        { term: "crm software malaysia", match: "exact" },
      ],
      in_market: ["Business Services", "Marketing Software", "CRM Software"],
      custom_intent: "Users researching competitor SaaS vendors + 'request a demo' / pricing terms",
    };
  }
  const topic = brief.topic || "product";
  const geoShort = brief.geo.split(" ")[0].toLowerCase();
  return {
    keywords: [
      { term: `${topic} ${geoShort}`, match: "exact" },
      { term: `best ${topic} near me`, match: "phrase" },
      { term: `buy ${topic} online`, match: "phrase" },
      { term: `${topic} price`, match: "broad" },
    ],
    in_market: [`${titleCase(topic)} Products & Services`],
    custom_intent: `Users searching ${topic} + competitor brands and ${objective.toLowerCase()} terms`,
  };
}

function tiktokTargeting(brief: Brief): PlatformTargeting {
  const demographics = `${brief.age}, ${brief.geo}`;
  if (brief.vertical === "fitness") {
    return {
      interests: ["Fitness & Workout", "Health", "Sports & Outdoors"],
      behaviors: ["Engaged with fitness/gym creator content, last 15 days", "Followed fitness creators"],
      demographics,
    };
  }
  return {
    interests: brief.interests.length ? brief.interests : ["Lifestyle", "Shopping"],
    behaviors: ["Engaged with related creator content, last 15 days", "Followed category creators"],
    demographics,
  };
}

function linkedinTargeting(brief: Brief): PlatformTargeting {
  const industries =
    brief.vertical === "generic" && brief.topic
      ? [`${titleCase(brief.topic)}`, "Marketing & Advertising"]
      : ["Marketing & Advertising", "Information Technology & Services", "Financial Services"];
  return {
    job_titles: ["Marketing Director", "Head of Growth", "Chief Marketing Officer", "Brand Manager"],
    seniority: ["Director", "VP", "CXO"],
    functions: ["Marketing", "Sales", "Business Development"],
    industries,
    company_size: "51-200, 201-500, 501-1000",
  };
}

function mockForChannel(
  channel: Channel,
  brief: Brief,
  objective: Objective,
): PlatformTargeting {
  switch (channel) {
    case "Meta":
      return metaTargeting(brief);
    case "Google":
      return googleTargeting(brief, objective);
    case "TikTok":
      return tiktokTargeting(brief);
    case "LinkedIn":
      return linkedinTargeting(brief);
  }
}

/**
 * Deterministic mock. Returns { source, targeting } for ONLY the channels that
 * survived allocation, adapted to the brief. No budgets, ever.
 */
export function generateTargeting(
  activeChannels: Channel[],
  guidance: string,
  objective: Objective,
  isB2b: boolean,
  industry?: string,
  market: MarketCode = "MY",
): TargetingResult {
  if (activeChannels.length === 0) {
    return { source: "none", targeting: {} };
  }

  const brief = deriveBrief(guidance, isB2b, industry, market);
  const targeting: Targeting = {};
  for (const channel of activeChannels) {
    targeting[channel] = mockForChannel(channel, brief, objective);
  }

  const text = guidance.trim();
  if (text && targeting.Meta) {
    targeting.Meta = { ...targeting.Meta, audience_brief: text };
  }

  return { source: "mock_sample", targeting };
}

// ---------------------------------------------------------------------------
// LIVE provider (provider-agnostic, OpenAI-compatible). Activates only when
// LLM_API_KEY is set — otherwise the adaptive mock is used. Works with any
// free-tier endpoint (Groq, OpenRouter, Together, …) via env config. The API
// key is read server-side only and never reaches the browser.
// ---------------------------------------------------------------------------

const LLM_TIMEOUT_MS = 12_000;

function buildPrompt(
  activeChannels: Channel[],
  guidance: string,
  objective: Objective,
  isB2b: boolean,
  industry?: string,
  refinement?: string,
): string {
  const schemaLines = activeChannels
    .map((c) => `  "${c}": { ${PLATFORM_SCHEMA[c]} }`)
    .join("\n");
  const segment = isB2b ? "B2B" : "B2C";
  const industryLine = industry?.trim()
    ? `Industry / vertical: ${industry.trim()}\n`
    : "";
  const refineLine = refinement?.trim()
    ? `\nRefinement request from the client (apply it to the targeting): ${refinement.trim()}`
    : "";
  return `You are a paid-media targeting specialist. Convert the campaign's free-text audience guidance into structured, PLATFORM-READY targeting that a junior media buyer could paste directly into each ad manager.

Campaign objective: ${objective}
Segment: ${segment}
${industryLine}Audience guidance (free text): "${guidance}"${refineLine}

Return targeting ONLY for these channels: ${activeChannels.join(", ")}

Respond with ONLY a valid JSON object, no markdown, no preamble. Use each platform's real targeting taxonomy. Shape:
{
${schemaLines}
}

Rules:
- Use concrete, real targeting values (actual interest names, real keywords with match types, real job titles) — never vague descriptions.
- Do NOT include budgets, percentages, or any numbers about spend.
- Include only the channels listed above.`;
}

function parseJson(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(cleaned.indexOf("\n") + 1);
    const fence = cleaned.lastIndexOf("```");
    if (fence !== -1) cleaned = cleaned.slice(0, fence);
  }
  return JSON.parse(cleaned.trim());
}

async function callLLM(prompt: string): Promise<string> {
  const key = process.env.LLM_API_KEY as string;
  const base = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
  const model = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned no content");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Filters model output to the surviving channels — the model can never add a
 * dropped channel back. Exported for testing the guard directly.
 */
export function filterToActive(
  parsed: Record<string, unknown>,
  activeChannels: Channel[],
): Targeting {
  const filtered: Targeting = {};
  for (const c of activeChannels) {
    if (parsed[c]) filtered[c] = parsed[c] as PlatformTargeting;
  }
  return filtered;
}

/**
 * Async resolver used by the pipeline. Uses the live LLM when LLM_API_KEY is
 * configured; otherwise returns the deterministic mock. Any failure (including
 * timeout) falls back to the mock so the demo never hard-fails.
 */
export async function generateTargetingSmart(
  activeChannels: Channel[],
  guidance: string,
  objective: Objective,
  isB2b: boolean,
  industry?: string,
  market: MarketCode = "MY",
  refinement?: string,
): Promise<TargetingResult> {
  if (activeChannels.length === 0) {
    return { source: "none", targeting: {} };
  }

  if (!process.env.LLM_API_KEY) {
    return generateTargeting(activeChannels, guidance, objective, isB2b, industry, market);
  }

  try {
    const prompt = buildPrompt(activeChannels, guidance, objective, isB2b, industry, refinement);
    const raw = await callLLM(prompt);
    const filtered = filterToActive(parseJson(raw), activeChannels);
    if (Object.keys(filtered).length === 0) {
      return generateTargeting(activeChannels, guidance, objective, isB2b, industry, market);
    }
    const model = process.env.LLM_MODEL ?? "openai-compatible";
    return { source: `llm:${model}`, targeting: filtered };
  } catch (err) {
    const fallback = generateTargeting(activeChannels, guidance, objective, isB2b, industry, market);
    const name = err instanceof Error ? err.name : "error";
    return { source: `mock_sample (llm ${name})`, targeting: fallback.targeting };
  }
}
