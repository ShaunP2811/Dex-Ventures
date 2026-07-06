/**
 * verify.test.ts — independent math cross-check.
 *
 * Recomputes fees, allocation ratios, and delivery from first principles (a
 * separate implementation) and asserts the engine agrees, across a sweep of
 * budgets / durations / markets / objectives / segments. This is deliberately
 * NOT the engine's own code — if the engine had a formula bug, this catches it.
 */

import { describe, it, expect } from "vitest";
import { computeFees, feeRows, allocate, projectDelivery } from "./engine";
import {
  SETUP_FEE,
  REPORTING_FEE_PER_MONTH,
  MGMT_FEE_PCT,
  MARKETS,
  CHANNEL_BENCHMARKS,
  BASE_MATRIX_B2C,
  BASE_MATRIX_B2B,
  type Market,
  type Objective,
  type Channel,
} from "./config";

const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const EPS = 1e-9;

const budgets = [8000, 15000, 23456.78, 50000, 100000, 250000];
const durations = [1, 2, 3, 6];
const markets: Market[] = [MARKETS.MY, MARKETS.SG];

describe("Fees match a first-principles recomputation", () => {
  const cases: [number, number, Market][] = [];
  for (const b of budgets)
    for (const m of durations) for (const mk of markets) cases.push([b, m, mk]);

  it.each(cases)("RM%d / %d mo / %s", (b, m, mk) => {
    const tax = mk.taxRate;
    const fixed = SETUP_FEE + REPORTING_FEE_PER_MONTH * m;
    // closed-form back-solve, computed independently here:
    const media = (b - fixed * (1 + tax)) / (1 + MGMT_FEE_PCT * (1 + tax));
    const mgmt = MGMT_FEE_PCT * media;
    const sst = tax * (fixed + mgmt); // tax on SERVICE fees only

    const f = computeFees(b, m, mk);
    expect(Math.abs(f.mediaSpend - media)).toBeLessThan(EPS);
    expect(Math.abs(f.mgmtFee - mgmt)).toBeLessThan(EPS);
    expect(Math.abs(f.sst - sst)).toBeLessThan(EPS);

    // the true (unrounded) parts sum to the budget — reconciliation by identity
    expect(
      Math.abs(media + mgmt + SETUP_FEE + REPORTING_FEE_PER_MONTH * m + sst - b),
    ).toBeLessThan(1e-6);

    // displayed lines reconcile to the budget EXACTLY, to the cent
    const rows = feeRows(f);
    const items = rows
      .filter((x) => x.key !== "total")
      .reduce((a, x) => a + x.amount, 0);
    expect(r2(items)).toBe(r2(b));
    expect(rows.find((x) => x.key === "total")!.amount).toBe(r2(b));

    // displayed tax stays within a rounding cent of the true tax-on-services
    const taxRow = rows.find((x) => x.key === "tax")!.amount;
    expect(Math.abs(taxRow - r2(sst))).toBeLessThanOrEqual(0.02);
  });
});

describe("Allocation ratios equal the base matrix (no floor drops)", () => {
  const cases: [Objective, boolean][] = [
    ["Awareness", false],
    ["Traffic", false],
    ["Conversion", false],
    ["Awareness", true],
    ["Traffic", true],
    ["Conversion", true],
  ];

  it.each(cases)("%s / b2b=%s", (obj, b2b) => {
    const media = 500_000; // large enough that nothing hits the floor
    const matrix = b2b ? BASE_MATRIX_B2B : BASE_MATRIX_B2C;
    const base: Record<string, number> = {};
    for (const [k, v] of Object.entries(matrix[obj])) if (v > 0) base[k] = v;
    const sumW = Object.values(base).reduce((a, x) => a + x, 0);

    const a = allocate(media, obj, b2b, 1);
    expect(Object.keys(a.perChannel).sort()).toEqual(Object.keys(base).sort());
    for (const ch of Object.keys(base)) {
      expect(Math.abs(a.percentages[ch] - base[ch] / sumW)).toBeLessThan(1e-12);
      expect(Math.abs(a.perChannel[ch] - (media * base[ch]) / sumW)).toBeLessThan(
        1e-6,
      );
    }
    expect(
      Math.abs(Object.values(a.perChannel).reduce((x, y) => x + y, 0) - media),
    ).toBeLessThan(1e-6);
  });
});

describe("Delivery projections match the benchmark formula exactly", () => {
  it("impressions = spend/CPM*1000, clicks = impr*CTR, conv = clicks*CVR", () => {
    const per: Record<string, number> = {
      Meta: 16059.21,
      Google: 18066.61,
      TikTok: 6022.2,
    };
    const proj = projectDelivery(per);
    for (const [ch, amt] of Object.entries(per)) {
      const b = CHANNEL_BENCHMARKS[ch as Channel];
      const impU = (amt / b.cpm) * 1000;
      const clU = impU * b.ctr;
      const cvU = clU * b.cvr;
      expect(proj[ch].impressions).toBe(Math.round(impU));
      expect(proj[ch].clicks).toBe(Math.round(clU));
      expect(proj[ch].conversions).toBe(Math.round(cvU));
    }
  });
});
