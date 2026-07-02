"use client";
// Summary-first committee card: stance, score, one-line view, top arguments
// and action are always visible; risks, cross-examination, blind spot and the
// full evidence list live behind the Details toggle.
import { useState } from "react";
import type { PersonaMeta, PersonaOpinion } from "@/lib/types";
import { Lang, pick } from "@/lib/i18n";
import { MockBadge, RatingBar, StanceBadge } from "./ui";
import { Chips } from "./evidence-drawer";

export function CommitteeCard({
  opinion,
  meta,
  allNames,
  lang,
}: {
  opinion: PersonaOpinion;
  meta: PersonaMeta;
  allNames: Record<string, string>;
  lang: Lang;
}) {
  const [expanded, setExpanded] = useState(false);
  const zh = lang === "zh";

  return (
    <div
      className="bg-panel border border-line rounded-lg overflow-hidden flex flex-col"
      style={{ borderTopColor: meta.color, borderTopWidth: 2 }}
    >
      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-sm" style={{ color: meta.color }}>
              {meta.name}
            </div>
            <div className="text-[11px] text-muted">{pick(meta.title, lang)}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {opinion.usesMockData && <MockBadge />}
            {opinion.veto?.triggered && (
              <span className="text-[10px] uppercase px-1.5 py-1 rounded border bg-red-500/15 text-bearish border-red-500/40">
                VETO
              </span>
            )}
            <StanceBadge stance={opinion.stance} />
          </div>
        </div>
        <div className="mt-2">
          <RatingBar value={opinion.rating} color={meta.color} />
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1 text-[13px] leading-relaxed">
        <div className="text-xs italic" style={{ color: meta.color }}>
          “{pick(meta.firstQuestion, lang)}”
        </div>

        <div>
          <SectionLabel>{zh ? "核心论点" : "Top arguments"}</SectionLabel>
          <ul className="space-y-1.5">
            {opinion.arguments.slice(0, 3).map((a, i) => (
              <li key={i}>
                {pick(a.text, lang)} <Chips ids={a.evidenceIds} />
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-line rounded p-2.5 bg-panel2/50">
          <SectionLabel>{zh ? "建议动作" : "Recommended action"}</SectionLabel>
          <p>{pick(opinion.recommendedAction, lang)}</p>
        </div>

        {opinion.veto?.triggered && (
          <div className="border border-red-500/40 rounded p-2.5 bg-red-500/10">
            <SectionLabel>{zh ? "一票否决" : "Veto"}</SectionLabel>
            <p className="text-bearish text-xs">
              {pick(opinion.veto.reason, lang)} → {pick(opinion.veto.effect, lang)}
            </p>
          </div>
        )}

        {expanded && (
          <>
            <div>
              <SectionLabel>{zh ? "风险" : "Risks"}</SectionLabel>
              <ul className="space-y-1.5 text-muted">
                {opinion.risks.map((a, i) => (
                  <li key={i}>
                    {pick(a.text, lang)} <Chips ids={a.evidenceIds} />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <SectionLabel>{zh ? "交叉质询" : "Cross-examination"}</SectionLabel>
              <p className="text-xs text-amber-400/90">
                “{pick(opinion.challenge, lang)}”
              </p>
              {opinion.disagreements.length > 0 && (
                <ul className="mt-1.5 space-y-1 text-xs text-muted">
                  {opinion.disagreements.map((d, i) => (
                    <li key={i}>
                      <span className="text-foreground">
                        vs {allNames[d.with] ?? d.with}:
                      </span>{" "}
                      {pick(d.text, lang)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <SectionLabel>{zh ? "该框架的盲区" : "Blind spot of this framework"}</SectionLabel>
              <p className="text-xs text-muted">{pick(meta.blindSpot, lang)}</p>
            </div>

            <div>
              <SectionLabel>{zh ? "引用的证据" : "Evidence cited"}</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {opinion.citedEvidenceIds.length > 0 ? (
                  <Chips ids={opinion.citedEvidenceIds} />
                ) : (
                  <span className="text-xs text-muted">
                    {zh
                      ? "本委员未直接引用证据。"
                      : "This member cited no direct evidence."}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-line flex items-center justify-between text-[11px] text-muted">
        <span className="num">
          confidence {opinion.confidence} · {opinion.dataFreshness}
        </span>
        <button
          onClick={() => setExpanded((s) => !s)}
          className="text-blue-400 hover:underline"
        >
          {expanded ? (zh ? "收起详情" : "Hide details") : zh ? "展开详情" : "Details"}
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
      {children}
    </div>
  );
}
