"use client";

import { useState, type FormEvent } from "react";
import {
  MARKETS,
  DEFAULT_MARKET,
  type Channel,
  type MarketCode,
  type Objective,
} from "@/lib/config";
import { activeChannelsFor } from "@/lib/engine";
import type { PlanInput } from "@/lib/types";
import { BoltIcon, SparklesIcon } from "./icons";

const OBJECTIVES: Objective[] = ["Awareness", "Traffic", "Conversion"];
const MARKET_CODES: MarketCode[] = ["MY", "SG"];
const CHANNELS: Channel[] = ["Meta", "Google", "TikTok", "LinkedIn"];
const BUDGET_PRESETS = [10_000, 25_000, 50_000, 100_000, 150_000];

const VERTICALS = [
  "Fitness / gym",
  "Food & Beverage",
  "Retail / e-commerce",
  "Beauty & skincare",
  "SaaS / software",
  "Financial services",
  "Real estate / property",
  "Education",
  "Healthcare",
  "Travel & hospitality",
  "Automotive",
];

const EXAMPLE: PlanInput = {
  client: "Aura Fitness",
  objective: "Conversion",
  totalBudget: 50_000,
  months: 2,
  isB2b: false,
  market: "MY",
  industry: "Fitness / gym",
  guidance:
    "Health-conscious adults 25-40 in Kuala Lumpur & Selangor looking to join a gym; " +
    "competitor-aware, value convenience and 24-hour access.",
};

