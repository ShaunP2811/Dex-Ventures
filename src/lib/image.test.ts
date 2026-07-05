/**
 * image.test.ts — the objective-aware ad-image prompt builder.
 */

import { describe, it, expect } from "vitest";
import { buildImagePrompt } from "./image";

describe("buildImagePrompt", () => {
  it("bakes the campaign objective into the creative direction", () => {
    const conv = buildImagePrompt({
      client: "Acme",
      objective: "Conversion",
      isB2b: false,
    });
    const aware = buildImagePrompt({
      client: "Acme",
      objective: "Awareness",
      isB2b: false,
    });
    expect(conv).toContain("Conversion");
    expect(conv.toLowerCase()).toContain("product-hero");
    expect(aware.toLowerCase()).toContain("aspirational");
    // negative constraints always present so copy/frame sit cleanly on top
    expect(conv).toContain("No text");
  });

  it("reflects B2B vs B2C and includes brand context when given", () => {
    const b2b = buildImagePrompt({
      client: "Acme",
      objective: "Traffic",
      isB2b: true,
      industry: "SaaS",
      siteDescription: "developer tools",
    });
    expect(b2b).toContain("B2B setting");
    expect(b2b).toContain("developer tools");
  });
});
