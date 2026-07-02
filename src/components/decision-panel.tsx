import type { FinalDecision } from "@/lib/types";
import { Lang, pick } from "@/lib/i18n";
import { PERSONAS } from "@/lib/committee/meta";
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

export function DecisionPanel({
  decision,
  lang,
}: {
  decision: FinalDecision;
  lang: Lang;
}) {
  const zh = lang === "zh";
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <Stat label="Overall rating">
          <span className={`text-2xl font-bold ${RATING_COLOR[decision.overallRating]}`}>
            {decision.overallRating}
          </span>
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

      <div className="grid md:grid-cols-3 gap-4 mb-5">
        {(
          [
            ["Conservative", decision.allocation.conservative],
            ["Balanced", decision.allocation.balanced],
            ["Aggressive", decision.allocation.aggressive],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="border border-line rounded p-3 bg-panel2/50">
            <div className="text-[10px] uppercase tracking-widest text-muted">
              {label} allocation
            </div>
            <div className="num text-xl font-bold mt-1">{v}%</div>
            <div className="text-[11px] text-muted">
              {zh ? "占组合总值" : "of total portfolio"}
            </div>
          </div>
        ))}
      </div>

      {decision.vetoesApplied.length > 0 && (
        <div className="mb-5 border border-red-500/30 bg-red-500/5 rounded p-3">
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

      {/* Scenario ranges — never point estimates; the method is always shown */}
      <div className="grid md:grid-cols-3 gap-3 mb-5">
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
                  {lang === "zh" ? "前提:" : "Requires: "}
                </span>
                {pick(s.drivers, lang)}
              </div>
              <div className="text-[11px] mt-1">
                <span className="text-muted">
                  {lang === "zh" ? "失效:" : "Invalidated by: "}
                </span>
                {pick(s.invalidation, lang)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-5 text-[13px]">
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
