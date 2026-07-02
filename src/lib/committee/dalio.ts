import type { PersonaOpinion } from "@/lib/types";
import { l } from "@/lib/i18n";
import {
  CommitteeInput,
  arg,
  clamp,
  collectCited,
  freshness,
  ids,
  stanceFromRating,
  val,
} from "./helpers";

export function dalio(input: CommitteeInput): PersonaOpinion {
  const { ctx } = input;
  const cpi = val(ctx, "macro_CPIAUCSL");
  const dff = val(ctx, "macro_DFF");
  const dgs10 = val(ctx, "macro_DGS10");
  const curve = val(ctx, "macro_T10Y2Y");
  const unrate = val(ctx, "macro_UNRATE");

  const realRate = dff !== null && cpi !== null ? Math.round((dff - cpi) * 100) / 100 : null;

  const inflationRegime =
    cpi === null
      ? { en: "inflation unknown", zh: "通胀未知" }
      : cpi > 3.2
        ? { en: "inflation up", zh: "通胀偏高" }
        : cpi < 2.3
          ? { en: "inflation down", zh: "通胀回落" }
          : { en: "inflation moderate", zh: "通胀温和" };
  const growthRegime =
    unrate === null
      ? { en: "growth unknown", zh: "增长未知" }
      : unrate < 4.3
        ? { en: "growth resilient", zh: "增长有韧性" }
        : unrate > 4.8
          ? { en: "growth weakening", zh: "增长走弱" }
          : { en: "growth mixed", zh: "增长喜忧参半" };

  // Equity tailwind score
  let tail = 0;
  if (cpi !== null) tail += cpi < 3 ? 1 : cpi > 4 ? -2 : 0;
  if (realRate !== null) tail += realRate > 2 ? -1 : realRate < 0.5 ? 1 : 0;
  if (curve !== null) tail += curve < 0 ? -1 : curve > 0.5 ? 1 : 0;
  if (unrate !== null) tail += unrate > 4.8 ? -1 : 0;

  const wind =
    tail >= 2
      ? { en: "macro tailwind", zh: "宏观顺风" }
      : tail <= -2
        ? { en: "macro headwind", zh: "宏观逆风" }
        : { en: "macro neutral", zh: "宏观中性" };
  const rating = clamp(50 + tail * 8, 20, 78);

  const args = [
    arg(
      l(
        `Current regime: ${growthRegime.en} × ${inflationRegime.en}. CPI ${cpi ?? "n/a"}% YoY, unemployment ${unrate ?? "n/a"}%.`,
        `当前 regime:${growthRegime.zh} × ${inflationRegime.zh}。CPI ${cpi ?? "n/a"}% YoY,失业率 ${unrate ?? "n/a"}%。`
      ),
      ids(ctx, "macro_CPIAUCSL", "macro_UNRATE")
    ),
    arg(
      l(
        `Rates: fed funds ${dff ?? "n/a"}%, 10Y ${dgs10 ?? "n/a"}%, real policy rate ≈ ${realRate ?? "n/a"}%${realRate !== null && realRate > 1.5 ? " — monetary conditions remain tight, a persistent gravity on long-duration risk assets" : ""}; curve (10Y−2Y) ${curve ?? "n/a"}%.`,
        `利率环境:联邦基金 ${dff ?? "n/a"}%,10Y ${dgs10 ?? "n/a"}%,实际政策利率约 ${realRate ?? "n/a"}%${realRate !== null && realRate > 1.5 ? "——货币条件仍然偏紧,对久期长的风险资产是持续的重力" : ""};曲线(10Y-2Y)${curve ?? "n/a"}%。`
      ),
      ids(ctx, "macro_DFF", "macro_DGS10", "macro_T10Y2Y")
    ),
    arg(
      l(
        `Conclusion: this asset currently sits in a "${wind.en}". Equities are the asset of the growth-up / inflation-down quadrant; the further the environment drifts from that quadrant, the more the position must be carried by the asset's own alpha rather than environmental beta.`,
        `结论:该资产当前处于「${wind.zh}」。股票是 growth-up / inflation-down 环境的资产;偏离这个象限越远,持有它越需要来自资产本身的 alpha 而不是环境 beta。`
      ),
      ids(ctx, "macro_CPIAUCSL", "macro_DFF"),
      true
    ),
  ];

  const risks = [
    arg(
      l(
        "The regime read uses levels, not rates of change — it will lag at turning points (inflation re-acceleration, sudden labor cracks).",
        "regime 判断用的是水平值,不是变化率——拐点(通胀再加速、就业断裂)出现时,这个判断会滞后。"
      ),
      [],
      true
    ),
    arg(
      l(
        "All-weather view: any single environment call can be wrong, so equities, long bonds, gold and cash should all be on the field — win by weights, not forecasts.",
        "all-weather 视角:任何单一环境判断都可能错,所以股票、长债、黄金、现金要同时在场,靠配比而不是预测赢。"
      ),
      [],
      true
    ),
  ];

  return {
    persona: "dalio",
    stance: stanceFromRating(rating),
    rating,
    confidence: 60,
    recommendedAction:
      tail <= -2
        ? l(
            "Macro headwind: dial down overall risk-asset weight and top up the hedging legs (long bonds / gold / cash).",
            "宏观逆风:压低风险资产整体配比,补足长债/黄金/现金的对冲腿。"
          )
        : l(
            "Macro is not a veto: participate at all-weather weights; no single asset beyond its risk budget.",
            "宏观不构成否决:按 all-weather 配比参与,单一资产不超过风险预算。"
          ),
    summary: args[2].text,
    arguments: args,
    risks,
    challenge: l(
      "Tailwind or headwind? Are you earning the company's money, or the liquidity's money?",
      "宏观环境是顺风还是逆风?你赚的是公司的钱,还是流动性的钱?"
    ),
    disagreements: [],
    citedEvidenceIds: collectCited([...args, ...risks]),
    dataFreshness: freshness(input),
    usesMockData: false,
    veto:
      tail <= -2
        ? {
            triggered: true,
            reason: l(
              `Macro headwind (tail score ${tail}): the inflation/rates/curve mix does not support risk assets`,
              `宏观逆风(tail score ${tail}):通胀/利率/曲线组合不支持风险资产`
            ),
            effect: l(
              "Flag macro headwind; take the bottom of any allocation band",
              "标记 macro headwind,建议配比取区间下限"
            ),
          }
        : undefined,
  };
}
