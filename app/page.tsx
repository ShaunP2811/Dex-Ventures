"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanInput, Proposal as ProposalT } from "@/lib/types";
import PlannerForm from "./components/PlannerForm";
import Proposal from "./components/Proposal";
import ThemeToggle from "./components/ThemeToggle";
import SavedPlans, { type SavedPlan } from "./components/SavedPlans";
import {
  AlertIcon,
  ChartIcon,
  CheckCircleIcon,
  PlusIcon,
  PrismMark,
} from "./components/icons";

const HISTORY_KEY = "prism.savedPlans.v1";

function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-mark">
        <ChartIcon size={26} />
      </div>
      <h2>Your proposal appears here</h2>
      <p>
        Enter a campaign brief and generate a client-ready media plan in seconds.
      </p>
      <ul>
        <li>
          <CheckCircleIcon size={16} />
          <span>
            <strong>Defensible fees</strong> — back-solved from your total
            budget, reconciled to the cent.
          </span>
        </li>
        <li>
          <CheckCircleIcon size={16} />
          <span>
            <strong>Dynamic allocation</strong> — split by objective and segment,
            with a minimum-spend floor that drops channels that can’t perform.
          </span>
        </li>
        <li>
          <CheckCircleIcon size={16} />
          <span>
            <strong>Paste-ready targeting</strong> + on-brand ad creative, per
            platform.
          </span>
        </li>
      </ul>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="skeleton" aria-live="polite" aria-busy="true">
      <div className="sk" style={{ height: 96, borderRadius: 16 }} />
      <div
        className="sk"
        style={{ height: 260, borderRadius: 16, marginTop: 20 }}
      />
      <div
        className="sk"
        style={{ height: 300, borderRadius: 16, marginTop: 20 }}
      />
      <span className="sr-only">Generating your media plan…</span>
    </div>
  );
}

export default function Page() {
  const [proposal, setProposal] = useState<ProposalT | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState<SavedPlan[]>([]);
  const [formKey, setFormKey] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (proposal) {
      setStatus(`Media plan ready for ${proposal.client}.`);
      resultRef.current?.focus();
    }
  }, [proposal]);

  function persist(next: SavedPlan[]) {
    setSaved(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  // Called when the current proposal is downloaded — store it in history.
  function handleDownloaded(markdown: string) {
    if (!proposal) return;
    const entry: SavedPlan = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      client: proposal.client,
      objective: proposal.objective,
      segment: proposal.segment,
      months: proposal.months,
      totalBudget: proposal.totalBudget,
      currency: proposal.currency,
      savedAt: Date.now(),
      markdown,
      proposal,
    };
    persist([entry, ...saved].slice(0, 20));
  }

  function newPlan() {
    setProposal(null);
    setError(null);
    setStatus("Started a new media plan.");
    setFormKey((k) => k + 1); // remount the form to clear it
  }

  async function generate(input: PlanInput) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong generating the plan.");
        setProposal(null);
      } else {
        setProposal(data as ProposalT);
      }
    } catch {
      setError("Could not reach the planner service. Please try again.");
      setProposal(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <PrismMark size={17} />
          </span>
          <span>
            Prism
            <small>Automated media planner</small>
          </span>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
        </div>
      </header>

      <main className="layout">
        <aside className="panel">
          <PlannerForm key={formKey} onSubmit={generate} loading={loading} />
        </aside>

        <div
          className="results"
          ref={resultRef}
          tabIndex={-1}
          role="region"
          aria-label="Generated media plan"
        >
          {loading ? (
            <LoadingState />
          ) : error ? (
            <div className="error" role="alert">
              <AlertIcon size={20} />
              <div>
                <strong>Can’t build this plan</strong>
                {error}
              </div>
            </div>
          ) : proposal ? (
            <>
              <div className="results-bar no-print">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={newPlan}
                >
                  <PlusIcon size={15} /> New media plan
                </button>
              </div>
              <Proposal proposal={proposal} onDownload={handleDownloaded} />
            </>
          ) : (
            <EmptyState />
          )}

          <SavedPlans
            plans={saved}
            onView={(p) => {
              setError(null);
              setProposal(p);
            }}
            onRemove={(id) => persist(saved.filter((s) => s.id !== id))}
            onClear={() => persist([])}
          />
        </div>
      </main>

      <div className="sr-only" role="status" aria-live="polite">
        {status}
      </div>
    </>
  );
}
