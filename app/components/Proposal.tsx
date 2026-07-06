"use client";

import { useState, type CSSProperties } from "react";
import {
  MGMT_FEE_PCT,
  REPORTING_FEE_PER_MONTH,
  SETUP_FEE,
  type Channel,
} from "@/lib/config";
import type {
  AdCreative,
  Keyword,
  PlatformTargeting,
  Proposal as ProposalT,
} from "@/lib/types";
import {
  formatMoney,
  formatPct,
  titleizeField,
  valueToString,
} from "@/lib/format";
import {
  ChatIcon,
  CheckCircleIcon,
  CopyIcon,
  DownloadIcon,
  HeartIcon,
  InfoIcon,
  PrinterIcon,
  PrismMark,
  ShareIcon,
  ShieldIcon,
} from "./icons";

const CHANNEL_VAR: Record<Channel, string> = {
  Meta: "var(--ch-meta)",
  Google: "var(--ch-google)",
  TikTok: "var(--ch-tiktok)",
  LinkedIn: "var(--ch-linkedin)",
};

const fmt2 = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtInt = (n: number) => n.toLocaleString("en-US");

function isKeywordArray(v: unknown): v is Keyword[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    typeof v[0] === "object" &&
    v[0] !== null &&
    "term" in (v[0] as object)
  );
}

function platformToText(channel: string, t: PlatformTargeting): string {
  const lines = [channel];
  for (const [key, val] of Object.entries(t)) {
    lines.push(`${titleizeField(key)}: ${valueToString(val)}`);
  }
  return lines.join("\n");
}

function creativeToText(c: AdCreative): string {
  return [
    `${c.channel} — ${c.placement} · ${c.ratio} (${c.width}×${c.height})`,
    `Headline: ${c.headline}`,
    `Primary: ${c.primaryText}`,
    `CTA: ${c.cta}`,
  ].join("\n");
}

/** A realistic platform ad unit: feed card (portrait/square) or display banner
 *  (landscape), composed over the brand image when present, else a branded fill. */
