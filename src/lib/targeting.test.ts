/**
 * targeting.test.ts — the LLM layer. Covers the adaptive mock, the guard that
 * re-filters model output to surviving channels, and the live path + fallback.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateTargeting,
  filterToActive,
  generateTargetingSmart,
} from "./targeting";
import type { Channel } from "./config";

describe("mock targeting — adaptive", () => {
  it("returns only the active (surviving) channels", () => {
    const r = generateTargeting(["Meta", "Google"], "gym in KL", "Conversion", false);
    expect(Object.keys(r.targeting).sort()).toEqual(["Google", "Meta"]);
    expect(r.source).toBe("mock_sample");
  });

  it("uses curated fitness targeting when the brief is fitness", () => {
    const r = generateTargeting(
      ["Meta"],
      "gym members in Kuala Lumpur, 25-40",
      "Conversion",
      false,
    );
    const meta = r.targeting.Meta!;
    expect((meta.interests as string[]).join(" ").toLowerCase()).toContain("gym");
    expect(String(meta.demographics)).toContain("Kuala Lumpur");
    expect(String(meta.demographics)).toContain("25-40");
  });

  it("adapts to an arbitrary vertical + geo + age from the brief", () => {
    const r = generateTargeting(
      ["Meta", "Google"],
      "luxury handbags for women in Penang, 30-45",
      "Traffic",
      false,
    );
    const meta = r.targeting.Meta!;
    expect(String(meta.demographics)).toContain("Penang");
    expect(String(meta.demographics)).toContain("30-45");
    expect((meta.interests as string[]).join(" ").toLowerCase()).toMatch(
      /luxury|handbags/,
    );
    const kws = (r.targeting.Google!.keywords as { term: string }[])
      .map((k) => k.term)
      .join(" ")
      .toLowerCase();
    expect(kws).toMatch(/luxury|handbags/);
    expect(kws).toContain("penang");
  });
});

describe("targeting guard — filterToActive", () => {
  it("drops channels the model returned that were NOT allocated", () => {
    const parsed = { Meta: { a: 1 }, Google: { b: 2 }, TikTok: { c: 3 } };
    const out = filterToActive(parsed, ["Meta", "Google"] as Channel[]);
    expect(Object.keys(out).sort()).toEqual(["Google", "Meta"]);
  });
});

describe("generateTargetingSmart — live path + graceful fallback", () => {
  const active: Channel[] = ["Meta", "Google"];

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
  });

  it("uses the mock when no key is set", async () => {
    const r = await generateTargetingSmart(active, "gym", "Conversion", false);
    expect(r.source).toBe("mock_sample");
  });

  it("calls the live model and filters its output to active channels", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "test-model";
    const content = JSON.stringify({
      Meta: { interests: ["a"] },
      Google: { keywords: [] },
      TikTok: { interests: ["should be dropped"] },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content } }] }),
      })),
    );
    const r = await generateTargetingSmart(active, "gym", "Conversion", false);
    expect(r.source).toBe("llm:test-model");
    expect(Object.keys(r.targeting).sort()).toEqual(["Google", "Meta"]);
  });

  it("falls back to the mock on an LLM error", async () => {
    process.env.LLM_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );
    const r = await generateTargetingSmart(active, "gym", "Conversion", false);
    expect(r.source).toMatch(/^mock_sample \(llm/);
    expect(Object.keys(r.targeting).sort()).toEqual(["Google", "Meta"]);
  });
});
