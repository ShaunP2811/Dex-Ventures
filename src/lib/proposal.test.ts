/**
 * proposal.test.ts — the assembly layer. Proves the client-ready proposal
 * reconciles, drops channels correctly, projects deterministic delivery, and —
 * critically — never leaks a computed money figure into the LLM-facing targeting.
 */

import { describe, it, expect } from "vitest";
import { assembleProposal } from "./proposal";
import type { PlanInput } from "./types";

const A: PlanInput = {
  client: "Aura Fitness",
  objective: "Conversion",
  totalBudget: 50_000,
  months: 2,
  isB2b: false,
  guidance: "gym members in KL, 25-40",
};

describe("assembleProposal", () => {
  it("reconciles fee lines exactly to the budget (Scenario A)", async () => {
    const p = await assembleProposal(A);
    const items = p.fees
      .filter((f) => f.label !== "TOTAL")
      .reduce((a, f) => a + f.amount, 0);
    expect(Math.round(items * 100) / 100).toBe(50_000);
    expect(p.fees.find((f) => f.label === "TOTAL")!.amount).toBe(50_000);
    expect(p.targetingSource).toBe("mock_sample");
  });

  it("drops TikTok and targets only survivors at RM15,000 (Scenario B)", async () => {
    const p = await assembleProposal({ ...A, totalBudget: 15_000 });
    expect(p.allocation.map((a) => a.channel).sort()).toEqual(["Google", "Meta"]);
    expect(Object.keys(p.targeting).sort()).toEqual(["Google", "Meta"]);
    expect(p.floorNotes).toHaveLength(1);
  });

  it("never leaks a computed money figure into the targeting (the invariant)", async () => {
    const p = await assembleProposal(A);
    const forbidden = new Set<string>();
    for (const f of p.fees) forbidden.add(String(Math.round(f.amount)));
    for (const a of p.allocation) forbidden.add(String(Math.round(a.amount)));
    forbidden.add(String(p.totalBudget));
    const blob = JSON.stringify(p.targeting);
    for (const tok of forbidden) {
      if (tok.length >= 4) expect(blob).not.toContain(tok);
    }
  });

  it("respects an explicit channel selection and still summarises it", async () => {
    const p = await assembleProposal({ ...A, channels: ["Meta", "TikTok"] });
    const chs = p.allocation.map((a) => a.channel).sort();
    expect(chs).toEqual(["Meta", "TikTok"]);
    expect(p.allocationSummary.length).toBeGreaterThan(0);
  });

  it("projects deterministic, budget-scaling delivery", async () => {
    const small = await assembleProposal({ ...A, totalBudget: 15_000 });
    const big = await assembleProposal(A);
    const sImp = small.delivery.reduce((a, d) => a + d.impressions, 0);
    const bImp = big.delivery.reduce((a, d) => a + d.impressions, 0);
    expect(bImp).toBeGreaterThan(sImp);
    // deterministic across runs
    const again = await assembleProposal(A);
    expect(again.delivery).toEqual(big.delivery);
  });
});
