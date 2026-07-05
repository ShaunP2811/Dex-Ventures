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
