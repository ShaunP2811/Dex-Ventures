"use client";

import { formatMoney } from "@/lib/format";
import type { Proposal as ProposalT } from "@/lib/types";
import { DownloadIcon, HistoryIcon } from "./icons";

export interface SavedPlan {
  id: string;
  client: string;
  objective: string;
  segment: string;
  months: number;
  totalBudget: number;
  currency: string;
  savedAt: number;
  markdown: string;
  proposal: ProposalT;
}

function downloadMd(p: SavedPlan) {
  const blob = new Blob([p.markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.client.replace(/\s+/g, "-").toLowerCase()}-media-plan.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SavedPlans({
  plans,
  onView,
  onRemove,
  onClear,
}: {
  plans: SavedPlan[];
  onView: (p: ProposalT) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!plans.length) return null;

  return (
    <section className="card saved no-print" style={{ marginTop: 20 }}>
      <div className="card-head saved-head">
        <div>
          <span className="eyebrow">
            <HistoryIcon size={12} /> Saved plans
          </span>
          <h2 className="card-title">Downloaded proposals ({plans.length})</h2>
        </div>
        <button type="button" className="copy-btn" onClick={onClear}>
          Clear all
        </button>
      </div>
      <div className="card-body">
        <ul className="saved-list">
          {plans.map((p) => (
            <li key={p.id} className="saved-row">
              <div className="saved-meta">
                <span className="saved-client">{p.client}</span>
                <span className="saved-sub">
                  {p.objective} · {p.segment} · {p.months} mo ·{" "}
                  {formatMoney(p.totalBudget, p.currency)}
                </span>
                <span className="saved-date">
                  {new Date(p.savedAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="saved-actions">
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => onView(p.proposal)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => downloadMd(p)}
                >
                  <DownloadIcon size={13} /> .md
                </button>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => onRemove(p.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