function AdMock({
  c,
  client,
  imageUrl,
}: {
  c: AdCreative;
  client: string;
  imageUrl?: string;
}) {
  const initial = client.trim().charAt(0).toUpperCase() || "•";
  const style = {
    aspectRatio: `${c.width} / ${c.height}`,
    "--ch": CHANNEL_VAR[c.channel],
  } as CSSProperties;
  const img = imageUrl ? (
    <img
      className="au-img"
      src={imageUrl}
      alt=""
      referrerPolicy="no-referrer"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  ) : null;

  if (c.width >= c.height) {
    // display banner (Google, LinkedIn)
    return (
      <div className="ad-unit banner" style={style}>
        {img}
        <div className="au-scrim" />
        <span className="au-badge">Sponsored</span>
        <div className="au-banner-content">
          <span className="au-brand-sm">{client}</span>
          <p className="au-headline">{c.headline}</p>
          <span className="au-cta">{c.cta}</span>
        </div>
      </div>
    );
  }

  // feed card (Meta, TikTok)
  return (
    <div className="ad-unit feed" style={style}>
      <div className="au-head">
        <span className="au-avatar" style={{ background: CHANNEL_VAR[c.channel] }}>
          {initial}
        </span>
        <div className="au-id">
          <span className="au-brand">{client}</span>
          <span className="au-sponsored">Sponsored · {c.placement}</span>
        </div>
        <span className="au-dots">
          <span />
          <span />
          <span />
        </span>
      </div>
      <div className="au-media">
        {img}
        {!imageUrl && (
          <span className="au-wm">
            <PrismMark size={72} />
          </span>
        )}
        <div className="au-media-scrim" />
        <p className="au-headline">{c.headline}</p>
      </div>
      <div className="au-foot">
        <p className="au-primary">{c.primaryText}</p>
        <div className="au-actions">
          <span className="au-icons">
            <HeartIcon size={15} />
            <ChatIcon size={15} />
            <ShareIcon size={15} />
          </span>
          <span className="au-cta">{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button
      type="button"
      className={`copy-btn${copied ? " copied" : ""}`}
      onClick={copy}
    >
      {copied ? <CheckCircleIcon size={13} /> : <CopyIcon size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** Builds a client-ready Markdown copy of the proposal — the tool producing its
 *  own "Sample Generated Output" deliverable. */
function buildMarkdown(p: ProposalT): string {
  const money = (n: number) => formatMoney(n, p.currency);
  const L: string[] = [];
  L.push(`# Media Plan Proposal — ${p.client}`);
  const sub = [p.objective, p.segment, `${p.months} month(s)`, p.marketName];
  if (p.industry) sub.splice(1, 0, p.industry);
  L.push(`_${sub.join(" · ")}_`, "");
  L.push("## Investment summary", "");
  L.push("| Line | Amount |", "| --- | ---: |");
  for (const f of p.fees) {
    L.push(`| ${f.label} | ${money(f.amount)} |`);
  }
  L.push("", "## Channel allocation", "");
  L.push("| Channel | Share | Amount | Rationale |", "| --- | ---: | ---: | --- |");
  for (const a of p.allocation) {
    L.push(`| ${a.channel} | ${formatPct(a.pct)} | ${money(a.amount)} | ${a.rationale} |`);
  }
  L.push("", "## Projected delivery (illustrative)", "");
  L.push("| Channel | Impressions | Clicks | Conversions |", "| --- | ---: | ---: | ---: |");
  for (const d of p.delivery) {
    L.push(
      `| ${d.channel} | ${d.impressions.toLocaleString("en-US")} | ${d.clicks.toLocaleString("en-US")} | ${d.conversions.toLocaleString("en-US")} |`,
    );
  }
  L.push("", "## Ad creative", "");
  for (const c of p.creatives) {
    L.push(`**${c.channel}** — ${c.placement} · ${c.ratio} (${c.width}×${c.height})`);
    L.push(`- Headline: ${c.headline}`);
    L.push(`- Primary: ${c.primaryText}`);
    L.push(`- CTA: ${c.cta}`, "");
  }
  if (p.floorNotes.length) {
    L.push("## Optimisation notes", "");
    for (const n of p.floorNotes) L.push(`- ${n}`);
  }
  L.push("", `## Audience targeting  _(source: ${p.targetingSource})_`, "");
  for (const [ch, t] of Object.entries(p.targeting)) {
    L.push("```", platformToText(ch, t as PlatformTargeting), "```", "");
  }
  return L.join("\n");
}

function TargetingValueView({ value }: { value: unknown }) {
  if (isKeywordArray(value)) {
    return (
      <div className="chips">
        {value.map((k, i) => (
          <span className="chip" key={i}>
            {k.term}
            <span className="kw-match">{k.match}</span>
          </span>
        ))}
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div className="chips">
        {value.map((v, i) => (
          <span className="chip" key={i}>
            {v !== null && typeof v === "object" ? valueToString(v) : String(v)}
          </span>
        ))}
      </div>
    );
  }
  if (value !== null && typeof value === "object") {
    return (
      <div className="chips">
        {Object.entries(value as Record<string, unknown>).map(([k, v], i) => (
          <span className="chip" key={i}>
            {titleizeField(k)}: {valueToString(v)}
          </span>
        ))}
      </div>
    );
  }
  return <span className="kv-val">{String(value)}</span>;
}

export default function Proposal({ proposal }: { proposal: ProposalT }) {
  const {
    client,
    objective,
    segment,
    months,
    totalBudget,
    currency,
    marketName,
    taxRate,
    taxLabel,
    industry,
    fees,
    allocation,
    allocationSummary,
    delivery,
    creatives,
    site,
    floorNotes,
    targeting,
    targetingSource,
  } = proposal;

  const money = (n: number) => formatMoney(n, currency);

  function downloadMarkdown() {
    const blob = new Blob([buildMarkdown(proposal)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${client.replace(/\s+/g, "-").toLowerCase()}-media-plan.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allTargetingText = (
    Object.entries(targeting) as [string, PlatformTargeting][]
  )
    .map(([ch, t]) => platformToText(ch, t))
    .join("\n\n");

  // running section counter so numbering stays correct as sections appear/hide
  let sec = 0;
  const N = () => String(++sec).padStart(2, "0");

  const feeAmt = (key: string) => fees.find((f) => f.key === key)?.amount ?? 0;
  const lineItems = fees
    .filter((f) => f.key !== "total")
    .reduce((a, f) => a + f.amount, 0);

  // show-the-math values (all from config + computed fees — never the LLM)
  const setup = SETUP_FEE;
  const reporting = REPORTING_FEE_PER_MONTH * months;
  const fixed = setup + reporting;
  const media = feeAmt("media");
  const mgmt = feeAmt("mgmt");
  const tax = feeAmt("tax");
  const taxMul = 1 + taxRate;
  const denom = 1 + MGMT_FEE_PCT * taxMul;

  // grouped fee breakdown
  const totalFee = feeAmt("total");
  const servicesSubtotal = mgmt + setup + reporting;
  const pctOf = (x: number) =>
    totalFee ? `${((x / totalFee) * 100).toFixed(1)}%` : "";
  const labelOf = (k: string) => fees.find((f) => f.key === k)?.label ?? "";

  const totalDelivery = delivery.reduce(
    (a, d) => ({
      impressions: a.impressions + d.impressions,
      clicks: a.clicks + d.clicks,
      conversions: a.conversions + d.conversions,
    }),
    { impressions: 0, clicks: 0, conversions: 0 },
  );

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const sourceLabel = targetingSource.startsWith("llm:")
    ? `Live · ${targetingSource.slice(4)}`
    : targetingSource.startsWith("mock_sample")
      ? "Mock · sample data"
      : targetingSource;

  return (
    <div className="proposal">
      {/* Header */}
      <header className="doc-header">
        <div>
          <h1>{client}</h1>
          <div className="doc-sub">
            <span>{objective}</span>
            {industry && (
              <>
                <span className="dot">•</span>
                <span>{industry}</span>
              </>
            )}
            <span className="dot">•</span>
            <span>{segment}</span>
            <span className="dot">•</span>
            <span>
              {months} month{months > 1 ? "s" : ""}
            </span>
            <span className="dot">•</span>
            <span>{marketName}</span>
          </div>
        </div>
        <div className="doc-meta">
          <div className="big">Media Plan Proposal</div>
          <div>{today}</div>
          {site?.url && (
            <div>
              <a
                className="doc-link"
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {site.host}
              </a>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <span className="tag">
              <ShieldIcon size={13} /> Deterministic pricing
            </span>
          </div>
        </div>
      </header>

      {/* Investment summary */}
      <section className="card">
        <div className="card-head">
          <span className="eyebrow">{N()} — Investment summary</span>
          <h2 className="card-title">Where the budget goes</h2>
        </div>
        <div className="card-body">
          <table className="fee-table grouped">
            <tbody>
              <tr className="fee-group">
                <td>Working media</td>
                <td className="fee-pct">of total</td>
                <td />
              </tr>
              <tr>
                <td className="fee-label">Media spend</td>
                <td className="fee-pct">{pctOf(media)}</td>
                <td className="fee-amount">{money(media)}</td>
              </tr>

              <tr className="fee-group">
                <td>Agency services</td>
                <td />
                <td />
              </tr>
              <tr>
                <td className="fee-label">{labelOf("mgmt")}</td>
                <td className="fee-pct">{pctOf(mgmt)}</td>
                <td className="fee-amount">{money(mgmt)}</td>
              </tr>
              <tr>
                <td className="fee-label">Setup fee</td>
                <td className="fee-pct">{pctOf(setup)}</td>
                <td className="fee-amount">{money(setup)}</td>
              </tr>
              <tr>
                <td className="fee-label">Reporting fee</td>
                <td className="fee-pct">{pctOf(reporting)}</td>
                <td className="fee-amount">{money(reporting)}</td>
              </tr>
              <tr className="fee-subtotal">
                <td>Services subtotal</td>
                <td className="fee-pct">{pctOf(servicesSubtotal)}</td>
                <td className="fee-amount">{money(servicesSubtotal)}</td>
              </tr>

              <tr className="fee-group">
                <td>Tax</td>
                <td />
                <td />
              </tr>
              <tr>
                <td className="fee-label">{labelOf("tax")}</td>
                <td className="fee-pct">{pctOf(tax)}</td>
                <td className="fee-amount">{money(tax)}</td>
              </tr>

              <tr className="total">
                <td className="fee-label">Total investment</td>
                <td className="fee-pct">100%</td>
                <td className="fee-amount">{money(totalFee)}</td>
              </tr>
            </tbody>
          </table>
          <div className="reconcile">
            <CheckCircleIcon size={15} />
            Line items reconcile exactly to the {money(totalBudget)} committed
            budget — every figure computed, none estimated.
          </div>
          {Math.abs(lineItems - totalBudget) > 0.005 && (
            <p className="hint" style={{ color: "var(--danger)" }}>
              Note: line items sum to {money(lineItems)}.
            </p>
          )}

          <details className="math no-print">
            <summary>Show the back-solve</summary>
            <div className="math-body num">
              <div>
                fixed = {fmt2(setup)} + {fmt2(REPORTING_FEE_PER_MONTH)} × {months}{" "}
                = {fmt2(fixed)}
              </div>
              <div>
                media = ({fmt2(totalBudget)} − {fmt2(fixed)} × {taxMul.toFixed(2)})
                ÷ {denom.toFixed(3)} = {fmt2(media)}
              </div>
              <div>
                management = {Math.round(MGMT_FEE_PCT * 100)}% × {fmt2(media)} ={" "}
                {fmt2(mgmt)}
              </div>
              <div>
                {taxLabel} = {Math.round(taxRate * 100)}% × ({fmt2(fixed)} +{" "}
                {fmt2(mgmt)}) = {fmt2(tax)}
              </div>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              The budget is the client&rsquo;s total commitment; media spend is
              back-solved so fees are never bolted on top. SST applies to service
              fees only, never to media.
            </p>
          </details>
        </div>
      </section>

      {/* Allocation */}
      <section className="card">
        <div className="card-head">
          <span className="eyebrow">{N()} — Channel allocation</span>
          <h2 className="card-title">How media spend is split</h2>
        </div>
        <div className="card-body">
          <p className="section-summary">{allocationSummary}</p>
          <div className="stacked-bar" aria-hidden="true">
            {allocation.map((r) => (
              <div
                key={r.channel}
                className="stacked-seg"
                style={{
                  width: `${r.pct}%`,
                  background: CHANNEL_VAR[r.channel],
                }}
                title={`${r.channel} ${formatPct(r.pct)}`}
              />
            ))}
          </div>

          {allocation.map((r) => (
            <div className="alloc-row" key={r.channel}>
              <div className="alloc-head">
                <span
                  className="ch-dot"
                  style={{ background: CHANNEL_VAR[r.channel] }}
                />
                {r.channel}
              </div>
              <div className="alloc-figures">
                <span className="alloc-pct">{formatPct(r.pct)}</span>
                <div className="alloc-amt">{money(r.amount)}</div>
              </div>
              <div className="alloc-bar">
                <span
                  style={{
                    width: `${r.pct}%`,
                    background: CHANNEL_VAR[r.channel],
                  }}
                />
              </div>
              <p className="alloc-rationale">{r.rationale}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Projected delivery (illustrative) */}
      <section className="card">
        <div className="card-head">
          <span className="eyebrow">{N()} — Projected delivery</span>
          <h2 className="card-title">Illustrative reach for this split</h2>
        </div>
        <div className="card-body">
          <div className="delivery-scroll">
            <table className="delivery-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="r">Impressions</th>
                  <th className="r">Clicks</th>
                  <th className="r">Conversions</th>
                </tr>
              </thead>
              <tbody>
                {delivery.map((d) => (
                  <tr key={d.channel}>
                    <td>
                      <span className="alloc-head" style={{ fontWeight: 550 }}>
                        <span
                          className="ch-dot"
                          style={{ background: CHANNEL_VAR[d.channel] }}
                        />
                        {d.channel}
                      </span>
                    </td>
                    <td className="r num">{fmtInt(d.impressions)}</td>
                    <td className="r num">{fmtInt(d.clicks)}</td>
                    <td className="r num">{fmtInt(d.conversions)}</td>
                  </tr>
                ))}
                <tr className="delivery-total">
                  <td>Total</td>
                  <td className="r num">{fmtInt(totalDelivery.impressions)}</td>
                  <td className="r num">{fmtInt(totalDelivery.clicks)}</td>
                  <td className="r num">{fmtInt(totalDelivery.conversions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            Illustrative planning estimates, computed deterministically from
            blended benchmark rates (CPM/CTR/CVR in config) — not guarantees. In
            production these calibrate from the agency&rsquo;s own performance
            history.
          </p>
        </div>
      </section>

      {/* Optimisation notes */}
      {floorNotes.length > 0 && (
        <section className="card">
          <div className="card-head">
            <span className="eyebrow">{N()} — Optimisation notes</span>
            <h2 className="card-title">Why some channels were excluded</h2>
          </div>
          <div className="card-body">
            {floorNotes.map((n, i) => (
              <div className="note" key={i}>
                <InfoIcon size={16} />
                <span>{n}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Targeting */}
      <section className="card">
        <div className="card-head">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <span className="eyebrow">{N()} — Audience targeting</span>
              <h2 className="card-title">Paste-ready, per platform</h2>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span className="source-pill">
                <InfoIcon size={13} /> {sourceLabel}
              </span>
              <CopyButton text={allTargetingText} label="Copy all" />
            </div>
          </div>
        </div>
        <div className="card-body">
          {(Object.entries(targeting) as [Channel, PlatformTargeting][]).map(
            ([channel, t]) => (
              <div className="platform" key={channel}>
                <div className="platform-head">
                  <span className="name">
                    <span
                      className="ch-dot"
                      style={{ background: CHANNEL_VAR[channel] }}
                    />
                    {channel}
                  </span>
                  <CopyButton text={platformToText(channel, t)} />
                </div>
                <div className="kv">
                  {Object.entries(t).map(([key, val]) => (
                    <div className="kv-row" key={key}>
                      <span className="kv-key">{titleizeField(key)}</span>
                      <TargetingValueView value={val} />
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
          <p className="hint" style={{ marginTop: 14 }}>
            Drops straight into each ad manager. This is the one layer written by
            the language model — it produces targeting language only, never a
            number.
          </p>
        </div>
      </section>

      {/* Ad creative */}
      <section className="card">
        <div className="card-head">
          <span className="eyebrow">{N()} — Ad creative</span>
          <h2 className="card-title">Platform-native ad mockups</h2>
        </div>
        <div className="card-body">
          <div className="creative-grid">
            {creatives.map((c) => (
              <div className="creative-card" key={c.channel}>
                <AdMock c={c} client={client} imageUrl={site?.imageUrl} />
                <div className="creative-meta">
                  <div className="creative-meta-head">
                    <span
                      className="alloc-head"
                      style={{ fontWeight: 600, fontSize: 14 }}
                    >
                      <span
                        className="ch-dot"
                        style={{ background: CHANNEL_VAR[c.channel] }}
                      />
                      {c.channel}
                    </span>
                    <CopyButton text={creativeToText(c)} />
                  </div>
                  <div className="creative-spec">
                    {c.placement} · {c.ratio} · {c.width}×{c.height}
                  </div>
                  <div className="creative-fields">
                    <div>
                      <span className="kv-key">Headline</span> {c.headline}
                    </div>
                    <div>
                      <span className="kv-key">Primary</span> {c.primaryText}
                    </div>
                    <div>
                      <span className="kv-key">CTA</span> {c.cta}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 14 }}>
            Copy is written by the language layer and clamped to each
            platform&rsquo;s limits; each mockup is composed to the
            platform&rsquo;s native ad format.{" "}
            {site?.imageUrl
              ? `Visuals are built on ${site.host}'s own brand imagery.`
              : "Add a company website to build the visuals on the brand's real imagery, or plug in an image model."}
          </p>
        </div>
      </section>

      {/* Trust strip + actions */}
      <div className="trust-strip">
        <ShieldIcon size={16} />
        <span>
          Every figure above — fees, splits, the floor, the delivery estimates —
          is computed by a pure, deterministic engine. Fees reconcile exactly to
          your committed budget, and no number is ever generated by the language
          model.
        </span>
      </div>

      <div
        className="no-print"
        style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={downloadMarkdown}
        >
          <DownloadIcon size={15} /> Download proposal (.md)
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => window.print()}
        >
          <PrinterIcon size={15} /> Print / save as PDF
        </button>
      </div>
    </div>
  );
}
