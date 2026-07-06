/**
 * config.ts — All defensible numbers live here, separated from logic.
 *
 * 1:1 port of config.py. Interview talking point: every heuristic is a named,
 * tunable value in ONE place — not a magic number buried in code. In production
 * these calibrate from the agency's own historical CPA-per-channel data; today
 * they are informed industry defaults.
 *
 * This module is the SINGLE SOURCE OF TRUTH for tunable numbers. The engine
 * imports from here and never hardcodes a figure.
 */

// ---------------------------------------------------------------------------
// FEE STRUCTURE  (Malaysian agency context)
// ---------------------------------------------------------------------------
// The input budget is treated as TOTAL CLIENT COMMITMENT. The engine back-solves
// to true media spend, because the client has a fixed wallet — not a media
// number with fees bolted on top.

export const SETUP_FEE = 1_500.0; // flat, one-time (tracking/pixel/campaign build)
export const REPORTING_FEE_PER_MONTH = 800.0; // flat, per month
export const MGMT_FEE_PCT = 0.15; // ad management fee, % of MEDIA spend (industry 15–20%)
export const SST_PCT = 0.08; // Malaysian Service Tax, applied on agency SERVICE fees (MY default)

// ---------------------------------------------------------------------------
// MARKETS — currency + local tax, parameterising the fee engine per market.
// ---------------------------------------------------------------------------
// The agency operates in Malaysia and Singapore. Same fee logic, different
// currency + local service tax. Malaysia (SST 8%) is the default and keeps the
// locked regression figures byte-identical.
export type MarketCode = "MY" | "SG";

export interface Market {
  code: MarketCode;
  name: string;
  currency: string; // display prefix, e.g. "RM", "S$"
  locale: string;
  taxRate: number; // local service tax applied to agency SERVICE fees
  taxLabel: string; // e.g. "SST", "GST"
}

export const MARKETS: Record<MarketCode, Market> = {
  MY: { code: "MY", name: "Malaysia", currency: "RM", locale: "en-MY", taxRate: SST_PCT, taxLabel: "SST" },
  SG: { code: "SG", name: "Singapore", currency: "S$", locale: "en-SG", taxRate: 0.09, taxLabel: "GST" },
};

export const DEFAULT_MARKET: MarketCode = "MY";

// ---------------------------------------------------------------------------
// CHANNEL ALLOCATION — base matrix (B2C), keyed by objective
// ---------------------------------------------------------------------------
// The shape tells a story: moving Awareness -> Conversion migrates budget toward
// Google (captures existing intent) and away from TikTok (top-funnel discovery).
// Meta stays high throughout because it works full-funnel. LinkedIn is 0 for B2C.

export type Channel = "Meta" | "Google" | "TikTok" | "LinkedIn";
export type Objective = "Awareness" | "Traffic" | "Conversion";
export type WeightRow = Record<Channel, number>;
export type Matrix = Record<Objective, WeightRow>;

export const BASE_MATRIX_B2C: Matrix = {
  Awareness: { Meta: 0.4, Google: 0.25, TikTok: 0.35, LinkedIn: 0.0 },
  Traffic: { Meta: 0.4, Google: 0.4, TikTok: 0.2, LinkedIn: 0.0 },
  Conversion: { Meta: 0.4, Google: 0.45, TikTok: 0.15, LinkedIn: 0.0 },
};

// B2B flips the logic: LinkedIn activates (reachable by job title), TikTok drops
// toward zero (decision-makers don't convert off TikTok), Google stays strong.
export const BASE_MATRIX_B2B: Matrix = {
  Awareness: { Meta: 0.3, Google: 0.25, TikTok: 0.05, LinkedIn: 0.4 },
  Traffic: { Meta: 0.25, Google: 0.4, TikTok: 0.05, LinkedIn: 0.3 },
  Conversion: { Meta: 0.25, Google: 0.4, TikTok: 0.0, LinkedIn: 0.35 },
};

// ---------------------------------------------------------------------------
// MINIMUM-SPEND FLOOR
// ---------------------------------------------------------------------------
// A platform's algorithm needs enough budget to gather signal and exit its
// learning phase. Below this per-month floor, spend is effectively wasted, so the
// engine DROPS the channel and concentrates its budget in survivors.

export const MIN_SPEND_PER_MONTH = 2_000.0;

// Priority order used when redistributing dropped budget (higher = kept longer).
export const CHANNEL_PRIORITY: Record<Channel, number> = {
  Google: 4,
  Meta: 3,
  TikTok: 2,
  LinkedIn: 1,
};

