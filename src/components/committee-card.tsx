"use client";
// Summary-first committee card: stance, score, one-line summary, top two
// arguments and the action are always visible; the full argument list, risks,
// cross-examination, the member's framework profile and cited evidence live
// behind the Details toggle — collapsed by default, nothing is lost.
import { useState } from "react";
import type { PersonaMeta, PersonaOpinion } from "@/lib/types";
import { Lang, pick } from "@/lib/i18n";
import { MockBadge, RatingBar, StanceBadge } from "./ui";
import { Chips } from "./evidence-drawer";

const COLLAPSED_ARGS = 2;

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
  const hiddenArgs = Math.max(0, opinion.arguments.length - COLLAPSED_ARGS);
  const visibleArgs = expanded
    ? opinion.arguments
    : opinion.arguments.slice(0, COLLAPSED_ARGS);

  return (
    <div
      id={`member-${meta.id}`}
      className="bg-panel border border-line rounded-lg overflow-hidden flex flex-col scroll-mt-20"
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
            {opinion.llmEnriched && (
              <span
                className="text-[10px] uppercase px-1.5 py-1 rounded border bg-violet-500/15 text-violet-400 border-violet-500/40"
                title={
                  zh
                    ? "定性论证由 LLM 深化(仅可引用证据表);评分与否决仍由规则引擎决定"
                    : "Qualitative text deepened by LLM (evidence-only citations); ratings and vetoes remain rule-based"
                }
              >
                LLM
              </span>
            )}
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
        <p className="font-medium">{pick(opinion.summary, lang)}</p>

        <div>
          <SectionLabel>{zh ? "核心论点" : "Top arguments"}</SectionLabel>
          <ul className="space-y-1.5">
            {visibleArgs.map((a, i) => (
              <li key={i}>
                {pick(a.text, lang)} <Chips ids={a.evidenceIds} />
              </li>
            ))}
          </ul>
          {!expanded && hiddenArgs > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1 text-[11px] text-blue-400 hover:underline"
            >
              {zh ? `+${hiddenArgs} 条论点…` : `+${hiddenArgs} more…`}
            </button>
          )}
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

            <div className="border border-line rounded p-2.5 bg-panel2/40 space-y-2">
              <SectionLabel>
                {zh ? "该委员的决策框架" : "This member's framework"}
              </SectionLabel>
              <FrameworkRow label={zh ? "哲学" : "Philosophy"}>
                {pick(meta.philosophy, lang)}
              </FrameworkRow>
              <FrameworkRow label={zh ? "首要问题" : "First question"}>
                “{pick(meta.firstQuestion, lang)}”
              </FrameworkRow>
              <FrameworkRow label={zh ? "无法容忍" : "Hates"}>
                {pick(meta.hates, lang)}
              </FrameworkRow>
              {meta.vetoRule && (
                <FrameworkRow label={zh ? "常设否决权" : "Standing veto"}>
                  {pick(meta.vetoRule, lang)}
                </FrameworkRow>
              )}
              <FrameworkRow label={zh ? "框架盲区" : "Blind spot"}>
                {pick(meta.blindSpot, lang)}
              </FrameworkRow>
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
          {expanded
            ? zh
              ? "收起详情"
              : "Hide details"
            : zh
              ? "展开详情(风险 · 质询 · 框架档案)"
              : "Details (risks · cross-exam · framework)"}
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

function FrameworkRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-xs">
      <span className="text-muted">{label} — </span>
      <span className="text-foreground/85">{children}</span>
    </div>
  );
}
