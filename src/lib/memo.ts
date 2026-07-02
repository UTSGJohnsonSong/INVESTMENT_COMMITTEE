// Decision memo generator. Produces a plain-text professional memo that can
// be copied out, in the requested language. Every section is assembled from
// committee output; citations are listed source-level first (P0 → P3).
import type { AnalysisResult } from "@/lib/types";
import { Lang, pick } from "@/lib/i18n";
import { PERSONAS } from "@/lib/committee/meta";

export function generateMemo(r: AnalysisResult, lang: Lang): string {
  const d = r.decision;
  const by = new Map(r.opinions.map((o) => [o.persona, o]));
  const buffett = by.get("buffett");
  const marks = by.get("marks");
  const bulls = r.opinions.filter((o) => o.stance === "bullish");
  const bears = r.opinions.filter((o) => o.stance === "bearish");
  const t = (en: string, zh: string) => (lang === "zh" ? zh : en);

  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push(`INVESTMENT DECISION MEMO — ${r.asset.ticker} (${r.asset.name})`);
  push(`Generated: ${r.generatedAt}  |  Investment Committee v0.1`);
  push(`${"=".repeat(72)}`);
  push();
  push(t(`ONE-LINE THESIS`, `一句话结论 ONE-LINE THESIS`));
  push(
    `${r.asset.ticker}: ${d.overallRating} · ${d.suggestedRole} · ${t("balanced allocation", "平衡型仓位")} ${d.allocation.balanced}% · ${t("horizon", "期限")} ${pick(d.timeHorizon, lang)}.`
  );
  push();
  push(t(`COMMITTEE FINAL RATING`, `委员会最终评级 COMMITTEE FINAL RATING`));
  push(
    `Rating: ${d.overallRating}  |  Confidence: ${d.confidence}/100  |  Evidence quality: ${d.evidenceQuality}  |  Citation coverage: ${d.citationCoverage}%`
  );
  push(
    `${t("Committee votes", "委员投票")}: ${r.opinions
      .map((o) => `${PERSONAS[o.persona].name} ${o.rating}(${o.stance})`)
      .join(", ")}`
  );
  if (d.vetoesApplied.length > 0) {
    push(
      `${t("Vetoes", "否决/约束")}: ${d.vetoesApplied
        .map((v) => `${PERSONAS[v.persona].name} — ${pick(v.reason, lang)} → ${pick(v.effect, lang)}`)
        .join("; ")}`
    );
  }
  push();
  push(t(`WHY NOW`, `为什么是现在 WHY NOW`));
  for (const o of bulls.slice(0, 3)) {
    push(
      `- [${PERSONAS[o.persona].name}] ${pick(o.arguments[0]?.text ?? o.summary, lang)} ${cite(o.arguments[0]?.evidenceIds, lang)}`
    );
  }
  if (bulls.length === 0)
    push(t(`- No committee member is clearly bullish.`, `- 委员会中没有明确看多者。`));
  push();
  push(t(`WHY NOT`, `反方观点 WHY NOT`));
  for (const o of bears.slice(0, 3)) {
    push(
      `- [${PERSONAS[o.persona].name}] ${pick(o.arguments[0]?.text ?? o.summary, lang)} ${cite(o.arguments[0]?.evidenceIds, lang)}`
    );
  }
  if (marks && !bears.includes(marks))
    push(`- [Howard Marks] ${pick(marks.risks[0]?.text, lang)}`);
  if (bears.length === 0 && !marks)
    push(t(`- No clear objection (beware of the consensus itself).`, `- 无明确反对意见(警惕一致性本身)。`));
  push();
  push(t(`EVIDENCE SUMMARY (key facts, all sourced)`, `证据摘要 EVIDENCE SUMMARY(关键事实,全部有来源)`));
  const keyEvidence = r.evidence.filter(
    (e) =>
      e.tags.includes("financials") ||
      e.tags.includes("valuation") ||
      (e.tags.includes("quant") && e.metricName?.startsWith("momentum"))
  );
  for (const e of keyEvidence.slice(0, 10)) {
    push(`- ${pick(e.statement, lang)} [${e.id}, ${e.citation.sourceLevel}]`);
  }
  push();
  push(t(`RISK SUMMARY`, `风险摘要 RISK SUMMARY`));
  for (const kr of d.keyRisks) push(`- ${pick(kr.text, lang)}`);
  push(`- ${t("Expected downside", "预期下行")}: ${pick(d.expectedDownside, lang)}`);
  push();
  push(t(`POSITION SIZING`, `仓位建议 POSITION SIZING`));
  push(
    `Conservative ${d.allocation.conservative}%  |  Balanced ${d.allocation.balanced}%  |  Aggressive ${d.allocation.aggressive}% (${t("of total portfolio", "占组合总值")})`
  );
  push(`${t("Role", "角色")}: ${d.suggestedRole}. ${pick(by.get("taleb")?.recommendedAction, lang)}`);
  push();
  push(t(`ENTRY PLAN`, `入场计划 ENTRY PLAN`));
  push(
    d.overallRating === "Buy" || d.overallRating === "Strong Buy"
      ? t(
          `- Scale in over 3 tranches; first tranche no more than 40% of the target size — keep ammunition for a further 20% drop.`,
          `- 分批建仓(3 批),首批不超过目标仓位的 40%;留出「买完继续跌 20%」的加仓弹药。`
        )
      : t(
          `- Current rating is ${d.overallRating}: do not initiate; wait for one of the What-would-change-our-mind conditions.`,
          `- 当前评级为 ${d.overallRating}:不主动建仓,等待 What-would-change-our-mind 条件之一成立。`
        )
  );
  push(`- ${pick(by.get("soros")?.recommendedAction, lang)}`);
  push();
  push(t(`EXIT PLAN / KILL CRITERIA`, `退出计划 EXIT PLAN / KILL CRITERIA`));
  for (const k of d.killCriteria) push(`- ${pick(k, lang)}`);
  push();
  push(t(`MONITORING CHECKLIST`, `监控清单 MONITORING CHECKLIST`));
  for (const c of d.keyCatalysts) push(`- ${pick(c.text, lang)}`);
  for (const c of d.changeOfMind.slice(0, 2)) push(`- ${pick(c, lang)}`);
  push();
  if (buffett) {
    push(t(`LONG-TERM VIEW (Business Quality)`, `长期视角 LONG-TERM VIEW(商业质量)`));
    push(`- ${pick(buffett.recommendedAction, lang)}`);
    push();
  }
  push(t(`FULL CITATIONS (${r.evidence.length}, P0 first)`, `全部引用 FULL CITATIONS(共 ${r.evidence.length} 条,P0 优先)`));
  const sorted = [...r.evidence].sort((a, b) =>
    a.citation.sourceLevel.localeCompare(b.citation.sourceLevel)
  );
  for (const e of sorted) {
    const c = e.citation;
    push(
      `[${e.id}] (${c.sourceLevel}) ${c.sourceName}${c.formType ? ` ${c.formType}` : ""}${c.accessionNumber ? ` accn ${c.accessionNumber}` : ""}${c.seriesId ? ` series ${c.seriesId}` : ""} | published ${c.publishedAt} | retrieved ${c.retrievedAt} | ${c.sourceUrl}`
    );
  }
  push();
  push(`${"-".repeat(72)}`);
  for (const dis of d.disclaimers) push(pick(dis, lang));

  return lines.join("\n");
}

function cite(ids: string[] | undefined, lang: Lang): string {
  return ids && ids.length > 0
    ? `[${ids.join(",")}]`
    : lang === "zh"
      ? "[推测]"
      : "[inference]";
}
