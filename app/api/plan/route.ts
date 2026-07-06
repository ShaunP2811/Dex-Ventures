/**
 * POST /api/plan — runs the deterministic engine + (mock) targeting server-side
 * and returns an assembled, client-ready proposal.
 *
 * Server-side only: this is where the Anthropic key WILL live (never the
 * browser). Today the targeting layer is mocked from sample data.
 */

import { NextResponse } from "next/server";
import {
  MARKETS,
  DEFAULT_MARKET,
  MIN_SPEND_PER_MONTH,
  type Channel,
  type MarketCode,
  type Objective,
} from "@/lib/config";
import { minViableBudget } from "@/lib/engine";
import { assembleProposal } from "@/lib/proposal";
import type { PlanInput } from "@/lib/types";

const OBJECTIVES: Objective[] = ["Awareness", "Traffic", "Conversion"];
const ALL_CHANNELS: Channel[] = ["Meta", "Google", "TikTok", "LinkedIn"];

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Request body must be valid JSON.");
  }

  const b = body as Record<string, unknown>;

  const client = typeof b.client === "string" ? b.client.trim() : "";
  const objective = b.objective as Objective;
  const totalBudget = Number(b.totalBudget);
  const months = Number(b.months);
  const isB2b = Boolean(b.isB2b);
  const guidance = typeof b.guidance === "string" ? b.guidance : "";
  const marketCode: MarketCode = b.market === "SG" ? "SG" : DEFAULT_MARKET;
  const market = MARKETS[marketCode];
  const industry = typeof b.industry === "string" ? b.industry : undefined;
  const website = typeof b.website === "string" ? b.website : undefined;
  const channels = Array.isArray(b.channels)
    ? b.channels.filter((c): c is Channel => ALL_CHANNELS.includes(c as Channel))
    : undefined;
  const refinement = typeof b.refinement === "string" ? b.refinement : undefined;

  if (!client) return bad("Client name is required.");
  if (!OBJECTIVES.includes(objective))
    return bad("Objective must be Awareness, Traffic, or Conversion.");
  if (!Number.isFinite(totalBudget) || totalBudget <= 0)
    return bad("Total budget must be a positive number.");
  if (!Number.isInteger(months) || months < 1 || months > 24)
    return bad("Duration must be a whole number of months between 1 and 24.");

  if (channels !== undefined && channels.length === 0)
    return bad("Include at least one channel.");

  const minViable = minViableBudget(months, market.taxRate);
  if (totalBudget < minViable) {
    const cur = market.currency;
    return bad(
      `Budget is below the minimum viable spend for ${months} month(s). ` +
        `After fixed fees, no channel could clear the ${cur}${(
          MIN_SPEND_PER_MONTH * months
        ).toLocaleString("en-US")} learning-phase floor. ` +
        `Minimum for this duration is ~${cur}${Math.ceil(
          minViable,
        ).toLocaleString("en-US")}.`,
      422,
    );
  }

  const input: PlanInput = {
    client,
    objective,
    totalBudget,
    months,
    isB2b,
    guidance,
    market: marketCode,
    industry,
    website,
    channels,
    refinement,
  };

  try {
    const proposal = await assembleProposal(input);
    return NextResponse.json(proposal);
  } catch (err) {
    return bad(
      `Failed to build plan: ${err instanceof Error ? err.message : "unknown error"}`,
      500,
    );
  }
}
