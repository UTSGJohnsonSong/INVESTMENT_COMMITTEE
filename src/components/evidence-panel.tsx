"use client";
// The soul of the product: the filterable list of everything the committee
// is allowed to know.
import { useMemo, useState } from "react";
import type { Direction, Evidence, SourceLevel } from "@/lib/types";
import { Lang, pick } from "@/lib/i18n";
import { MockBadge, SourceLevelBadge, directionColor } from "./ui";
import { CitationChip } from "./evidence-drawer";

type LevelFilter = "all" | SourceLevel | "primary";
type DirFilter = "all" | Direction;
type TagFilter = "all" | "sec" | "macro" | "market" | "financials" | "valuation";

export function EvidencePanel({
  evidence,
  lang,
}: {
  evidence: Evidence[];
  lang: Lang;
}) {
  const [level, setLevel] = useState<LevelFilter>("all");
  const [dir, setDir] = useState<DirFilter>("all");
  const [tag, setTag] = useState<TagFilter>("all");
  const zh = lang === "zh";

  const filtered = useMemo(
    () =>
      evidence.filter((e) => {
        if (level === "primary" && e.citation.sourceLevel !== "P0") return false;
        if (level !== "all" && level !== "primary" && e.citation.sourceLevel !== level)
          return false;
        if (dir !== "all" && e.direction !== dir) return false;
        if (tag !== "all" && !e.tags.includes(tag)) return false;
        return true;
      }),
    [evidence, level, dir, tag]
  );

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
        <FilterGroup
          value={level}
          onChange={(v) => setLevel(v as LevelFilter)}
          options={[
            ["all", "All"],
            ["primary", zh ? "仅一手来源" : "Primary only"],
            ["P0", "P0"],
            ["P1", "P1"],
          ]}
        />
        <span className="text-line px-1">|</span>
        <FilterGroup
          value={tag}
          onChange={(v) => setTag(v as TagFilter)}
          options={[
            ["all", zh ? "全部类型" : "All types"],
            ["sec", "SEC"],
            ["financials", zh ? "财务" : "Financials"],
            ["macro", zh ? "宏观" : "Macro"],
            ["market", zh ? "市场" : "Market"],
            ["valuation", zh ? "估值" : "Valuation"],
          ]}
        />
        <span className="text-line px-1">|</span>
        <FilterGroup
          value={dir}
          onChange={(v) => setDir(v as DirFilter)}
          options={[
            ["all", zh ? "多空全部" : "All stances"],
            ["bullish", "Bullish"],
            ["bearish", "Bearish"],
            ["neutral", "Neutral"],
          ]}
        />
      </div>

      <div className="space-y-1">
        {filtered.map((e) => (
          <div
            key={e.id}
            className="flex items-start gap-2.5 px-3 py-2 rounded border border-line/60 bg-panel2/40 hover:border-line"
          >
            <CitationChip id={e.id} />
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] leading-snug ${directionColor(e.direction)}`}>
                {pick(e.statement, lang)}
              </p>
              <p className="text-[11px] text-muted mt-0.5 truncate">
                {e.citation.sourceName} · published {e.citation.publishedAt} ·
                retrieved {e.citation.retrievedAt.slice(0, 16)}Z
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {e.isMock && <MockBadge />}
              <SourceLevelBadge level={e.citation.sourceLevel} />
              <span className="num text-[10px] text-muted w-7 text-right" title="confidence">
                {e.confidence}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted py-4 text-center">
            {zh ? "没有符合筛选条件的证据。" : "No evidence matches the filters."}
          </p>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex gap-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2 py-1 rounded border ${
            value === v
              ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
              : "border-line text-muted hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
