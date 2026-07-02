import type { Direction, SourceLevel } from "@/lib/types";

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-panel border border-line rounded-lg overflow-hidden ${className}`}
    >
      {title !== undefined && (
        <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">
            {title}
          </h2>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const LEVEL_STYLE: Record<SourceLevel, string> = {
  P0: "bg-blue-500/15 text-blue-400 border-blue-500/40",
  P1: "bg-cyan-500/15 text-cyan-400 border-cyan-500/40",
  P2: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  P3: "bg-zinc-500/15 text-zinc-400 border-zinc-500/40",
};

export function SourceLevelBadge({ level }: { level: SourceLevel }) {
  return (
    <span
      className={`num inline-block text-[10px] leading-none px-1.5 py-1 rounded border ${LEVEL_STYLE[level]}`}
      title={
        level === "P0"
          ? "Primary official source"
          : level === "P1"
            ? "High-quality data vendor"
            : level === "P2"
              ? "News / analysis — sentiment only"
              : "Low-trust source — sentiment only"
      }
    >
      {level}
    </span>
  );
}

const STANCE_STYLE: Record<Direction, string> = {
  bullish: "bg-green-500/15 text-bullish border-green-500/40",
  bearish: "bg-red-500/15 text-bearish border-red-500/40",
  neutral: "bg-zinc-500/15 text-zinc-400 border-zinc-500/40",
};

export function StanceBadge({ stance }: { stance: Direction }) {
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider leading-none px-1.5 py-1 rounded border ${STANCE_STYLE[stance]}`}
    >
      {stance}
    </span>
  );
}

export type DataBadgeKind =
  | "reported"
  | "derived"
  | "delayed"
  | "stale"
  | "mixed"
  | "conflict"
  | "mock";

const DATA_BADGE_STYLE: Record<DataBadgeKind, string> = {
  reported: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  derived: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  delayed: "bg-amber-500/10 text-warn border-amber-500/30",
  stale: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  mixed: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  conflict: "bg-red-500/15 text-bearish border-red-500/40",
  mock: "bg-purple-500/15 text-purple-400 border-purple-500/40",
};

const DATA_BADGE_TITLE: Record<DataBadgeKind, string> = {
  reported: "As reported in the source filing",
  derived: "Computed from reported inputs — formula shown in the citation",
  delayed: "Based on delayed market data",
  stale: "Latest available period is old — treat with caution",
  mixed: "Combines inputs from different periods",
  conflict: "Sources disagree — no value was silently chosen",
  mock: "Placeholder — not real data, excluded from decisions",
};

export function DataBadge({ kind }: { kind: DataBadgeKind }) {
  return (
    <span
      className={`inline-block text-[9px] uppercase tracking-wider leading-none px-1 py-0.5 rounded border align-middle ${DATA_BADGE_STYLE[kind]}`}
      title={DATA_BADGE_TITLE[kind]}
    >
      {kind}
    </span>
  );
}

export function MockBadge() {
  return (
    <span className="inline-block text-[10px] leading-none px-1.5 py-1 rounded border bg-purple-500/15 text-purple-400 border-purple-500/40">
      MOCK
    </span>
  );
}

export function WarnBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[11px] leading-none px-1.5 py-1 rounded border bg-amber-500/10 text-warn border-amber-500/30">
      {children}
    </span>
  );
}

export function RatingBar({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const c =
    color ?? (value >= 60 ? "var(--bullish)" : value <= 40 ? "var(--bearish)" : "#a1a1aa");
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 bg-panel2 rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${value}%`, background: c }}
        />
      </div>
      <span className="num text-xs w-8 text-right">{value}</span>
    </div>
  );
}

export function directionColor(d: Direction): string {
  return d === "bullish"
    ? "text-bullish"
    : d === "bearish"
      ? "text-bearish"
      : "text-zinc-400";
}

export function fmtCompact(v: number, unit?: string): string {
  if (unit === "USD") {
    const abs = Math.abs(v);
    if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toLocaleString()}`;
  }
  if (unit === "%") return `${v}%`;
  if (unit === "USD/share") return `$${v}`;
  return String(v);
}
