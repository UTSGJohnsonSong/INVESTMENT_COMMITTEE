"use client";
// The soul of the product: the filterable list of everything the committee
// is allowed to know. Filters carry live counts; the list shows the first
// rows by default and expands to the full table on demand.
import { useMemo, useState } from "react";
import type { Direction, Evidence, SourceLevel } from "@/lib/types";
import { Lang, pick } from "@/lib/i18n";
import { MockBadge, SourceLevelBadge, directionColor } from "./ui";
import { CitationChip } from "./evidence-drawer";

type LevelFilter = "all" | SourceLevel | "primary";
type DirFilter = "all" | Direction;
type TagFilter = "all" | "sec" | "macro" | "market" | "financials" | "valuation";

const COLLAPSED_ROWS = 10;

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
  const [showAll, setShowAll] = useState(false);
  const zh = lang === "zh";

  const counts = useMemo(() => {
    const c = {
      p0: 0,
      bullish: 0,
      bearish: 0,
      neutral: 0,
      tags: {} as Record<string, number>,
    };
    for (const e of evidence) {
      if (e.citation.sourceLevel === "P0") c.p0++;
      c[e.direction]++;
      for (const t of e.tags) c.tags[t] = (c.tags[t] ?? 0) + 1;
    }
    return c;
  }, [evidence]);

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

  const visible = showAll ? filtered : filtered.slice(0, COLLAPSED_ROWS);
  const hidden = filtered.length - visible.length;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
        <FilterGroup
          value={level}
          onChange={(v) => setLevel(v as LevelFilter)}
          options={[
            ["all", `All (${evidence.length})`],
            ["primary", `${zh ? "仅一手来源" : "Primary only"} (${counts.p0})`],
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
            ["sec", `SEC (${counts.tags.sec ?? 0})`],
            ["financials", `${zh ? "财务" : "Financials"} (${counts.tags.financials ?? 0})`],
            ["macro", `${zh ? "宏观" : "Macro"} (${counts.tags.macro ?? 0})`],
            ["market", `${zh ? "市场" : "Market"} (${counts.tags.market ?? 0})`],
            ["valuation", `${zh ? "估值" : "Valuation"} (${counts.tags.valuation ?? 0})`],
          ]}
        />
        <span className="text-line px-1">|</span>
        <FilterGroup
          value={dir}
          onChange={(v) => setDir(v as DirFilter)}
          options={[
            ["all", zh ? "多空全部" : "All stances"],
            ["bullish", `Bullish (${counts.bullish})`],
            ["bearish", `Bearish (${counts.bearish})`],
            ["neutral", `Neutral (${counts.neutral})`],
          ]}
        />
      </div>

      <div className="space-y-1">
        {visible.map((e) => (
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
        {hidden > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-2 text-[12px] text-blue-400 hover:underline border border-dashed border-line/60 rounded"
          >
            {zh
              ? `显示全部 ${filtered.length} 条证据(还有 ${hidden} 条)↓`
              : `Show all ${filtered.length} evidence rows (${hidden} more) ↓`}
          </button>
        )}
        {showAll && filtered.length > COLLAPSED_ROWS && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full py-1.5 text-[11px] text-muted hover:text-foreground"
          >
            {zh ? "收起 ↑" : "Collapse ↑"}
          </button>
        )}
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
