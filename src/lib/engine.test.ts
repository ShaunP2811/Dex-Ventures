/**
 * engine.test.ts — Regression + invariant suite for the deterministic engine.
 *
 * Three layers:
 *   1. LOCKED SCENARIOS  — the exact CLAUDE.md contract (A & B). If a number here
 *      disagrees with the Python reference, the PORT is wrong — fix engine.ts /
 *      config.ts, never these expected values.
 *   2. INVARIANTS        — properties that must hold for ANY input: the fee
 *      back-solve reconciles, SST taxes services only, allocation is complete,
 *      the floor rule is respected. These guard the ONE INVARIANT structurally.
 *   3. COVERAGE          — the "dynamic allocation" story: objective migration
 *      and B2B/B2C segment logic (the second locked piece), previously untested.
 */

import { describe, it, expect } from "vitest";
import {
  buildPlan,
  computeFees,
  allocate,
  activeChannelsFor,
  feeRows,
  type FeeRow,
} from "./engine";
import {
  MIN_SPEND_PER_MONTH,
  SETUP_FEE,
  REPORTING_FEE_PER_MONTH,
  MGMT_FEE_PCT,
  SST_PCT,
  MARKETS,
  type Objective,
} from "./config";

// --- helpers ---------------------------------------------------------------

const MONEY_TOL = 0.01; // ±0.01, the rounding tolerance CLAUDE.md allows
const EPS = 1e-6; // float slack for exact algebraic identities

function close(actual: number, expected: number, tol = MONEY_TOL): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
}

/** Percentage at the reference's 1dp display precision (proposal.py: round(x*100, 1)). */
function pct1(fraction: number): number {
  return Math.round(fraction * 100 * 10) / 10;
}

