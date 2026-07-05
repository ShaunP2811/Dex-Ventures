/**
 * types.ts — Shared contracts between the engine, the API route, and the UI.
 * Keeping these in one place means the server and client never drift.
 */

import type { Channel, MarketCode, Objective } from "./config";
import type { FeeRowKey } from "./engine";

// --- Targeting (the LLM layer's output; mocked from sample data for now) -----

export interface Keyword {
  term: string;
  match: "exact" | "phrase" | "broad";
}

export type TargetingValue = string | string[] | Keyword[];

/** One platform's paste-ready targeting: field name -> value(s). */
export type PlatformTargeting = Record<string, TargetingValue>;

/** Only ever contains channels that survived allocation. */
export type Targeting = Partial<Record<Channel, PlatformTargeting>>;

export interface TargetingResult {
  /** Provenance marker so mock vs live LLM output is never confused. */
  source: string;
  targeting: Targeting;
}

// --- Proposal (what the API returns and the UI renders) ----------------------

export interface FeeLine {
  key: FeeRowKey;
  label: string;
  amount: number;
}

export interface AllocationRow {
  channel: Channel;
  pct: number; // percentage of media, 1dp
  amount: number; // RM, 2dp
  rationale: string;
}

export interface DeliveryRow {
  channel: Channel;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface SiteBrand {
  url: string;
  host: string;
  siteName?: string;
  title?: string;
  description?: string;
  imageUrl?: string; // og:image (or generated background) — the ad visual
  themeColor?: string;
}

export interface AdCreative {
  channel: Channel;
  headline: string;
  primaryText: string;
  cta: string;
  ratio: string;
  placement: string;
  width: number;
  height: number;
}

export interface Proposal {
  client: string;
  objective: Objective;
  segment: "B2C" | "B2B";
  months: number;
  totalBudget: number;
  currency: string;
  marketName: string;
  taxRate: number;
  taxLabel: string;
  industry?: string;
  fees: FeeLine[];
  allocation: AllocationRow[];
  allocationSummary: string;
  delivery: DeliveryRow[];
  creatives: AdCreative[];
  site?: SiteBrand;
  floorNotes: string[];
  targetingSource: string;
  targeting: Targeting;
}

// --- Input (form -> API) -----------------------------------------------------

export interface PlanInput {
  client: string;
  objective: Objective;
  totalBudget: number;
  months: number;
  isB2b: boolean;
  guidance: string;
  market?: MarketCode;
  industry?: string;
  website?: string;
  excludedChannels?: Channel[];
}
