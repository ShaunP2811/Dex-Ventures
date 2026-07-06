/**
 * creative.ts — the ad-creative layer. Writes platform-native ad COPY
 * (headline / primary text / CTA) per surviving channel, built to each
 * platform's format + character limits from config.
 *
 * Like targeting, this is the LLM's remit — LANGUAGE, never numbers. Today it's
 * a deterministic, objective- and industry-aware generator (always demoable);
 * the same live-LLM seam used for targeting can write these in production. The
 * visual mockup is composed deterministically from this copy in the UI.
 */

import { AD_FORMATS, type Channel, type Objective } from "./config";
import type { AdCreative } from "./types";

export interface CreativeBrief {
  client: string;
  objective: Objective;
  isB2b: boolean;
  industry?: string;
  guidance?: string;
}

const STOP = new Set([
  "the", "and", "for", "who", "are", "with", "looking", "want", "adults",
  "people", "aged", "years", "old", "near", "your", "our", "that", "this",
  "want", "value", "conscious", "competitor",
]);

/** A short, lowercase topic phrase from industry (preferred) or guidance. */
function topicFrom(industry?: string, guidance?: string): string {
  const ind = (industry ?? "").split(/[/&,]/)[0].trim();
  if (ind) return ind.toLowerCase();
  const g = (guidance ?? "").toLowerCase();
  const tok = g.split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w));
  return tok[0] ?? "your goals";
}

const CTA: Record<Objective, { b2c: string; b2b: string }> = {
  Awareness: { b2c: "Learn More", b2b: "Learn More" },
  Traffic: { b2c: "Shop Now", b2b: "Visit Site" },
  Conversion: { b2c: "Sign Up", b2b: "Book a Demo" },
};

function clamp(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

interface Copy {
  headline: string;
  primaryText: string;
}

// Each platform has its own voice, tuned again by objective. See the
// ad-caption-writing skill for the full per-platform strategy.
//  Meta     — warm, benefit-led, social
//  Google   — search-intent, direct, answers the query
//  TikTok   — native, casual, hook-first
//  LinkedIn — professional, credibility + outcomes (B2B)
function copyFor(
  channel: Channel,
  objective: Objective,
  client: string,
  topic: string,
): Copy {
  const t = topic;
  const byPlatform: Record<Channel, Record<Objective, Copy>> = {
    Meta: {
      Awareness: {
        headline: `Say hello to ${client}`,
        primaryText: `Discover ${t} with ${client} — made simple, made for you.`,
      },
      Traffic: {
        headline: `There's more at ${client}`,
        primaryText: `Take a look at what ${client} does for ${t}. Tap to explore.`,
      },
      Conversion: {
        headline: `Join ${client} today`,
        primaryText: `Thousands trust ${client} for ${t}. Your turn — get started in minutes.`,
      },
    },
    Google: {
      Awareness: {
        headline: `${client} — ${t}`,
        primaryText: `Looking into ${t}? Meet ${client} and see what makes it different.`,
      },
      Traffic: {
        headline: `${client} for ${t}`,
        primaryText: `Comparing ${t} options? ${client} delivers — explore the range today.`,
      },
      Conversion: {
        headline: `${client}: ${t}, sorted`,
        primaryText: `Ready for ${t}? Get started with ${client} — fast, simple, reliable.`,
      },
    },
    TikTok: {
      Awareness: {
        headline: `${client}, where've you been?`,
        primaryText: `POV: ${t} just got way easier. consider this your sign to try ${client}.`,
      },
      Traffic: {
        headline: `wait, ${client} does ${t}?`,
        primaryText: `not me finding ${client} for ${t}… tap through, you'll get it.`,
      },
      Conversion: {
        headline: `${client} — ${t}, sorted`,
        primaryText: `why is no one talking about ${client}? get on ${t} today.`,
      },
    },
    LinkedIn: {
      Awareness: {
        headline: `Meet ${client}`,
        primaryText: `${client} helps teams get ${t} right. See how leaders are rethinking it.`,
      },
      Traffic: {
        headline: `${client}: ${t} that scales`,
        primaryText: `See why teams choose ${client} for ${t}. Explore the approach.`,
      },
      Conversion: {
        headline: `Scale ${t} with ${client}`,
        primaryText: `Trusted for ${t}. Book time with ${client} and see the results yourself.`,
      },
    },
  };
  return byPlatform[channel][objective];
}

export function generateCreatives(
  activeChannels: Channel[],
  brief: CreativeBrief,
): AdCreative[] {
  const { client, objective, isB2b, industry, guidance } = brief;
  const topic = topicFrom(industry, guidance);
  const cta = isB2b ? CTA[objective].b2b : CTA[objective].b2c;

  return activeChannels.map((channel) => {
    const f = AD_FORMATS[channel];
    const { headline, primaryText } = copyFor(channel, objective, client, topic);
    return {
      channel,
      headline: clamp(headline, f.headlineMax),
      primaryText: clamp(primaryText, f.primaryMax),
      cta,
      ratio: f.ratio,
      placement: f.placement,
      width: f.w,
      height: f.h,
    };
  });
}
