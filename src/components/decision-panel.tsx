// Summary-first decision panel: rating, votes, allocation and vetoes are
// always visible; scenario analysis and the full risk ledger expand on
// demand via native <details> (works without JS, server-rendered).
import type { FinalDecision, PersonaOpinion } from "@/lib/types";
import { Lang, pick } from "@/lib/i18n";
import { PERSONAS, PERSONA_ORDER } from "@/lib/committee/meta";
import { Panel, WarnBadge } from "./ui";
import { Chips } from "./evidence-drawer";

const RATING_COLOR: Record<FinalDecision["overallRating"], string> = {
  "Strong Buy": "text-bullish",
  Buy: "text-bullish",
  Watch: "text-warn",
  Hold: "text-zinc-300",
  Reduce: "text-bearish",
  Avoid: "text-bearish",
};

const STANCE_DOT: Record<string, string> = {
  bullish: "bg-green-500",
  bearish: "bg-red-500",
  neutral: "bg-zinc-500",
};

export function DecisionPanel({
  decision,
  opinions,
  lang,
}: {
  decision: FinalDecision;
  opinions: PersonaOpinion[];
  lang: Lang;
}) {
  const zh = lang === "zh";
  const opinionByPersona = new Map(opinions.map((o) => [o.persona, o]));

  return (
    <Panel
      title={zh ? "Final Decision Panel · 委员会合议" : "Final Decision Panel"}
      right={
        <span className="num text-[11px] text-muted">
          evidence quality {decision.evidenceQuality} · citation coverage{" "}
          {decision.citationCoverage}%
        </span>
      }
    >
      {/* ---- Always visible: the decision at a glance ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Stat label="Overall rating">
          <span className={`text-2xl font-bold ${RATING_COLOR[decision.overallRating]}`}>
            {decision.overallRating}
          </span>
          <div className="num text-[11px] text-muted mt-0.5">
            {zh ? "加权得分" : "weighted score"} {decision.score}/100
          </div>
        </Stat>
        <Stat label="Confidence">
          <span className="num text-2xl font-bold">{decision.confidence}</span>
          <span className="text-muted text-sm">/100</span>
        </Stat>
        <Stat label="Suggested role">
          <span className="text-lg font-semibold">{decision.suggestedRole}</span>
        </Stat>
        <Stat label="Time horizon">
          <span className="text-lg font-semibold">
            {pick(decision.timeHorizon, lang)}
          </span>
        </Stat>
      </div>

      {/* Committee votes at a glance — click a member to jump to their card */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 mb-4">
        {PERSONA_ORDER.map((pid) => {
          const op = opinionByPersona.get(pid);
          const meta = PERSONAS[pid];
          if (!op) return null;
          return (
            <a
              key={pid}
              href={`#member-${pid}`}
              className="border border-line rounded px-2 py-1.5 bg-panel2/40 hover:border-blue-500/40 text-center"
              title={pick(op.summary, lang)}
            >
              <div
                className="text-[10px] font-semibold truncate"
                style={{ color: meta.color }}
              >
                {meta.name.split(" ").pop()}
              </div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${STANCE_DOT[op.stance]}`}
                />
                <span className="num text-[11px]">{op.rating}</span>
                {op.veto?.triggered && (
                  <span className="text-[9px] text-bearish font-semibold">V</span>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {/* Allocation as one compact strip */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mb-4 border border-line rounded p-3 bg-panel2/40 text-[13px]">
        <span className="text-[10px] uppercase tracking-widest text-muted">
          {zh ? "建议仓位" : "Allocation"}
        </span>
        {(
          [
            [zh ? "保守" : "Conservative", decision.allocation.conservative],
            [zh ? "平衡" : "Balanced", decision.allocation.balanced],
            [zh ? "进取" : "Aggressive", decision.allocation.aggressive],
          ] as const
        ).map(([label, v]) => (
          <span key={label}>
            <span className="text-muted">{label}</span>{" "}
            <span className="num font-bold">{v}%</span>
          </span>
        ))}
        <span className="text-[11px] text-muted">
          {zh ? "占组合总值" : "of total portfolio"}
        </span>
      </div>

      {decision.vetoesApplied.length > 0 && (
        <div className="mb-4 border border-red-500/30 bg-red-500/5 rounded p-3">
          <div className="text-[10px] uppercase tracking-widest text-bearish mb-2">
            Vetoes & constraints applied
          </div>
          <ul className="space-y-1 text-xs">
            {decision.vetoesApplied.map((v, i) => (
              <li key={i}>
                <span className="font-semibold" style={{ color: PERSONAS[v.persona].color }}>
                  {PERSONAS[v.persona].name}:
                </span>{" "}
                {pick(v.reason, lang)} →{" "}
                <span className="text-bearish">{pick(v.effect, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-x-5 gap-y-1 mb-4 text-[12px]">
        <p>
          <span className="text-[10px] uppercase tracking-widest text-bullish/80 mr-2">
            {zh ? "预期上行" : "Expected upside"}
          </span>
          <span className="text-muted">{pick(decision.expectedUpside, lang)}</span>
        </p>
        <p>
          <span className="text-[10px] uppercase tracking-widest text-bearish/80 mr-2">
            {zh ? "预期下行" : "Expected downside"}
          </span>
          <span className="text-muted">{pick(decision.expectedDownside, lang)}</span>
        </p>
      </div>

      {/* ---- Expandable: scenario analysis ---- */}
      <details className="mb-3 border border-line rounded">
        <summary className="cursor-pointer px-3 py-2 text-[12px] text-blue-400 hover:bg-panel2/50 list-none select-none">
          ▸{" "}
          {zh
            ? `场景分析 — Bull / Base / Bear 区间、前提与失效条件 (${decision.scenarios.length})`
            : `Scenario analysis — bull / base / bear ranges, drivers & invalidation (${decision.scenarios.length})`}
        </summary>
        {/* Scenario ranges — never point estimates; the method is always shown */}
        <div className="grid md:grid-cols-3 gap-3 p-3 pt-1">
          {decision.scenarios.map((s, i) => {
            const tone =
              i === 0 ? "text-bullish" : i === 2 ? "text-bearish" : "text-zinc-300";
            return (
              <div key={i} className="border border-line rounded p-3 bg-panel2/40">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-muted">
                    {pick(s.name, lang)}
                  </span>
                  <Chips ids={s.evidenceIds} />
                </div>
                <div className={`num text-lg font-bold mt-1 ${tone}`}>{s.range}</div>
                <div className="text-[10px] text-muted num mt-0.5">
                  {pick(s.method, lang)}
                </div>
                <div className="text-[11px] mt-2">
                  <span className="text-muted">
                    {zh ? "前提:" : "Requires: "}
                  </span>
                  {pick(s.drivers, lang)}
                </div>
                <div className="text-[11px] mt-1">
                  <span className="text-muted">
                    {zh ? "失效:" : "Invalidated by: "}
                  </span>
                  {pick(s.invalidation, lang)}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {/* ---- Expandable: full risk ledger ---- */}
      <details className="mb-4 border border-line rounded">
        <summary className="cursor-pointer px-3 py-2 text-[12px] text-blue-400 hover:bg-panel2/50 list-none select-none">
          ▸{" "}
          {zh
            ? `风险 (${decision.keyRisks.length}) · 催化剂 (${decision.keyCatalysts.length}) · 退出准则 (${decision.killCriteria.length}) · 改变判断的条件 (${decision.changeOfMind.length})`
            : `Risks (${decision.keyRisks.length}) · Catalysts (${decision.keyCatalysts.length}) · Kill criteria (${decision.killCriteria.length}) · Change of mind (${decision.changeOfMind.length})`}
        </summary>
        <div className="grid md:grid-cols-2 gap-4 p-3 pt-1 text-[13px]">
          <div>
            <Label>Key risks</Label>
            <ul className="space-y-1 text-muted">
              {decision.keyRisks.map((r, i) => (
                <li key={i}>
                  {pick(r.text, lang)} <Chips ids={r.evidenceIds} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>Key catalysts</Label>
            <ul className="space-y-1 text-muted">
              {decision.keyCatalysts.map((r, i) => (
                <li key={i}>
                  {pick(r.text, lang)} <Chips ids={r.evidenceIds} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>
              {zh ? "Kill criteria — 触发即重估/退出" : "Kill criteria — re-evaluate or exit on trigger"}
            </Label>
            <ul className="space-y-1">
              {decision.killCriteria.map((k, i) => (
                <li key={i} className="text-warn/90">
                  ⚠ {pick(k, lang)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>What would change our mind</Label>
            <ul className="space-y-1 text-muted">
              {decision.changeOfMind.map((k, i) => (
                <li key={i}>◇ {pick(k, lang)}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        {decision.disclaimers.map((d, i) => (
          <WarnBadge key={i}>{pick(d, lang)}</WarnBadge>
        ))}
      </div>
    </Panel>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-muted mb-1.5">
      {children}
    </div>
  );
}