export default function PlannerForm({
  onSubmit,
  loading,
}: {
  onSubmit: (input: PlanInput) => void;
  loading: boolean;
}) {
  const [client, setClient] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [market, setMarket] = useState<MarketCode>(DEFAULT_MARKET);
  const [budget, setBudget] = useState("");
  const [objective, setObjective] = useState<Objective>("Conversion");
  const [isB2b, setIsB2b] = useState(false);
  const [months, setMonths] = useState(2);
  const [guidance, setGuidance] = useState("");
  const [excluded, setExcluded] = useState<Channel[]>([]);

  const currency = MARKETS[market].currency;
  // channels the chosen objective + segment actually use (positive base weight)
  const available = activeChannelsFor(objective, isB2b);

  const toggleChannel = (ch: Channel, on: boolean) =>
    setExcluded((x) => (on ? [...x, ch] : x.filter((c) => c !== ch)));

  function loadExample() {
    setClient(EXAMPLE.client);
    setWebsite(EXAMPLE.website ?? "");
    setIndustry(EXAMPLE.industry ?? "");
    setMarket(EXAMPLE.market ?? "MY");
    setBudget(String(EXAMPLE.totalBudget));
    setObjective(EXAMPLE.objective);
    setIsB2b(EXAMPLE.isB2b);
    setMonths(EXAMPLE.months);
    setGuidance(EXAMPLE.guidance);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      client: client.trim(),
      objective,
      totalBudget: Number(budget),
      months,
      isB2b,
      market,
      industry: industry.trim() || undefined,
      website: website.trim() || undefined,
      guidance: guidance.trim(),
      excludedChannels: excluded,
    });
  }

  const stepMonths = (d: number) =>
    setMonths((m) => Math.min(24, Math.max(1, m + d)));

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="card-head">
        <span className="eyebrow">Campaign brief</span>
        <h2 className="card-title">Build a media plan</h2>
      </div>
      <div className="card-body">
        <div className="field">
          <label className="label" htmlFor="client">
            Client name <span className="req">*</span>
          </label>
          <input
            id="client"
            className="input"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. Aura Fitness"
            autoComplete="organization"
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="website">
            Company website
          </label>
          <input
            id="website"
            className="input"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="e.g. nike.com"
            inputMode="url"
            autoComplete="url"
          />
          <p className="hint">
            Optional. We pull the brand&rsquo;s own hero imagery to build the ad
            visuals on.
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="industry">
            Industry / vertical
          </label>
          <input
            id="industry"
            className="input"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Fitness / gym"
            list="verticals"
            autoComplete="off"
          />
          <datalist id="verticals">
            {VERTICALS.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <span className="label">Market</span>
          <div className="segmented" role="group" aria-label="Market">
            {MARKET_CODES.map((code) => (
              <button
                key={code}
                type="button"
                className="seg-btn"
                aria-pressed={market === code}
                onClick={() => setMarket(code)}
              >
                {MARKETS[code].name} ({MARKETS[code].currency})
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="budget">
            Total budget <span className="req">*</span>
          </label>
          <div className="input-money">
            <span className="prefix">{currency}</span>
            <input
              id="budget"
              className="input"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="50,000"
              required
            />
          </div>
          <input
            type="range"
            className="range"
            min={2000}
            max={200000}
            step={1000}
            value={Math.min(200000, Math.max(2000, Number(budget) || 2000))}
            onChange={(e) => setBudget(e.target.value)}
            aria-label="Total budget slider"
          />
          <div className="chips-row">
            {BUDGET_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`chip-btn${Number(budget) === p ? " active" : ""}`}
                onClick={() => setBudget(String(p))}
              >
                {currency}
                {p / 1000}k
              </button>
            ))}
          </div>
          <p className="hint">
            Treated as your <strong>total committed budget</strong> — fees are
            back-solved from it, never added on top.
          </p>
        </div>

        <div className="field">
          <span className="label">Campaign objective</span>
          <div className="segmented" role="group" aria-label="Campaign objective">
            {OBJECTIVES.map((o) => (
              <button
                key={o}
                type="button"
                className="seg-btn"
                aria-pressed={objective === o}
                onClick={() => setObjective(o)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <div className="field" style={{ marginTop: 16 }}>
            <span className="label">Audience segment</span>
            <div className="segmented" role="group" aria-label="Audience segment">
              <button
                type="button"
                className="seg-btn"
                aria-pressed={!isB2b}
                onClick={() => setIsB2b(false)}
              >
                B2C
              </button>
              <button
                type="button"
                className="seg-btn"
                aria-pressed={isB2b}
                onClick={() => setIsB2b(true)}
              >
                B2B
              </button>
            </div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label className="label" htmlFor="months">
              Duration
            </label>
            <div className="stepper">
              <button
                type="button"
                onClick={() => stepMonths(-1)}
                aria-label="Decrease months"
              >
                −
              </button>
              <input
                id="months"
                value={months}
                onChange={(e) => {
                  const v = parseInt(e.target.value.replace(/\D/g, ""), 10);
                  setMonths(Number.isFinite(v) ? Math.min(24, Math.max(1, v)) : 1);
                }}
                inputMode="numeric"
                aria-label="Duration in months"
              />
              <button
                type="button"
                onClick={() => stepMonths(1)}
                aria-label="Increase months"
              >
                +
              </button>
            </div>
            <p className="hint">months</p>
          </div>
        </div>

        <div className="field">
          <span className="label">Channels</span>
          <div className="chips-row" role="group" aria-label="Channels">
            {CHANNELS.map((ch) => {
              const isAvailable = available.includes(ch);
              const on = isAvailable && !excluded.includes(ch);
              return (
                <button
                  key={ch}
                  type="button"
                  className={`chip-toggle${on ? " on" : ""}${
                    isAvailable ? "" : " na"
                  }`}
                  aria-pressed={on}
                  disabled={!isAvailable}
                  title={
                    isAvailable
                      ? undefined
                      : `${ch} isn't used for ${isB2b ? "B2B" : "B2C"} ${objective}`
                  }
                  onClick={() => toggleChannel(ch, on)}
                >
                  {ch}
                </button>
              );
            })}
          </div>
          <p className="hint">
            Only channels used for this objective &amp; segment are available
            (e.g. LinkedIn is B2B-only, TikTok drops out of B2B Conversion).
            Toggle one off to exclude it — its budget redistributes to the rest.
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="guidance">
            Audience guidance
          </label>
          <textarea
            id="guidance"
            className="textarea"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Describe the target audience in plain English — who they are, where, what they care about. This drives the platform targeting."
          />
          <p className="hint">
            Free text. Shapes targeting only — it never touches the budget math.
          </p>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            <SparklesIcon size={16} />
            {loading ? "Generating…" : "Generate media plan"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={loadExample}
            disabled={loading}
          >
            <BoltIcon size={15} />
            Load example (Aura Fitness)
          </button>
        </div>
      </div>
    </form>
  );
}
