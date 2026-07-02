// Shared plumbing for persona engines. A persona is a pure function
// (CommitteeInput) => PersonaOpinion and may only reference evidence rows.
import type {
  AssetInfo,
  Argument,
  Direction,
  Evidence,
  MacroSnapshot,
  QuantStats,
} from "@/lib/types";
import type { EvidenceContext } from "@/lib/evidence";
import type { L } from "@/lib/i18n";

export interface CommitteeInput {
  asset: AssetInfo;
  ctx: EvidenceContext;
  quant: QuantStats | null;
  macro: MacroSnapshot[];
  isEtf: boolean;
}

/** metric value by name, or null */
export function val(ctx: EvidenceContext, name: string): number | null {
  const e = ctx.byName.get(name);
  return typeof e?.metricValue === "number" ? e.metricValue : null;
}

export function ev(ctx: EvidenceContext, name: string): Evidence | undefined {
  return ctx.byName.get(name);
}

/** evidence ids for the metric names that actually exist */
export function ids(ctx: EvidenceContext, ...names: string[]): string[] {
  return names
    .map((n) => ctx.byName.get(n)?.id)
    .filter((x): x is string => !!x);
}

export function arg(
  text: L,
  evidenceIds: string[],
  isInference = false
): Argument {
  return { text, evidenceIds, isInference: isInference || evidenceIds.length === 0 };
}

export function stanceFromRating(rating: number): Direction {
  if (rating >= 60) return "bullish";
  if (rating <= 40) return "bearish";
  return "neutral";
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function collectCited(args: Argument[]): string[] {
  return [...new Set(args.flatMap((a) => a.evidenceIds))];
}

export function freshness(input: CommitteeInput): string {
  const parts: string[] = [];
  if (input.quant) parts.push(`price ${input.quant.lastPriceTime.slice(0, 16)}Z (delayed)`);
  const filing = input.ctx.byName.get("latest_filing");
  if (filing) parts.push(`latest filing ${filing.citation.publishedAt}`);
  const m = input.macro[0];
  if (m) parts.push(`macro obs ${m.observationDate}`);
  return parts.join(" · ") || "no live data";
}

export function yoyOf(ctx: EvidenceContext, name: string): number | null {
  const e = ctx.byName.get(name);
  if (!e) return null;
  const m = e.statement.en.match(/([+-][\d.]+)% YoY/);
  return m ? parseFloat(m[1]) : null;
}

export function pct(x: number | null): string {
  if (x === null) return "n/a";
  return `${x >= 0 ? "+" : ""}${x}%`;
}
