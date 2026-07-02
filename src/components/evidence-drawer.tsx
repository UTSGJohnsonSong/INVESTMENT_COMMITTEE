"use client";
// Citation system: every claim renders CitationChips; clicking one opens the
// right-hand drawer with the raw excerpt, source link, timestamps, and which
// committee members used the evidence.
import { createContext, useContext, useState } from "react";
import type { Evidence, PersonaId } from "@/lib/types";
import { Lang, pick } from "@/lib/i18n";
import { SourceLevelBadge, MockBadge } from "./ui";

interface DrawerCtx {
  open: (id: string) => void;
  evidenceById: Map<string, Evidence>;
  usedBy: Record<string, PersonaId[]>;
  personaNames: Record<string, string>;
  lang: Lang;
}

const Ctx = createContext<DrawerCtx | null>(null);

export function EvidenceProvider({
  evidence,
  usedBy,
  personaNames,
  lang,
  children,
}: {
  evidence: Evidence[];
  usedBy: Record<string, PersonaId[]>;
  personaNames: Record<string, string>;
  lang: Lang;
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const active = activeId ? evidenceById.get(activeId) : undefined;
  const zh = lang === "zh";

  return (
    <Ctx.Provider
      value={{ open: setActiveId, evidenceById, usedBy, personaNames, lang }}
    >
      {children}
      {active && (
        <div className="fixed inset-0 z-50" onClick={() => setActiveId(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-md bg-panel border-l border-line overflow-y-auto p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="num text-sm text-blue-400">{active.id}</span>
                <SourceLevelBadge level={active.citation.sourceLevel} />
                {active.isMock && <MockBadge />}
              </div>
              <button
                className="text-muted hover:text-foreground text-lg leading-none"
                onClick={() => setActiveId(null)}
              >
                ✕
              </button>
            </div>

            <p className="text-sm leading-relaxed">
              {pick(active.statement, lang)}
            </p>

            {active.citation.excerpt && (
              <div className="bg-panel2 border border-line rounded p-3 text-xs text-muted num leading-relaxed">
                {active.citation.excerpt}
              </div>
            )}

            <dl className="text-xs space-y-1.5">
              <Row k="Source" v={active.citation.sourceName} />
              <Row k="Type" v={active.citation.sourceType} />
              <Row k="Published / observed" v={active.citation.publishedAt} />
              <Row k="Retrieved at" v={active.citation.retrievedAt} />
              {active.citation.accessionNumber && (
                <Row k="Accession №" v={active.citation.accessionNumber} />
              )}
              {active.citation.formType && (
                <Row k="Form" v={active.citation.formType} />
              )}
              {active.citation.periodEnd && (
                <Row k="Period end" v={active.citation.periodEnd} />
              )}
              {active.citation.seriesId && (
                <Row k="Series ID" v={active.citation.seriesId} />
              )}
              <Row k="Confidence" v={`${active.confidence}/100`} />
            </dl>

            <a
              href={active.citation.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-blue-400 hover:underline break-all"
            >
              {active.citation.sourceUrl} ↗
            </a>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted mb-1.5">
                Used by
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(usedBy[active.id] ?? []).map((p) => (
                  <span
                    key={p}
                    className="text-[11px] border border-line rounded px-1.5 py-0.5 text-muted"
                  >
                    {personaNames[p] ?? p}
                  </span>
                ))}
                {(usedBy[active.id] ?? []).length === 0 && (
                  <span className="text-xs text-muted">
                    {zh
                      ? "未被任何委员直接引用"
                      : "Not directly cited by any member"}
                  </span>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </Ctx.Provider>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted w-36 shrink-0">{k}</dt>
      <dd className="num break-all">{v}</dd>
    </div>
  );
}

export function CitationChip({ id }: { id: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return <span className="num text-[10px] text-blue-400">[{id}]</span>;
  const e = ctx.evidenceById.get(id);
  if (!e) return null;
  const label =
    e.citation.formType ??
    e.citation.seriesId ??
    (e.citation.sourceType === "market_quote" ? "MKT" : e.citation.sourceLevel);
  return (
    <button
      onClick={() => ctx.open(id)}
      className="num inline-flex items-center gap-1 text-[10px] leading-none px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 align-middle mx-0.5"
      title={pick(e.statement, ctx.lang)}
    >
      {id}
      <span className="text-blue-500/70">{label}</span>
    </button>
  );
}

export function Chips({ ids }: { ids: string[] }) {
  const ctx = useContext(Ctx);
  const zh = ctx?.lang === "zh";
  if (ids.length === 0)
    return (
      <span
        className="inline-block text-[10px] leading-none px-1.5 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-400 align-middle mx-0.5"
        title="No direct evidence — inference / assumption"
      >
        {zh ? "推测" : "inference"}
      </span>
    );
  return (
    <>
      {ids.map((id) => (
        <CitationChip key={id} id={id} />
      ))}
    </>
  );
}
