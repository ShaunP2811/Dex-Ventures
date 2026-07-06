/**
 * proposal.ts — Assembles the deterministic plan + (mock) targeting into a
 * single client-ready proposal object. Split rationale comes from config
 * (deterministic); only the targeting specifics come from the LLM layer.
 *
 * NO NUMBER passes through the targeting layer — fees and allocation are computed
 * here by the pure engine, and only channel NAMES + guidance reach targeting.
 */

import {
  MARKETS,
  DEFAULT_MARKET,
  REASON_MAP,
  type Channel,
  type Objective,
} from "./config";
import { buildPlan, feeRows, projectDelivery } from "./engine";
import { generateTargetingSmart } from "./targeting";
import { generateCreatives } from "./creative";
import { fetchSiteBrand } from "./site";
import { buildImagePrompt, generateAdBackground } from "./image";
import type {
  AllocationRow,
  DeliveryRow,
  PlanInput,
  Proposal,
  SiteBrand,
} from "./types";

function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON) * f) / f;
}

const OBJECTIVE_CLAUSE: Record<Objective, string> = {
  Awareness: "prioritises broad, cost-efficient reach to build awareness",
  Traffic: "balances search intent with discovery to drive quality visits",
  Conversion:
    "concentrates on intent capture and direct response to maximise conversions",
};

function buildAllocationSummary(
  objective: Objective,
  isB2b: boolean,
  allocation: AllocationRow[],
  dropped: string[],
): string {
  const seg = isB2b ? "B2B" : "B2C";
  if (allocation.length === 0) {
    return "No channels are active for this configuration — include at least one channel.";
  }
  const lead = allocation[0];
  const rest = allocation.slice(1);
  const channelClause =
    `${lead.channel} leads at ${lead.pct}%` +
    (rest.length
      ? `, followed by ${rest.map((a) => `${a.channel} (${a.pct}%)`).join(", ")}`
      : "");
  const dropClause = dropped.length
    ? ` ${dropped.join(" and ")} ${dropped.length > 1 ? "were" : "was"} excluded below the learning-phase floor, with ${dropped.length > 1 ? "their" : "its"} budget redistributed to the survivors.`
    : "";
  return `For a ${objective} objective in ${seg}, the split ${OBJECTIVE_CLAUSE[objective]}. ${channelClause}.${dropClause}`;
}

export async function assembleProposal(input: PlanInput): Promise<Proposal> {
  const { client, objective, totalBudget, months, isB2b, guidance, industry } =
    input;
  const refinement = input.refinement?.trim() || undefined;
  const market = MARKETS[input.market ?? DEFAULT_MARKET];

  const plan = buildPlan(
    client,
    objective,
    totalBudget,
    months,
    isB2b,
    market,
    input.channels,
  );

  const activeChannels = Object.keys(plan.allocation.perChannel) as Channel[];
  const { source, targeting } = await generateTargetingSmart(
    activeChannels,
    guidance,
    objective,
    isB2b,
    industry,
    market.code,
    refinement,
  );

  const reasons = REASON_MAP[objective];
  const allocation: AllocationRow[] = Object.entries(plan.allocation.perChannel)
    .sort((a, b) => b[1] - a[1])
    .map(([channel, amount]) => ({
      channel: channel as Channel,
      pct: round(plan.allocation.percentages[channel] * 100, 1),
      amount: round(amount, 2),
      rationale: reasons[channel as Channel] ?? "",
    }));

  const projections = projectDelivery(plan.allocation.perChannel);
  const delivery: DeliveryRow[] = allocation.map((r) => ({
    channel: r.channel,
    impressions: projections[r.channel]?.impressions ?? 0,
    clicks: projections[r.channel]?.clicks ?? 0,
    conversions: projections[r.channel]?.conversions ?? 0,
  }));

  const creatives = generateCreatives(activeChannels, {
    client,
    objective,
    isB2b,
    industry,
    guidance,
  });

  // Pull the client's own brand imagery from their site (if provided), so the
  // ad mockups are built on their real hero image. If an image model is
  // configured, synthesise a background from the site + brief instead.
  let site: SiteBrand | undefined;
  if (input.website?.trim()) {
    site = (await fetchSiteBrand(input.website)) ?? undefined;
    if (site && process.env.IMAGE_API_KEY) {
      const prompt = buildImagePrompt({
        client,
        objective,
        isB2b,
        industry,
        siteDescription: site.description,
      });
      const generated = await generateAdBackground(prompt);
      if (generated) site = { ...site, imageUrl: generated };
    }
  }

  return {
    client,
    objective,
    segment: isB2b ? "B2B" : "B2C",
    months,
    totalBudget,
    currency: market.currency,
    marketName: market.name,
    taxRate: market.taxRate,
    taxLabel: market.taxLabel,
    industry: input.industry?.trim() || undefined,
    fees: feeRows(plan.fees),
    allocation,
    allocationSummary: buildAllocationSummary(
      objective,
      isB2b,
      allocation,
      plan.allocation.dropped,
    ),
    delivery,
    creatives,
    site,
    floorNotes: plan.allocation.notes,
    targetingSource: source,
    targeting,
    refinement,
  };
}
