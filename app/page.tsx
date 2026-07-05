"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanInput, Proposal as ProposalT } from "@/lib/types";
import PlannerForm from "./components/PlannerForm";
import Proposal from "./components/Proposal";
import ThemeToggle from "./components/ThemeToggle";
import {
  AlertIcon,
  ChartIcon,
  CheckCircleIcon,
  PrismMark,
} from "./components/icons";

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
            <strong>Paste-ready targeting</strong> — per-platform, in each ad
            manager’s own taxonomy.
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
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (proposal) {
      setStatus(`Media plan ready for ${proposal.client}.`);
      resultRef.current?.focus();
    }
  }, [proposal]);

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
          <PlannerForm onSubmit={generate} loading={loading} />
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
            <Proposal proposal={proposal} />
          ) : (
            <EmptyState />
          )}
        </div>
      </main>

      <div className="sr-only" role="status" aria-live="polite">
        {status}
      </div>
    </>
  );
}
