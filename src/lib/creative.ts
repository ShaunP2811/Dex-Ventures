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

function copyFor(
  channel: Channel,
  objective: Objective,
  client: string,
  topic: string,
  isB2b: boolean,
): { headline: string; primaryText: string } {
  // Channel tone on top of an objective-driven base.
  if (channel === "TikTok") {
    return {
      headline: `${client} — ${topic}, sorted`,
      primaryText: `POV: you just found ${client}. ${topic} made easy — tap to see how.`,
    };
  }
  if (channel === "Google") {
    return {
      headline: `${client} · ${topic}`,
      primaryText: `Searching for ${topic}? ${client} delivers. ${CTA[objective][isB2b ? "b2b" : "b2c"]} today.`,
    };
  }
  if (channel === "LinkedIn") {
    return {
      headline: `Scale ${topic} with ${client}`,
      primaryText: `Trusted for ${topic}. See why teams choose ${client} — and book time with us.`,
    };
  }
  // Meta — objective-driven
  if (objective === "Awareness") {
    return {
      headline: `Meet ${client}`,
      primaryText: `Discover ${topic} with ${client}. A better way, made simple.`,
    };
  }
  if (objective === "Traffic") {
    return {
      headline: `Explore ${client}`,
      primaryText: `See what ${client} has for ${topic}. Tap through to explore.`,
    };
  }
  return {
    headline: `Join ${client} today`,
    primaryText: `Ready to start with ${topic}? ${client} makes it simple. Get going now.`,
  };
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
    const { headline, primaryText } = copyFor(
      channel,
      objective,
      client,
      topic,
      isB2b,
    );
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
