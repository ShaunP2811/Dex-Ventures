/**
 * engine.ts — The deterministic core. Pure functions, no LLM, no randomness.
 *
 * 1:1 port of engine.py. Design principle: NO NUMBER EVER PASSES THROUGH A
 * LANGUAGE MODEL. Every figure here is reproducible and auditable. The LLM's job
 * (targeting + prose) happens in a separate layer and never touches the math.
 *
 * All tunable numbers come from ./config — nothing is hardcoded here.
 */

import {
  SETUP_FEE,
  REPORTING_FEE_PER_MONTH,
  MGMT_FEE_PCT,
  MIN_SPEND_PER_MONTH,
  BASE_MATRIX_B2C,
  BASE_MATRIX_B2B,
  CHANNEL_BENCHMARKS,
  FORCED_CHANNEL_WEIGHT,
  MARKETS,
  DEFAULT_MARKET,
  type Market,
  type Channel,
  type Objective,
  type WeightRow,
} from "./config";

/** round-half-up to 2dp — matches the Python reference on the regression set. */
function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

// ===========================================================================
// 1. FEE ENGINE  — back-solve total client budget to true media spend
// ===========================================================================

export interface FeeBreakdown {
  totalBudget: number;
  mediaSpend: number;
  mgmtFee: number;
  setupFee: number;
  reportingFee: number;
  sst: number;
  taxRate: number;
  taxLabel: string;
}

export type FeeRowKey =
  | "media"
  | "mgmt"
  | "setup"
  | "reporting"
  | "tax"
  | "total";

export interface FeeRow {
  key: FeeRowKey;
  label: string;
  amount: number;
}

/**
 * Equivalent of FeeBreakdown.as_rows() — rounded, labelled display rows.
 *
 * Reconciliation guarantee: rounding each line independently can leave the sum a
 * cent off the total (~1 in 4 arbitrary budgets). Since the whole pitch is
 * "these numbers reconcile exactly", we make the SST line absorb the sub-cent
 * rounding residual — standard invoice practice. The five line items then sum to
 * the committed budget EXACTLY, for every input. This does not change any
 * regression figure: Scenario A/B already reconciled cleanly.
 */
export function feeRows(f: FeeBreakdown): FeeRow[] {
  const total = round2(f.totalBudget);
  const media = round2(f.mediaSpend);
  const mgmt = round2(f.mgmtFee);
  const setup = round2(f.setupFee);
  const reporting = round2(f.reportingFee);
  const tax = round2(total - media - mgmt - setup - reporting);
  const taxLabel = `${f.taxLabel} ${Math.round(f.taxRate * 100)}% on services`;
  return [
    { key: "media", label: "Media spend", amount: media },
    { key: "mgmt", label: `Ad management (${Math.round(MGMT_FEE_PCT * 100)}%)`, amount: mgmt },
    { key: "setup", label: "Setup fee", amount: setup },
    { key: "reporting", label: "Reporting fee", amount: reporting },
    { key: "tax", label: taxLabel, amount: tax },
    { key: "total", label: "TOTAL", amount: round2(media + mgmt + setup + reporting + tax) },
  ];
}

/**
 * Smallest total budget for which at least one channel can clear the per-month
 * learning-phase floor after fixed fees. Below this, `computeFees` would return
 * a media spend under the floor (or negative) — the boundary the API rejects.
 */
export function minViableBudget(
  months: number,
  taxRate: number = MARKETS[DEFAULT_MARKET].taxRate,
): number {
  const fixed = SETUP_FEE + REPORTING_FEE_PER_MONTH * months;
  const media = MIN_SPEND_PER_MONTH * months;
  return media * (1 + MGMT_FEE_PCT * (1 + taxRate)) + fixed * (1 + taxRate);
}

/**
 * Closed-form back-solve.
 *
 *     total = media + fixed + mgmt%*media + sst%*(fixed + mgmt%*media)
 *
 * where fixed = setup + reporting_total, and SST applies to service fees only.
 * Rearranged:
 *
 *     media = (total - fixed*(1+sst%)) / (1 + mgmt%*(1+sst%))
 */
export function computeFees(
  totalBudget: number,
  months: number,
  market: Market = MARKETS[DEFAULT_MARKET],
): FeeBreakdown {
  const setup = SETUP_FEE;
  const reportingTotal = REPORTING_FEE_PER_MONTH * months;
  const fixed = setup + reportingTotal;
  const m = MGMT_FEE_PCT;
  const s = market.taxRate;

  const media = (totalBudget - fixed * (1 + s)) / (1 + m * (1 + s));
  const mgmt = m * media;
  const sst = s * (fixed + mgmt); // tax on services only, not media pass-through

  return {
    totalBudget,
    mediaSpend: media,
    mgmtFee: mgmt,
    setupFee: setup,
    reportingFee: reportingTotal,
    sst,
    taxRate: s,
    taxLabel: market.taxLabel,
  };
}

// ===========================================================================
// 2. ALLOCATION ENGINE  — objective-driven split + minimum-spend floor
// ===========================================================================

export interface Allocation {
  perChannel: Record<string, number>; // channel -> RM
  percentages: Record<string, number>; // channel -> fraction of media
  dropped: string[];
  notes: string[];
}

