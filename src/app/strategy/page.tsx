import { cookies } from "next/headers";
import { buildStrategy } from "@/lib/strategy";
import { PERSONAS } from "@/lib/committee/meta";
import type { PersonaId } from "@/lib/types";
import { langFromCookie, pick } from "@/lib/i18n";
import { EvidenceProvider, Chips } from "@/components/evidence-drawer";
import { Panel, SourceLevelBadge, StanceBadge, WarnBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

function PlanSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

export default async function StrategyPage() {
  const lang = langFromCookie((await cookies()).get("lang")?.value);
  const zh = lang === "zh";
  const s = await buildStrategy();

  const usedBy: Record<string, PersonaId[]> = {};
  for (const t of s.takes) {
    for (const id of t.evidenceIds) (usedBy[id] ??= []).push(t.persona);
  }
  const personaNames = Object.fromEntries(
    Object.values(PERSONAS).map((p) => [p.id, p.name])
  );

  return (
    <EvidenceProvider
      evidence={s.evidence}
      usedBy={usedBy}
      personaNames={personaNames}
      lang={lang}
    >
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">
            {zh ? "当下投资策略 · Strategy Committee" : "Strategy Now · Strategy Committee"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {zh
              ? "不针对单一标的:八位委员基于当前宏观与市场证据,讨论「现在应该怎么配置」,输出三套风险阈值不同的方案。"
              : "No single ticker: eight members read the current macro and market evidence, debate how to be positioned now, and produce three plans at three risk thresholds."}{" "}
            generated {s.generatedAt.slice(0, 16)}Z
          </p>
        </div>

        {/* ---- Regime ---- */}
        <Panel
          title={zh ? "当前环境判断 · Regime" : "Current regime"}
          right={<SourceLevelBadge level="P0" />}
        >
          <ul className="space-y-1.5 text-[13px]">
            {s.regimeSummary.map((r, i) => (
              <li key={i}>· {pick(r, lang)}</li>
            ))}
          </ul>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {s.macro.map((m) => (
              <a
                key={m.seriesId}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-line rounded p-2 bg-panel2/50 hover:border-blue-500/40"
              >
                <div className="text-[10px] text-muted">{m.label}</div>
                <div className="num text-base font-semibold">
                  {m.value}
                  {m.unit}
                </div>
                <div className="text-[10px] text-muted num">
                  {m.seriesId} · {m.observationDate}
                </div>
              </a>
            ))}
          </div>
        </Panel>

        {/* ---- Committee takes ---- */}
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-muted uppercase mb-3">
            {zh
              ? "委员会讨论 · 同一组证据,八个框架"
              : "Committee discussion — one body of evidence, eight frameworks"}
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {s.takes.map((t) => {
              const meta = PERSONAS[t.persona];
              return (
                <div
                  key={t.persona}
                  className="bg-panel border border-line rounded-lg p-4"
                  style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm" style={{ color: meta.color }}>
                      {meta.name}
                    </span>
                    <StanceBadge stance={t.stance} />
                  </div>
                  <p className="text-[13px] leading-relaxed">
                    {pick(t.text, lang)} <Chips ids={t.evidenceIds} />
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Three plans ---- */}
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-muted uppercase mb-3">
            {zh
              ? "三套方案 · 同一个方向判断,三种风险预算"
              : "Three plans — one directional view, three risk budgets"}
          </h2>
          <div className="grid lg:grid-cols-3 gap-4">
            {s.plans.map((p, idx) => (
              <div
                key={idx}
                className={`bg-panel border rounded-lg overflow-hidden ${
                  idx === 1 ? "border-blue-500/50" : "border-line"
                }`}
              >
                <div className="px-4 py-3 border-b border-line">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{pick(p.name, lang)}</span>
                    {idx === 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-400">
                        {zh ? "默认推荐" : "Default pick"}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    {pick(p.subtitle, lang)}
                  </div>
                  <div className="num text-xs text-warn mt-1.5">
                    {pick(p.riskThreshold, lang)}
                  </div>
                </div>
                <div className="px-4 pt-3 text-[11px] text-muted">
                  <span className="text-foreground/80">
                    {zh ? "适合:" : "Suitable for: "}
                  </span>
                  {pick(p.suitableFor, lang)}
                </div>
                <div className="p-4 space-y-2">
                  {p.allocations.map((a, ai) => (
                    <div key={ai}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span>
                          {pick(a.bucket, lang)}{" "}
                          <span className="text-muted text-[11px]">{a.instrument}</span>
                        </span>
                        <span className="num font-semibold">{a.weight}%</span>
                      </div>
                      <div className="h-1.5 bg-panel2 rounded overflow-hidden mt-1">
                        <div
                          className="h-full rounded bg-blue-500/70"
                          style={{ width: `${a.weight}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        <span className="text-foreground/70">{pick(a.role, lang)}</span>
                        {" — "}
                        {pick(a.note, lang)} <Chips ids={a.evidenceIds} />
                      </div>
                      <div className="text-[10px] text-muted/80">
                        {zh ? "支持委员:" : "Backed by: "}
                        {a.supporters.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-[12px] text-muted leading-relaxed border-t border-line pt-3">
                    {pick(p.behavior, lang)}
                  </p>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                      Kill criteria
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-warn/90">
                      {p.killCriteria.map((k, i) => (
                        <li key={i}>⚠ {pick(k, lang)}</li>
                      ))}
                    </ul>
                  </div>
                  <details className="group">
                    <summary className="cursor-pointer text-[11px] text-blue-400 hover:underline list-none">
                      {zh ? "▸ 完整方案细节(目标、调整规则、监控清单)" : "▸ Full plan details (objective, rules, monitoring)"}
                    </summary>
                    <div className="mt-3 space-y-3 text-[12px]">
                      <PlanSection label={zh ? "目标" : "Objective"}>
                        <p>{pick(p.objective, lang)}</p>
                      </PlanSection>
                      <PlanSection label={zh ? "核心哲学" : "Core philosophy"}>
                        <p className="text-muted">{pick(p.corePhilosophy, lang)}</p>
                      </PlanSection>
                      <PlanSection label={zh ? "与另外两套的区别" : "Why it differs"}>
                        <p className="text-muted">{pick(p.whyDifferent, lang)}</p>
                      </PlanSection>
                      <PlanSection label={zh ? "调整规则(涨/跌/宏观变化)" : "Adjustment rules (up / down / regime change)"}>
                        <ul className="space-y-1 text-muted">
                          {p.adjustmentRules.map((x, i) => (
                            <li key={i}>· {pick(x, lang)}</li>
                          ))}
                        </ul>
                      </PlanSection>
                      <PlanSection label={zh ? "现金部署规则" : "Cash deployment rules"}>
                        <ul className="space-y-1 text-muted">
                          {p.cashDeploymentRules.map((x, i) => (
                            <li key={i}>· {pick(x, lang)}</li>
                          ))}
                        </ul>
                      </PlanSection>
                      <PlanSection label={zh ? "何时应更进攻" : "More aggressive if"}>
                        <ul className="space-y-1 text-bullish/80">
                          {p.moreAggressiveIf.map((x, i) => (
                            <li key={i}>· {pick(x, lang)}</li>
                          ))}
                        </ul>
                      </PlanSection>
                      <PlanSection label={zh ? "何时应更防守" : "More defensive if"}>
                        <ul className="space-y-1 text-bearish/80">
                          {p.moreDefensiveIf.map((x, i) => (
                            <li key={i}>· {pick(x, lang)}</li>
                          ))}
                        </ul>
                      </PlanSection>
                      <PlanSection label={zh ? "监控清单" : "Monitoring checklist"}>
                        <ul className="space-y-1 text-muted">
                          {p.monitoring.map((x, i) => (
                            <li key={i}>· {pick(x, lang)}</li>
                          ))}
                        </ul>
                      </PlanSection>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Constraints ---- */}
        <Panel title={zh ? "生效的约束与调整 · Vetoes & tilts" : "Active constraints & tilts"}>
          <ul className="space-y-1.5 text-[13px]">
            {s.constraints.map((c, i) => {
              const txt = pick(c, lang);
              return (
                <li
                  key={i}
                  className={
                    txt.includes("veto") || txt.includes("硬约束") || txt.toLowerCase().includes("hard constraint")
                      ? "text-bearish/90"
                      : "text-muted"
                  }
                >
                  · {txt}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2 mt-4">
            {s.disclaimers.map((d, i) => (
              <WarnBadge key={i}>{pick(d, lang)}</WarnBadge>
            ))}
          </div>
        </Panel>
      </div>
    </EvidenceProvider>
  );
}
