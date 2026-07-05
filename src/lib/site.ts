/**
 * site.ts — pulls a client's own brand signals from their website so the ad
 * mockups can be built on their REAL imagery (og:image), colours, and copy.
 *
 * Server-side only. Because the URL is user-supplied, the fetch is SSRF-guarded:
 * https/http only, and obvious internal/loopback/link-local hosts are blocked.
 * (Note: full SSRF hardening would also resolve DNS and re-check the IP; for this
 * MVP the host checks + timeout + HTML-only + size cap are a reasonable guard.)
 */

import type { SiteBrand } from "./types";

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    return u.toString();
  } catch {
    return null;
  }
}

export function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "0.0.0.0" || h === "::1" || h === "::" ) return true;
  // IPv4 loopback / private / link-local
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  // IPv6 unique-local / link-local
  if (/^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h)) return true;
  return false;
}

/** Find a <meta> content by property/name, tolerant of attribute order. */
function metaContent(html: string, key: string): string | undefined {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i"),
  );
  if (a?.[1]) return decodeEntities(a[1]);
  const b = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, "i"),
  );
  return b?.[1] ? decodeEntities(b[1]) : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

/** Pure: extract brand signals from HTML. Exported for testing. */
export function parseSiteBrand(html: string, finalUrl: string): SiteBrand {
  const u = new URL(finalUrl);
  const abs = (src?: string): string | undefined => {
    if (!src) return undefined;
    try {
      return new URL(src, finalUrl).toString();
    } catch {
      return undefined;
    }
  };

  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const image =
    metaContent(html, "og:image") ??
    metaContent(html, "og:image:url") ??
    metaContent(html, "twitter:image") ??
    metaContent(html, "twitter:image:src");

  return {
    url: finalUrl,
    host: u.hostname.replace(/^www\./, ""),
    siteName: metaContent(html, "og:site_name"),
    title: metaContent(html, "og:title") ?? (titleTag ? decodeEntities(titleTag) : undefined),
    description:
      metaContent(html, "og:description") ?? metaContent(html, "description"),
    imageUrl: abs(image),
    themeColor: metaContent(html, "theme-color"),
  };
}

/** Fetch + parse a site's brand signals. Returns null on any failure. */
export async function fetchSiteBrand(raw: string): Promise<SiteBrand | null> {
  const url = normalizeUrl(raw);
  if (!url) return null;
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (isBlockedHost(parsed.hostname)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "MediaPlanner/1.0 (+brand-fetch)" },
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    // Re-check the post-redirect host, and cap the body.
    const finalUrl = res.url || url;
    if (isBlockedHost(new URL(finalUrl).hostname)) return null;
    const html = (await res.text()).slice(0, 500_000);
    return parseSiteBrand(html, finalUrl);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