/** Format matching Python's `f"{x:,.0f}"` (thousands separator, 0 decimals). */
function fmtThousands0(x: number): string {
  return x.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function baseWeights(objective: Objective, isB2b: boolean): Record<string, number> {
  const matrix = isB2b ? BASE_MATRIX_B2B : BASE_MATRIX_B2C;
  const row: WeightRow = matrix[objective];
  const out: Record<string, number> = {};
  // Preserve declared channel order; keep only positive weights (v > 0).
  for (const key of Object.keys(row) as Channel[]) {
    const v = row[key];
    if (v > 0) out[key] = v;
  }
  return out;
}

/**
 * 1. Seed weights from the objective row (B2C or B2B matrix).
 * 2. Allocate media by weight.
 * 3. Floor check: any channel below MIN_SPEND_PER_MONTH*months is dropped,
 *    smallest-first, and its budget redistributed to survivors (renormalised by
 *    original weight). Iterates until stable — concentrates a small budget on the
 *    1–2 channels that can actually perform.
 */
/** The channels an objective/segment uses by default (positive base weight). */
export function activeChannelsFor(
  objective: Objective,
  isB2b: boolean,
): Channel[] {
  return Object.keys(baseWeights(objective, isB2b)) as Channel[];
}

export function allocate(
  mediaSpend: number,
  objective: Objective,
  isB2b: boolean,
  months: number,
  included?: Channel[],
): Allocation {
  const row: WeightRow = (isB2b ? BASE_MATRIX_B2B : BASE_MATRIX_B2C)[objective];
  // Default to the objective's native channels; otherwise use exactly what the
  // user selected, giving off-matrix picks a balanced minority weight.
  const channels =
    included ?? (Object.keys(row) as Channel[]).filter((c) => row[c] > 0);
  const weights: Record<string, number> = {};
  for (const ch of channels) {
    const w = row[ch as Channel] ?? 0;
    weights[ch] = w > 0 ? w : FORCED_CHANNEL_WEIGHT;
  }
  const floor = MIN_SPEND_PER_MONTH * months;
  const dropped: string[] = [];
  const notes: string[] = [];

  while (true) {
    const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
    const alloc: Record<string, number> = {};
    for (const c of Object.keys(weights)) {
      alloc[c] = mediaSpend * (weights[c] / totalW);
    }

    // Below-floor channels, in weight/insertion order.
    const below: Record<string, number> = {};
    for (const c of Object.keys(alloc)) {
      if (alloc[c] < floor) below[c] = alloc[c];
    }

    const numWeights = Object.keys(weights).length;
    if (Object.keys(below).length === 0 || numWeights <= 1) break;

    // Drop the single smallest below-floor channel (first on ties), then re-loop.
    let victim: string | null = null;
    let minVal = Infinity;
    for (const c of Object.keys(below)) {
      if (below[c] < minVal) {
        minVal = below[c];
        victim = c;
      }
    }
    if (victim === null) break; // unreachable given the guard above

    dropped.push(victim);
    notes.push(
      `${victim} excluded: allocated budget (RM${fmtThousands0(alloc[victim])}) ` +
        `below minimum viable threshold (RM${fmtThousands0(floor)}) for algorithmic ` +
        `optimization; funds concentrated in remaining channels.`,
    );
    delete weights[victim];
  }

  const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
  const perChannel: Record<string, number> = {};
  const percentages: Record<string, number> = {};
  for (const c of Object.keys(weights)) {
    perChannel[c] = mediaSpend * (weights[c] / totalW);
    percentages[c] = perChannel[c] / mediaSpend;
  }

  return { perChannel, percentages, dropped, notes };
}

// ===========================================================================
// 3. ORCHESTRATION  — one call, full deterministic plan (pre-LLM)
// ===========================================================================

export interface MediaPlan {
  client: string;
  objective: Objective;
  isB2b: boolean;
  months: number;
  fees: FeeBreakdown;
  allocation: Allocation;
}

export function buildPlan(
  client: string,
  objective: Objective,
  totalBudget: number,
  months: number,
  isB2b: boolean,
  market: Market = MARKETS[DEFAULT_MARKET],
  included?: Channel[],
): MediaPlan {
  const fees = computeFees(totalBudget, months, market);
  const allocation = allocate(fees.mediaSpend, objective, isB2b, months, included);
  return { client, objective, isB2b, months, fees, allocation };
}

// ===========================================================================
// 4. DELIVERY PROJECTION  — illustrative reach from spend (deterministic)
// ===========================================================================

export interface ChannelProjection {
  impressions: number;
  clicks: number;
  conversions: number;
}

/**
 * Projects illustrative delivery from each channel's computed spend using the
 * benchmark rates in config. Pure and deterministic — these are planning
 * estimates, not guarantees, and (like everything numeric) never touch the LLM.
 */
export function projectDelivery(
  perChannel: Record<string, number>,
): Record<string, ChannelProjection> {
  const out: Record<string, ChannelProjection> = {};
  for (const [ch, amount] of Object.entries(perChannel)) {
    const b = CHANNEL_BENCHMARKS[ch as Channel];
    if (!b) continue;
    const impressions = (amount / b.cpm) * 1000;
    const clicks = impressions * b.ctr;
    const conversions = clicks * b.cvr;
    out[ch] = {
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      conversions: Math.round(conversions),
    };
  }
  return out;
}
