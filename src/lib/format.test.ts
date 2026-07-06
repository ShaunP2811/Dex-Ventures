/**
 * format.test.ts — value flattening that guards against React error #31
 * (rendering a raw object as a child), which the live LLM can trigger by
 * returning e.g. demographics as {age, location} instead of a string.
 */

import { describe, it, expect } from "vitest";
import { valueToString } from "./format";

describe("valueToString", () => {
  it("flattens a nested object (the LLM demographics case)", () => {
    expect(valueToString({ age: "25-40", location: "Kuala Lumpur" })).toBe(
      "age: 25-40; location: Kuala Lumpur",
    );
  });

  it("handles keyword objects and plain string arrays", () => {
    expect(valueToString([{ term: "gym kl", match: "exact" }])).toBe(
      "gym kl [exact]",
    );
    expect(valueToString(["a", "b", "c"])).toBe("a, b, c");
  });

  it("passes strings through and tolerates null/undefined", () => {
    expect(valueToString("Age 25-40, KL")).toBe("Age 25-40, KL");
    expect(valueToString(null)).toBe("");
    expect(valueToString(undefined)).toBe("");
  });
});
