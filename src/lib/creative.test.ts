/**
 * creative.test.ts — the ad-copy layer. Proves per-channel generation, that
 * copy respects each platform's limits, CTA follows objective/segment, and the
 * output is deterministic and industry-adaptive.
 */

import { describe, it, expect } from "vitest";
import { generateCreatives } from "./creative";
import { AD_FORMATS, type Channel } from "./config";

const active: Channel[] = ["Meta", "Google", "TikTok"];

describe("generateCreatives", () => {
  it("produces one creative per active channel, within platform limits", () => {
    const cr = generateCreatives(active, {
      client: "Aura Fitness",
      objective: "Conversion",
      isB2b: false,
      industry: "Fitness / gym",
    });
    expect(cr.map((c) => c.channel)).toEqual(active);
    for (const c of cr) {
      const f = AD_FORMATS[c.channel];
      expect(c.headline.length).toBeLessThanOrEqual(f.headlineMax);
      expect(c.primaryText.length).toBeLessThanOrEqual(f.primaryMax);
      expect(c.ratio).toBe(f.ratio);
      expect(c.width).toBe(f.w);
    }
  });

  it("CTA follows objective + segment", () => {
    const b2c = generateCreatives(["Meta"], {
      client: "X",
      objective: "Conversion",
      isB2b: false,
    })[0];
    const b2b = generateCreatives(["Meta"], {
      client: "X",
      objective: "Conversion",
      isB2b: true,
    })[0];
    expect(b2c.cta).toBe("Sign Up");
    expect(b2b.cta).toBe("Book a Demo");
  });

  it("adapts copy to the industry topic and is deterministic", () => {
    const opts = {
      client: "Maison",
      objective: "Traffic" as const,
      isB2b: false,
      industry: "Luxury handbags",
    };
    const a = generateCreatives(["Google"], opts);
    const b = generateCreatives(["Google"], opts);
    expect(a).toEqual(b);
    expect((a[0].headline + " " + a[0].primaryText).toLowerCase()).toContain(
      "luxury handbags",
    );
  });
});
