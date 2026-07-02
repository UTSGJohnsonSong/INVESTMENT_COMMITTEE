// Final deliberation. Aggregates persona ratings, applies the veto rules from
// the product spec, and emits the structured FinalDecision panel. No new
// facts may be introduced here — only combinations of committee output.
import type {
  Evidence,
  FinalDecision,
  OverallRating,
  PersonaOpinion,
} from "@/lib/types";
import { l } from "@/lib/i18n";
import { PERSONAS } from "./meta";
import { clamp } from "./helpers";

// Direction vs constraint separation. Bogle, Markowitz and Taleb are
// constraint members: their ratings are capped by design (Taleb ≤60,
// Bogle ≤62 for stocks), so averaging them into the direction score would
// weld a ceiling onto it and make Strong Buy mathematically unreachable.
// They keep full control of what they actually govern: vetoes, position
// caps, allocation bands and confidence penalties.
const DIRECTION_WEIGHTS_STOCK: Record<string, number> = {
  buffett: 1.3,
  marks: 1.1,
  simons: 1.0,
  dalio: 0.9,
  soros: 0.7,
};
// For ETFs/indices Buffett abstains; Bogle is the quality judge instead.
const DIRECTION_WEIGHTS_ETF: Record<string, number> = {
  bogle: 1.3,
  marks: 1.1,
  simons: 1.0,
  dalio: 0.9,
  soros: 0.7,
};

function ratingLabel(score: number, capBelowStrongBuy: boolean): OverallRating {
  if (score >= 72 && !capBelowStrongBuy) return "Strong Buy";
  if (score >= 60) return "Buy";
  if (score >= 50) return "Watch";
  if (score >= 42) return "Hold";
  if (score >= 34) return "Reduce";
  return "Avoid";
}

// Position cap / band are parsed from the persona's Chinese action text,
// which preserves the stable "上限 X%" / "区间 lo%–hi%" phrasing.
function parseCap(text: string): number | null {
  const m = text.match(/上限 ?(\d+(?:\.\d+)?)%/);
  return m ? parseFloat(m[1]) : null;
}