// Weight given to a channel the user explicitly adds that the chosen objective
// doesn't natively use (base weight 0) — e.g. LinkedIn on a B2C plan. It gets a
// balanced minority share rather than being ignored.
export const FORCED_CHANNEL_WEIGHT = 0.2;

// ---------------------------------------------------------------------------
// DELIVERY BENCHMARKS  (illustrative — deterministic, never from the LLM)
// ---------------------------------------------------------------------------
// Used to project *illustrative* reach / clicks / conversions from each
// channel's computed spend. Blended industry-benchmark rates (Malaysian market
// order-of-magnitude); in production these calibrate from the agency's own
// historical performance. Surfaced in the proposal as clearly-labelled planning
// estimates — not guarantees, and still 100% deterministic.
export interface ChannelBenchmark {
  cpm: number; // RM cost per 1,000 impressions
  ctr: number; // click-through rate
  cvr: number; // click -> conversion rate
}

export const CHANNEL_BENCHMARKS: Record<Channel, ChannelBenchmark> = {
  Meta: { cpm: 18, ctr: 0.011, cvr: 0.03 },
  Google: { cpm: 32, ctr: 0.035, cvr: 0.05 },
  TikTok: { cpm: 12, ctr: 0.009, cvr: 0.02 },
  LinkedIn: { cpm: 60, ctr: 0.006, cvr: 0.04 },
};

// ---------------------------------------------------------------------------
// AD CREATIVE FORMATS — the platform-native spec each mockup is built to.
// ---------------------------------------------------------------------------
// "Platform-ready" for creative means the right aspect ratio, placement, and
// copy limits per channel. The language layer writes the copy; the mockup is
// composed deterministically to these specs.
export interface AdFormat {
  w: number;
  h: number;
  ratio: string;
  placement: string;
  headlineMax: number;
  primaryMax: number;
}

export const AD_FORMATS: Record<Channel, AdFormat> = {
  Meta: { w: 1080, h: 1350, ratio: "4:5", placement: "Feed", headlineMax: 40, primaryMax: 125 },
  Google: { w: 1200, h: 628, ratio: "1.91:1", placement: "Responsive Display", headlineMax: 30, primaryMax: 90 },
  TikTok: { w: 1080, h: 1920, ratio: "9:16", placement: "In-Feed", headlineMax: 34, primaryMax: 100 },
  LinkedIn: { w: 1200, h: 627, ratio: "1.91:1", placement: "Sponsored Content", headlineMax: 70, primaryMax: 150 },
};

// ---------------------------------------------------------------------------
// LLM (targeting + rationale layer only — never touches numbers)
// ---------------------------------------------------------------------------
// Consolidated here as the single source of truth (the Python reference had the
// model name duplicated in targeting.py; the TS port keeps it in one place).
export const LLM_MODEL = "claude-sonnet-5"; // swappable; Sonnet-class balances cost/quality
export const LLM_MAX_TOKENS = 1500;
export const LLM_TEMPERATURE = 0.4; // low: consistent, taxonomy-accurate output

// ---------------------------------------------------------------------------
// SPLIT RATIONALE  (deterministic — the LLM never explains a number)
// ---------------------------------------------------------------------------
// Why each channel earns its share, per objective. These are known strategic
// facts, so they live in config and are templated into the proposal — the
// language model is never asked to justify a budget figure it didn't compute.

export const REASON_MAP: Record<Objective, Record<Channel, string>> = {
  Awareness: {
    Meta: "Cheap, broad reach with strong creative formats for top-funnel.",
    Google: "YouTube + Display extend reach against in-market audiences.",
    TikTok: "Highest attention and discovery surface for cold audiences.",
    LinkedIn: "Precise reach to professional segments where relevant.",
  },
  Traffic: {
    Meta: "Efficient link-click delivery with rich audience signals.",
    Google: "Search captures users actively looking — high-quality clicks.",
    TikTok: "Feeds top-funnel interest into the site at low CPC.",
    LinkedIn: "Drives qualified professional traffic for B2B.",
  },
  Conversion: {
    Meta: "Best-in-class direct-response optimisation; lookalikes + retargeting.",
    Google: "Harvests existing bottom-funnel intent — cheapest conversions.",
    TikTok: "Feeder that tops up the funnel the other channels close.",
    LinkedIn: "Converts high-value B2B leads reachable by job title.",
  },
};
