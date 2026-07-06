/** Presentation helpers — never used for computation, only display. */

export function formatMoney(n: number, currency = "RM"): string {
  return `${currency} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatRM(n: number): string {
  return formatMoney(n, "RM");
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function titleizeField(key: string): string {
  return key.replace(/_/g, " ");
}

/**
 * Flattens any targeting value to a readable string — including nested objects
 * and keyword objects the LLM may return. Guarantees we never try to render a
 * raw object as a React child (React error #31).
 */
export function valueToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (x && typeof x === "object" && "term" in (x as object)) {
          const k = x as { term: unknown; match?: unknown };
          return k.match ? `${k.term} [${k.match}]` : String(k.term);
        }
        return valueToString(x);
      })
      .join(", ");
  }
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${titleizeField(k)}: ${valueToString(val)}`)
      .join("; ");
  }
  return String(v);
}