function parseBand(text: string): [number, number] | null {
  const m = text.match(/(\d+(?:\.\d+)?)%[–-](\d+(?:\.\d+)?)%/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

export function synthesize(
  opinions: PersonaOpinion[],
  evidence: Evidence[],
  isEtf: boolean
): FinalDecision {
  const by = new Map(opinions.map((o) => [o.persona, o]));
  const get = (p: string) => by.get(p as PersonaOpinion["persona"]);

  const weights = isEtf ? DIRECTION_WEIGHTS_ETF : DIRECTION_WEIGHTS_STOCK;
  let wsum = 0;
  let wtotal = 0;
  for (const o of opinions) {
    const w = weights[o.persona];
    if (w === undefined) continue; // constraint members don't vote on direction
    wsum += o.rating * w;
    wtotal += w;
  }
  let score = wsum / wtotal;

  const vetoes: FinalDecision["vetoesApplied"] = [];
  for (const o of opinions) {
    if (o.veto?.triggered) {
      vetoes.push({ persona: o.persona, reason: o.veto.reason, effect: o.veto.effect });
    }
  }

  const buffettOp = get("buffett");
  const simonsOp = get("simons");
  const bogleOp = get("bogle");
  const talebOp = get("taleb");
  const markowitzOp = get("markowitz");

  // Veto rules from the spec.
  const talebVeto = !!talebOp?.veto?.triggered;
  const buffettWeak = !isEtf && buffettOp !== undefined && buffettOp.rating < 45;
  const simonsUnsupported = simonsOp !== undefined && simonsOp.rating < 40;
  const bogleNoEdge = !isEtf && bogleOp !== undefined && bogleOp.rating < 45;

  if (simonsUnsupported) {
    score -= 5;
    vetoes.push({
      persona: "simons",
      reason: l("Quant signals do not support the narrative (rating < 40)", "量化信号不支持叙事(rating < 40)"),
      effect: l("Overall confidence reduced by 15", "整体 confidence 下调 15"),
    });
  }
  if (bogleNoEdge)
    vetoes.push({
      persona: "bogle",
      reason: l("Insufficient evidence of an active edge", "主动投资 edge 证据不足"),
      effect: l("Default recommendation: replace with broad index ETF exposure", "默认建议用宽基 ETF 替代该个股敞口"),
    });
  if (buffettWeak)
    vetoes.push({
      persona: "buffett",
      reason: l("Business quality or margin of safety fails", "商业质量或安全边际不过关"),
      effect: l("Long-term Strong Buy is prohibited", "禁止给出长期 Strong Buy"),
    });

  // Round once so the displayed score and the rating label can never disagree.
  score = Math.round(score);

  // Never award the top rating while others are being greedy.
  const marksGreedVeto = !!get("marks")?.veto?.triggered;
  const capBelowStrongBuy = talebVeto || buffettWeak || marksGreedVeto;
  const overallRating = ratingLabel(score, capBelowStrongBuy);

  // Confidence: average persona confidence, penalized by vetoes and mock use.
  let confidence =
    opinions.reduce((a, o) => a + o.confidence, 0) / opinions.length;
  confidence -= vetoes.length * 6;
  if (simonsUnsupported) confidence -= 15;
  confidence = Math.round(clamp(confidence, 10, 90));

  // Allocation: rating-scaled, then capped by Taleb and the Markowitz band.
  let balanced = clamp((score - 45) / 4, 0, 8);
  const talebCap = talebOp ? parseCap(talebOp.recommendedAction.zh) : null;
  const band = markowitzOp ? parseBand(markowitzOp.recommendedAction.zh) : null;
  if (band) balanced = Math.min(balanced, band[1]);
  if (talebCap !== null) balanced = Math.min(balanced, talebCap);
  const marksVeto = get("marks")?.veto?.triggered;
  if (marksVeto) balanced *= 0.7;
  balanced = Math.round(balanced * 10) / 10;

  const allocation = {
    conservative: Math.round(balanced * 0.5 * 10) / 10,
    balanced,
    aggressive: Math.round(Math.min(balanced * 1.6, talebCap ?? 99) * 10) / 10,
  };

  const suggestedRole: FinalDecision["suggestedRole"] =
    overallRating === "Avoid" || overallRating === "Reduce"
      ? "Avoid"
      : isEtf && score >= 58
        ? "Core holding"
        : score >= 58 && (buffettOp?.rating ?? 0) >= 55
          ? "Satellite holding"
          : (get("soros")?.rating ?? 0) >= 60
            ? "Tactical trade"
            : "Satellite holding";

  const timeHorizon =
    suggestedRole === "Core holding"
      ? l("3–5+ years", "3–5 年+")
      : suggestedRole === "Tactical trade"
        ? l("1–3 months, stop-loss driven", "1–3 个月,止损驱动")
        : l("6–12 months+, reviewed each quarterly report", "6–12 个月起,按季度财报复核");

  const p0Count = evidence.filter((e) => e.citation.sourceLevel === "P0").length;
  const p0Share = evidence.length ? p0Count / evidence.length : 0;
  const evidenceQuality = p0Share >= 0.55 ? "A" : p0Share >= 0.35 ? "B" : p0Share >= 0.15 ? "C" : "D";

  const allArgs = opinions.flatMap((o) => [...o.arguments, ...o.risks]);
  const cited = allArgs.filter((a) => a.evidenceIds.length > 0).length;
  const citationCoverage = allArgs.length
    ? Math.round((cited / allArgs.length) * 100)
    : 0;

  const keyRisks = [
    ...(talebOp ? [talebOp.risks[0]] : []),
    ...(get("marks") ? [get("marks")!.risks[0]] : []),
    ...(buffettOp && !isEtf ? [buffettOp.risks[buffettOp.risks.length - 1]] : []),
  ].filter(Boolean);

  const momentum = evidence.find((e) => e.metricName === "momentum_12m");
  const filing = evidence.find((e) => e.metricName === "latest_filing");
  const keyCatalysts = [
    {
      text: l(
        "Next quarterly report (10-Q/10-K): whether the revenue and FCF trends hold is the referee of the committee's main disagreement.",
        "下一份季报 (10-Q/10-K):营收与 FCF 趋势是否延续,是委员会分歧的主要裁判。"
      ),
      evidenceIds: filing ? [filing.id] : [],
      isInference: !filing,
    },
    {
      text: l(
        "CPI and the FOMC path: falling real rates would directly flip Dalio's tailwind/headwind call.",
        "CPI 与 FOMC 路径:实际利率下行会直接改变 Dalio 委员的顺风/逆风判断。"
      ),
      evidenceIds: evidence.filter((e) => e.citation.seriesId === "CPIAUCSL" || e.citation.seriesId === "DFF").map((e) => e.id),
      isInference: false,
    },
    {
      text: l(
        "Trend state: 200DMA and momentum flips are the signal-invalidation lines for Simons and Soros.",
        "趋势状态:200DMA 与动量翻转是 Simons/Soros 两位委员的信号失效线。"
      ),
      evidenceIds: momentum ? [momentum.id] : [],
      isInference: !momentum,
    },
  ];

  const killCriteria = [
    l(
      "Free cash flow turns negative, or revenue YoY is negative two consecutive quarters (business-quality thesis broken)",
      "自由现金流转负,或营收 YoY 连续两个季度为负(推翻商业质量论点)"
    ),
    l(
      "Price below the 200DMA with 3-month momentum negative (trend leg invalid; tactical positions exit unconditionally)",
      "跌破 200DMA 且 3 个月动量转负(趋势腿失效,战术仓无条件退出)"
    ),
    l(
      "High-yield OAS (BAMLH0A0HYM2) spikes through 5% (credit stress; de-risk systematically)",
      "高收益债利差 (BAMLH0A0HYM2) 快速突破 5%(信用环境恶化,系统性降风险)"
    ),
    l(
      "Any material accounting/regulatory 8-K event: cut first, investigate after",
      "任何会计/监管重大事件 (8-K):先减仓,后研究"
    ),
  ];

  const changeOfMind = [
    l(
      "A valuation reset that restores a margin of safety (P/E well below today) reverses Buffett's valuation penalty",
      "估值回撤给出安全边际(P/E 显著低于当前),Buffett 委员的估值扣分会反转"
    ),
    l(
      "The next quarter confirms accelerating revenue/FCF — quant and fundamental signals align",
      "下一季财报证实营收/FCF 加速,量化与基本面信号共振"
    ),
    l(
      "Real policy rates turn easy — macro headwind becomes tailwind",
      "实际政策利率转向宽松,宏观逆风变顺风"
    ),
    l(
      "Real portfolio data (correlation/risk contribution) confirms or overrides the Markowitz band",
      "接入真实组合数据后,相关性/风险贡献计算否定或强化 Markowitz 区间"
    ),
  ];

  const expectedUpside =
    momentum && typeof momentum.metricValue === "number" && momentum.metricValue > 0
      ? l(
          `Trend-continuation case: extension of the ${momentum.metricValue}% path of the last 12 months; medium term, earnings growth with a held multiple. No point estimate — we refuse false precision.`,
          `趋势延续情形:过去 12 个月 ${momentum.metricValue}% 的路径若延续;中期看盈利增长 + 估值维持。不给点位——拒绝伪精确。`
        )
      : l(
          "Upside depends on fundamentals delivering; current evidence cannot quantify it and we refuse false precision.",
          "上行依赖基本面兑现;当前证据不足以量化,拒绝伪精确。"
        );
  const mdd = evidence.find((e) => e.metricName === "max_drawdown_1y");
  const expectedDownside =
    mdd && typeof mdd.metricValue === "number"
      ? l(
          `Reference case: a ${mdd.metricValue}% drawdown actually occurred within the past year; deeper under multiple compression. Size the position for that.`,
          `参考情形:过去一年实际发生过 ${mdd.metricValue}% 回撤;估值收缩情境下更深。按此设定仓位承受力。`
        )
      : l(
          "No historical anchor for downside; stress-test at -30% to -50% by default.",
          "下行幅度无历史锚点,默认按 -30% 至 -50% 压力测试。"
        );

  // ---- Scenario ranges (never point estimates; method always shown) ----
  const volE = evidence.find((e) => e.metricName === "realized_vol");
  const vol = typeof volE?.metricValue === "number" ? volE.metricValue : 30;
  const mddV = mdd && typeof mdd.metricValue === "number" ? mdd.metricValue : -vol;
  const r5 = (x: number) => Math.round(x / 5) * 5;
  const sIds = [volE?.id, mdd?.id, momentum?.id].filter((x): x is string => !!x);
  const scenarios: FinalDecision["scenarios"] = [
    {
      name: l("Bull case", "乐观情形"),
      range: `+${r5(vol * 0.5)}% to +${r5(vol * 1.0)}%`,
      method: l(
        `0.5–1.0× realized annual volatility (${vol}%), i.e. a favorable 1σ-type year`,
        `0.5–1.0 倍已实现年化波动率(${vol}%),即顺风的 1σ 级年份`
      ),
      drivers: l(
        "Fundamental trend confirmed by the next two quarterly reports; macro real rates ease; trend stays above the 200DMA.",
        "未来两个季报确认基本面趋势;宏观实际利率转松;价格维持在 200DMA 上方。"
      ),
      invalidation: l(
        "Revenue/FCF deceleration or a macro tightening surprise.",
        "营收/FCF 减速,或宏观意外收紧。"
      ),
      evidenceIds: sIds,
    },
    {
      name: l("Base case", "基准情形"),
      range: `${r5(-vol * 0.3)}% to +${r5(vol * 0.5)}%`,
      method: l(
        `-0.3 to +0.5× realized volatility — earnings do the work, the multiple does not move`,
        `-0.3 至 +0.5 倍已实现波动率——回报来自盈利本身,估值倍数不变`
      ),
      drivers: l(
        "Business performs in line with current filings; macro regime unchanged.",
        "业务表现与当前 filing 一致;宏观 regime 不变。"
      ),
      invalidation: l(
        "Any kill criterion triggering moves us to the bear case.",
        "任何 kill criteria 触发即转入悲观情形。"
      ),
      evidenceIds: sIds,
    },
    {
      name: l("Bear case", "悲观情形"),
      range: `${r5(mddV * 0.6)}% to ${r5(Math.min(mddV * 1.3, -10))}%`,
      method: l(
        `0.6–1.3× the actual 1-year max drawdown (${mddV}%) — history as the floor estimate, not the ceiling`,
        `0.6–1.3 倍实际一年最大回撤(${mddV}%)——历史值是下限估计,不是上限`
      ),
      drivers: l(
        "Multiple compression and earnings downgrades arriving together; credit spreads widening past 5%.",
        "估值收缩与盈利下修同时发生;信用利差突破 5%。"
      ),
      invalidation: l(
        "A valuation reset that restores margin of safety converts this into the accumulation case.",
        "估值回落恢复安全边际后,此情形反而转为加仓依据。"
      ),
      evidenceIds: sIds,
    },
  ];

  return {
    overallRating,
    score: Math.round(score),
    confidence,
    suggestedRole,
    allocation,
    timeHorizon,
    scenarios,
    expectedUpside,
    expectedDownside,
    keyRisks,
    keyCatalysts,
    killCriteria,
    changeOfMind,
    vetoesApplied: vetoes,
    evidenceQuality,
    citationCoverage,
    disclaimers: [
      l(
        "This is not financial advice. This tool is for research and decision support only.",
        "这不是财务建议。本工具仅用于研究与决策辅助。"
      ),
      l(
        "Market prices are delayed; financials reflect the most recent SEC filing and may lag the current quarter.",
        "市场价格为延迟数据;财务数据以最近一次 SEC filing 为准,可能滞后于当前季度。"
      ),
      l(
        "Anything labeled [MOCK] is a placeholder, not a real computation.",
        "标记为 [MOCK] 的内容是占位符,不是真实计算结果。"
      ),
    ],
  };
}

export function buildDisagreements(opinions: PersonaOpinion[]): void {
  for (const o of opinions) {
    for (const other of opinions) {
      if (other.persona === o.persona) continue;
      const gap = o.rating - other.rating;
      if (Math.abs(gap) >= 22) {
        const name = PERSONAS[other.persona].name;
        o.disagreements.push({
          with: other.persona,
          text:
            gap > 0
              ? l(
                  `${name} is ${Math.abs(Math.round(gap))} points more bearish than I am — we read the same evidence; the split is framework: his methodology penalizes exactly what I value.`,
                  `${name} 比我悲观 ${Math.abs(Math.round(gap))} 分——我们读的是同一组证据,分歧在于框架:他的方法论惩罚了我看重的因素。`
                )
              : l(
                  `${name} is ${Math.abs(Math.round(gap))} points more bullish than I am — let him answer my cross-examination: ${o.challenge.en}`,
                  `${name} 比我乐观 ${Math.abs(Math.round(gap))} 分——请他回答我的质询:${o.challenge.zh}`
                ),
        });
      }
    }
    // keep the two largest
    o.disagreements = o.disagreements.slice(0, 2);
  }
}
