/**
 * site.test.ts — brand extraction + the SSRF guard (pure functions).
 */

import { describe, it, expect } from "vitest";
import { parseSiteBrand, isBlockedHost, normalizeUrl } from "./site";

describe("normalizeUrl", () => {
  it("adds https:// when the scheme is missing", () => {
    expect(normalizeUrl("nike.com")).toBe("https://nike.com/");
  });
  it("keeps an explicit scheme", () => {
    expect(normalizeUrl("http://x.com")).toBe("http://x.com/");
  });
  it("returns null for empty input", () => {
    expect(normalizeUrl("   ")).toBeNull();
  });
});

describe("isBlockedHost (SSRF guard)", () => {
  it("blocks loopback / private / link-local hosts", () => {
    for (const h of [
      "localhost",
      "127.0.0.1",
      "10.0.0.5",
      "192.168.1.1",
      "169.254.169.254",
      "172.16.0.1",
      "::1",
    ]) {
      expect(isBlockedHost(h)).toBe(true);
    }
  });
  it("allows public hosts", () => {
    for (const h of ["nike.com", "www.example.org", "8.8.8.8"]) {
      expect(isBlockedHost(h)).toBe(false);
    }
  });
});

describe("parseSiteBrand", () => {
  const html = `<html><head>
    <title>Nike. Just Do It</title>
    <meta property="og:site_name" content="Nike">
    <meta property="og:title" content="Nike Official">
    <meta name="description" content="Shoes &amp; gear">
    <meta property="og:image" content="/img/hero.jpg">
    <meta name="theme-color" content="#111111">
  </head></html>`;

  it("extracts brand signals and resolves a relative image to absolute", () => {
    const b = parseSiteBrand(html, "https://www.nike.com/");
    expect(b.host).toBe("nike.com");
    expect(b.siteName).toBe("Nike");
    expect(b.title).toBe("Nike Official");
    expect(b.description).toBe("Shoes & gear");
    expect(b.imageUrl).toBe("https://www.nike.com/img/hero.jpg");
    expect(b.themeColor).toBe("#111111");
  });

  it("tolerates content-before-property attribute order", () => {
    const h2 = `<meta content="https://x.com/a.png" property="og:image">`;
    expect(parseSiteBrand(h2, "https://x.com/").imageUrl).toBe(
      "https://x.com/a.png",
    );
  });

  it("returns no image when none is present", () => {
    expect(parseSiteBrand("<title>Bare</title>", "https://x.com/").imageUrl).toBeUndefined();
  });
});
