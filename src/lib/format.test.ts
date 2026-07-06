/**
 * format.test.ts — value flattening that guards against React error #31
 * (rendering a raw object as a child), which the live LLM can trigger by
 * returning e.g. demographics as {age, location} instead of a string.
 */

import { describe, it, expect } from "vitest";
import { valueToString, hasValue } from "./format";

describe("valueToString", () => {
  it("drops null / empty entries instead of printing 'null'", () => {
    expect(valueToString(["a", null, "", "b", undefined])).toBe("a, b");
    expect(valueToString({ a: "x", b: null, c: "" })).toBe("a: x");
    expect(valueToString(null)).toBe("");
  });

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

describe("hasValue", () => {
  it("is false for null / undefined / empty", () => {
    for (const v of [null, undefined, "", [], [null, ""], { a: null }]) {
      expect(hasValue(v)).toBe(false);
    }
  });
  it("is true for real values", () => {
    for (const v of ["x", ["a"], { a: "x" }]) {
      expect(hasValue(v)).toBe(true);
    }
  });
});