function row(rows: FeeRow[], label: string): number {
  const r = rows.find((x) => x.label === label);
  if (!r) throw new Error(`fee row not found: ${label}`);
  return r.amount;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

// ===========================================================================
// 1. LOCKED SCENARIOS — the CLAUDE.md contract
// ===========================================================================

describe("Scenario A — Aura Fitness, Conversion, B2C, RM50,000, 2 months", () => {
  const plan = buildPlan("Aura Fitness", "Conversion", 50_000, 2, false);
  const rows = feeRows(plan.fees);

  it("fee back-solve matches the reference to the cent", () => {
    close(row(rows, "Media spend"), 40_148.02);
    close(row(rows, "Ad management (15%)"), 6_022.2);
    close(row(rows, "Setup fee"), 1_500);
    close(row(rows, "Reporting fee"), 1_600);
    close(row(rows, "SST 8% on services"), 729.78);
    close(row(rows, "TOTAL"), 50_000.0);
  });

  it("reconciles: line items sum exactly to the input budget", () => {
    const lineItems = sum(
      rows.filter((r) => r.label !== "TOTAL").map((r) => r.amount),
    );
    expect(round2(lineItems)).toBe(50_000.0);
  });

  it("allocation splits Google 45% / Meta 40% / TikTok 15%", () => {
    expect(pct1(plan.allocation.percentages.Google)).toBe(45.0);
    expect(pct1(plan.allocation.percentages.Meta)).toBe(40.0);
    expect(pct1(plan.allocation.percentages.TikTok)).toBe(15.0);
  });

  it("allocation amounts match the reference", () => {
    close(plan.allocation.perChannel.Google, 18_066.61);
    close(plan.allocation.perChannel.Meta, 16_059.21);
    close(plan.allocation.perChannel.TikTok, 6_022.2);
  });

  it("keeps exactly the three B2C channels, none dropped", () => {
    expect(Object.keys(plan.allocation.perChannel).sort()).toEqual([
      "Google",
      "Meta",
      "TikTok",
    ]);
    expect(plan.allocation.dropped).toHaveLength(0);
    expect(plan.allocation.notes).toHaveLength(0);
  });
});

describe("Scenario B — same but RM15,000 (TikTok below floor)", () => {
  const plan = buildPlan("Aura Fitness", "Conversion", 15_000, 2, false);
  const floor = MIN_SPEND_PER_MONTH * 2; // 4,000

  it("drops TikTok, and only TikTok, below the minimum-spend floor", () => {
    expect(plan.allocation.dropped).toEqual(["TikTok"]);
    expect(plan.allocation.perChannel).not.toHaveProperty("TikTok");
  });

  it("states the drop reason exactly (proposal deliverable)", () => {
    expect(plan.allocation.notes).toEqual([
      "TikTok excluded: allocated budget (RM1,504) below minimum viable " +
        "threshold (RM4,000) for algorithmic optimization; funds concentrated " +
        "in remaining channels.",
    ]);
  });

  it("Google and Meta survive, both above the floor", () => {
    expect(Object.keys(plan.allocation.perChannel).sort()).toEqual([
      "Google",
      "Meta",
    ]);
    expect(plan.allocation.perChannel.Google).toBeGreaterThan(floor);
    expect(plan.allocation.perChannel.Meta).toBeGreaterThan(floor);
  });

  it("survivors renormalise to 52.9% Google / 47.1% Meta", () => {
    expect(pct1(plan.allocation.percentages.Google)).toBe(52.9);
    expect(pct1(plan.allocation.percentages.Meta)).toBe(47.1);
  });

  it("fees still reconcile to the input budget", () => {
    close(row(feeRows(plan.fees), "TOTAL"), 15_000.0);
  });
});

// ===========================================================================
// 2. INVARIANTS — must hold for ANY input
// ===========================================================================

const BUDGET_GRID: Array<[number, number]> = [
  [15_000, 2],
  [50_000, 2],
  [50_000, 3],
  [8_000, 1],
  [100_000, 6],
  [250_000, 1],
];

describe("Fee invariants (hold for any budget)", () => {
  it.each(BUDGET_GRID)(
    "back-solve reconciles exactly: parts sum to input (RM%d / %d mo)",
    (total, months) => {
      const f = computeFees(total, months);
      const partsSum =
        f.mediaSpend + f.mgmtFee + f.setupFee + f.reportingFee + f.sst;
      close(partsSum, total, EPS);
    },
  );

  it.each(BUDGET_GRID)(
    "SST taxes SERVICES only — media is never in the tax base (RM%d / %d mo)",
    (total, months) => {
      const f = computeFees(total, months);
      const servicesOnly = SST_PCT * (f.setupFee + f.reportingFee + f.mgmtFee);
      close(f.sst, servicesOnly, EPS);
      // And prove media is excluded: taxing it too would be strictly larger.
      const ifMediaTaxed = servicesOnly + SST_PCT * f.mediaSpend;
      expect(f.sst).toBeLessThan(ifMediaTaxed - EPS);
    },
  );

  it.each(BUDGET_GRID)(
    "management fee is exactly 15%% of media (RM%d / %d mo)",
    (total, months) => {
      const f = computeFees(total, months);
      close(f.mgmtFee, MGMT_FEE_PCT * f.mediaSpend, EPS);
      // Fixed fees are budget-independent.
      expect(f.setupFee).toBe(SETUP_FEE);
      expect(f.reportingFee).toBe(REPORTING_FEE_PER_MONTH * months);
    },
  );
});

describe("Display reconciliation — fee lines sum EXACTLY to the budget", () => {
  it.each(BUDGET_GRID)(
    "feeRows reconciles to the cent (RM%d / %d mo)",
    (total, months) => {
      const rows = feeRows(computeFees(total, months));
      const items = sum(
        rows.filter((r) => r.label !== "TOTAL").map((r) => r.amount),
      );
      const totalRow = rows.find((r) => r.label === "TOTAL")!.amount;
      expect(round2(items)).toBe(round2(total));
      expect(round2(totalRow)).toBe(round2(total));
    },
  );

  it("has ZERO mismatches across a fine budget sweep (the bug this fixes)", () => {
    let mismatches = 0;
    for (let cents = 0; cents < 20_000; cents++) {
      const total = 8_000 + cents / 100; // RM8,000.00 .. RM9,999.99, all viable
      const rows = feeRows(computeFees(total, 1));
      const items = sum(
        rows.filter((r) => r.label !== "TOTAL").map((r) => r.amount),
      );
      if (round2(items) !== round2(total)) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});

describe("Allocation invariants (hold for any budget/objective/segment)", () => {
  const objectives: Objective[] = ["Awareness", "Traffic", "Conversion"];
  const cases: Array<[number, number, Objective, boolean]> = [];
  for (const [total, months] of BUDGET_GRID) {
    for (const obj of objectives) {
      for (const b2b of [false, true]) {
        cases.push([total, months, obj, b2b]);
      }
    }
  }

  it.each(cases)(
    "is complete and floored (RM%d / %d mo / %s / b2b=%s)",
    (total, months, objective, isB2b) => {
      const f = computeFees(total, months);
      const a = allocate(f.mediaSpend, objective, isB2b, months);
      const floor = MIN_SPEND_PER_MONTH * months;
      const survivors = Object.values(a.perChannel);

      // Always keeps at least one channel.
      expect(survivors.length).toBeGreaterThanOrEqual(1);
      // Nothing is both kept and dropped.
      for (const d of a.dropped) {
        expect(a.perChannel).not.toHaveProperty(d);
      }
      // Every allocated RM is deployed — perChannel sums to media.
      close(sum(survivors), f.mediaSpend, EPS);
      // Percentages sum to 1.
      close(sum(Object.values(a.percentages)), 1, EPS);
      // Floor rule: with >1 survivor, all clear the floor (single survivor is
      // the degenerate concentration case and may sit below it by design).
      if (survivors.length > 1) {
        for (const v of survivors) expect(v).toBeGreaterThanOrEqual(floor);
      }
      // One note per dropped channel.
      expect(a.notes).toHaveLength(a.dropped.length);
    },
  );
});

// ===========================================================================
// 3. COVERAGE — the dynamic-allocation story (second locked piece)
// ===========================================================================

describe("Objective migration (B2C, budget large enough that nothing drops)", () => {
  // 250k over 1 month keeps even TikTok's 15% share far above the floor.
  const shares = (objective: Objective) =>
    buildPlan("X", objective, 250_000, 1, false).allocation.percentages;

  const awareness = shares("Awareness");
  const traffic = shares("Traffic");
  const conversion = shares("Conversion");

  it("migrates budget toward Google as intent rises (Awareness→Conversion)", () => {
    expect(awareness.Google).toBeLessThan(traffic.Google);
    expect(traffic.Google).toBeLessThan(conversion.Google);
  });

  it("migrates budget away from TikTok as intent rises", () => {
    expect(awareness.TikTok).toBeGreaterThan(traffic.TikTok);
    expect(traffic.TikTok).toBeGreaterThan(conversion.TikTok);
  });

  it("keeps Meta steady (full-funnel) across objectives", () => {
    close(awareness.Meta, traffic.Meta, EPS);
    close(traffic.Meta, conversion.Meta, EPS);
  });
});

describe("Segment logic — B2B activates LinkedIn, kills TikTok", () => {
  const b2b = buildPlan("X", "Conversion", 250_000, 1, true).allocation;
  const b2c = buildPlan("X", "Conversion", 250_000, 1, false).allocation;

  it("B2B Conversion runs LinkedIn and drops TikTok entirely", () => {
    expect(b2b.perChannel).toHaveProperty("LinkedIn");
    expect(b2b.perChannel).not.toHaveProperty("TikTok");
    expect(b2b.dropped).not.toContain("TikTok"); // never activated, not "dropped"
  });

  it("B2C never activates LinkedIn", () => {
    expect(b2c.perChannel).not.toHaveProperty("LinkedIn");
  });
});

describe("Determinism", () => {
  it("produces identical plans across runs (pure functions)", () => {
    const a = buildPlan("X", "Conversion", 15_000, 2, false);
    const b = buildPlan("X", "Conversion", 15_000, 2, false);
    expect(a).toEqual(b);
  });
});

// ===========================================================================
// Market parameterisation — MY default unchanged, SG (GST 9%) supported
// ===========================================================================

describe("Markets", () => {
  it("MY default is byte-identical to the locked figures", () => {
    const dflt = computeFees(50_000, 2);
    const my = computeFees(50_000, 2, MARKETS.MY);
    expect(dflt.mediaSpend).toBe(my.mediaSpend);
    close(feeRows(my).find((r) => r.key === "media")!.amount, 40_148.02);
    expect(feeRows(my).find((r) => r.key === "tax")!.label).toBe(
      "SST 8% on services",
    );
  });

  it("Singapore applies GST 9% and still reconciles exactly", () => {
    const f = computeFees(50_000, 2, MARKETS.SG);
    expect(f.taxRate).toBe(0.09);
    const rows = feeRows(f);
    expect(rows.find((r) => r.key === "tax")!.label).toBe("GST 9% on services");
    const items = sum(
      rows.filter((r) => r.key !== "total").map((r) => r.amount),
    );
    expect(round2(items)).toBe(50_000);
    expect(rows.find((r) => r.key === "total")!.amount).toBe(50_000);
  });

  it("higher tax leaves less media spend", () => {
    const my = computeFees(50_000, 2, MARKETS.MY);
    const sg = computeFees(50_000, 2, MARKETS.SG);
    expect(sg.mediaSpend).toBeLessThan(my.mediaSpend);
  });
});

describe("Channel exclusion (customisation)", () => {
  it("activeChannelsFor lists positive-weight channels minus excluded", () => {
    expect(activeChannelsFor("Conversion", false).sort()).toEqual([
      "Google",
      "Meta",
      "TikTok",
    ]);
    expect(activeChannelsFor("Conversion", false, ["TikTok"]).sort()).toEqual([
      "Google",
      "Meta",
    ]);
  });

  it("allocate drops an excluded channel and redistributes to survivors", () => {
    const f = computeFees(50_000, 2);
    const a = allocate(f.mediaSpend, "Conversion", false, 2, ["TikTok"]);
    expect(Object.keys(a.perChannel).sort()).toEqual(["Google", "Meta"]);
    close(sum(Object.values(a.perChannel)), f.mediaSpend, EPS);
    expect(round2(sum(Object.values(a.percentages)))).toBe(1);
  });
});
