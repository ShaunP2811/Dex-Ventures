"use client";

import { useEffect, useState, type FormEvent } from "react";
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
const STEPS = ["Brief", "Channels", "Audience", "Review"] as const;

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
  hasPlan = false,
}: {
  onSubmit: (input: PlanInput) => void;
  loading: boolean;
  hasPlan?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [client, setClient] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [market, setMarket] = useState<MarketCode>(DEFAULT_MARKET);
  const [budget, setBudget] = useState("");
  const [objective, setObjective] = useState<Objective>("Conversion");
  const [isB2b, setIsB2b] = useState(false);
  const [months, setMonths] = useState(2);
  const [guidance, setGuidance] = useState("");
  const [channels, setChannels] = useState<Channel[]>(() =>
    activeChannelsFor("Conversion", false),
  );

  const currency = MARKETS[market].currency;
  const budgetNum = Number(budget);
  const briefValid =
    client.trim().length > 0 && Number.isFinite(budgetNum) && budgetNum > 0;

  useEffect(() => {
    setChannels(activeChannelsFor(objective, isB2b));
  }, [objective, isB2b]);

  const toggleChannel = (ch: Channel, on: boolean) =>
    setChannels((x) => (on ? x.filter((c) => c !== ch) : [...x, ch]));

  const stepMonths = (d: number) =>
    setMonths((m) => Math.min(24, Math.max(1, m + d)));

  function loadExample() {
    setClient(EXAMPLE.client);
    setWebsite("");
    setIndustry(EXAMPLE.industry ?? "");
    setMarket(EXAMPLE.market ?? "MY");
    setBudget(String(EXAMPLE.totalBudget));
    setObjective(EXAMPLE.objective);
    setIsB2b(EXAMPLE.isB2b);
    setMonths(EXAMPLE.months);
    setGuidance(EXAMPLE.guidance);
    setChannels(activeChannelsFor(EXAMPLE.objective, EXAMPLE.isB2b));
    setStep(STEPS.length - 1);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step !== STEPS.length - 1 || !briefValid) return;
    onSubmit({
      client: client.trim(),
      objective,
      totalBudget: budgetNum,
      months,
      isB2b,
      market,
      industry: industry.trim() || undefined,
      website: website.trim() || undefined,
      guidance: guidance.trim(),
      channels,
    });
  }

  const last = STEPS.length - 1;

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="card-head">
        <span className="eyebrow">Campaign brief</span>
        <h2 className="card-title">
          {hasPlan ? "Refine the plan" : "Build a media plan"}
        </h2>
      </div>
      <div className="card-body">
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`step${i === step ? " active" : ""}${
                i < step ? " done" : ""
              }`}
            >
              <button type="button" onClick={() => setStep(i)}>
                <span className="step-n">{i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>

        {/* STEP 1 — BRIEF */}
        {step === 0 && (
          <>
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
                Optional. We pull the brand&rsquo;s own imagery for the ad
                visuals.
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
                {[
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
                ].map((v) => (
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
                  onChange={(e) =>
                    setBudget(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  inputMode="decimal"
                  placeholder="50,000"
                />
              </div>
              <input
                type="range"
                className="range"
                min={2000}
                max={200000}
                step={1000}
                value={Math.min(200000, Math.max(2000, budgetNum || 2000))}
                onChange={(e) => setBudget(e.target.value)}
                aria-label="Total budget slider"
              />
              <div className="chips-row">
                {BUDGET_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`chip-btn${budgetNum === p ? " active" : ""}`}
                    onClick={() => setBudget(String(p))}
                  >
                    {currency}
                    {p / 1000}k
                  </button>
                ))}
              </div>
              <p className="hint">
                Your <strong>total committed budget</strong> — fees are
                back-solved from it, never added on top.
              </p>
            </div>

            <div className="field">
              <span className="label">Campaign objective</span>
              <div
                className="segmented"
                role="group"
                aria-label="Campaign objective"
              >
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
                <div
                  className="segmented"
                  role="group"
                  aria-label="Audience segment"
                >
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
                      setMonths(
                        Number.isFinite(v) ? Math.min(24, Math.max(1, v)) : 1,
                      );
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
          </>
        )}

        {/* STEP 2 — CHANNELS */}
        {step === 1 && (
          <div className="field" style={{ marginTop: 0 }}>
            <span className="label">Channels</span>
            <div className="chips-row" role="group" aria-label="Channels">
              {CHANNELS.map((ch) => {
                const on = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    className={`chip-toggle${on ? " on" : ""}`}
                    aria-pressed={on}
                    onClick={() => toggleChannel(ch, on)}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
            <p className="hint">
              Defaults come from the objective &amp; segment — add or remove any
              channel. One you add (e.g. LinkedIn on a B2C plan) gets a balanced
              share; removing one redistributes its budget to the rest.
            </p>
          </div>
        )}

        {/* STEP 3 — AUDIENCE */}
        {step === 2 && (
          <div className="field" style={{ marginTop: 0 }}>
            <label className="label" htmlFor="guidance">
              Audience guidance
            </label>
            <textarea
              id="guidance"
              className="textarea"
              style={{ minHeight: 140 }}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="Describe the target audience in plain English — who they are, where, what they care about. This drives the platform targeting and ad copy."
            />
            <p className="hint">
              Free text. Shapes targeting &amp; copy only — it never touches the
              budget math.
            </p>
          </div>
        )}

        {/* STEP 4 — REVIEW */}
        {step === 3 && (
          <div className="review-list">
            <div>
              <span>Client</span>
              <b>{client.trim() || "—"}</b>
            </div>
            <div>
              <span>Website</span>
              <b>{website.trim() || "—"}</b>
            </div>
            <div>
              <span>Industry</span>
              <b>{industry.trim() || "—"}</b>
            </div>
            <div>
              <span>Market</span>
              <b>{MARKETS[market].name}</b>
            </div>
            <div>
              <span>Budget</span>
              <b>
                {currency} {budget || "—"} · {months} mo
              </b>
            </div>
            <div>
              <span>Objective</span>
              <b>
                {objective} · {isB2b ? "B2B" : "B2C"}
              </b>
            </div>
            <div>
              <span>Channels</span>
              <b>{channels.join(", ") || "—"}</b>
            </div>
            <div>
              <span>Audience</span>
              <b>{guidance.trim() || "—"}</b>
            </div>
            {!briefValid && (
              <p className="hint" style={{ color: "var(--danger)" }}>
                Add a client name and a budget (step 1) to generate.
              </p>
            )}
          </div>
        )}

        <div className="wizard-nav">
          {step > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step < last ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !briefValid}
            >
              Next
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !briefValid}
            >
              <SparklesIcon size={16} />
              {loading
                ? "Generating…"
                : hasPlan
                  ? "Refine plan"
                  : "Generate media plan"}
            </button>
          )}
        </div>

        {step === 0 && (
          <button
            className="btn btn-ghost"
            type="button"
            style={{ width: "100%", marginTop: 10 }}
            onClick={loadExample}
            disabled={loading}
          >
            <BoltIcon size={15} />
            Load example (Aura Fitness)
          </button>
        )}
      </div>
    </form>
  );
}
