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

// Reference portfolio when the user has no positions loaded:
// global equity ETF 55 / US treasuries 25 / cash 10 / gold 10.

export function markowitz(input: CommitteeInput): PersonaOpinion {
  const { ctx, isEtf } = input;
  const vol = val(ctx, "realized_vol");
  const mdd = val(ctx, "max_drawdown_1y");

  // Correlation to global equities is NOT computed from data yet — this is a
  // placeholder assumption, and it is labeled as such everywhere it appears.
  const assumedCorr = isEtf ? 0.95 : 0.8;

  // Position band: scale a 5% baseline by inverse volatility vs. a 16% market.
  let bandLo = 1;
  let bandHi = 5;
  if (vol !== null) {
    const scaled = (16 / vol) * 5;
    bandLo = clamp(Math.round(scaled * 0.4), 1, 8);
    bandHi = clamp(Math.round(scaled), 2, 12);
  }

  const riskContribution =
    vol !== null
      ? Math.round(((bandHi / 100) * vol * assumedCorr) * 100) / 100
      : null;

  const rating = clamp(
    50 + (vol !== null ? (vol < 25 ? 8 : vol > 45 ? -12 : 0) : 0) + (mdd !== null && mdd < -35 ? -8 : 0),
    25,
    68
  );

  const args = [
    arg(
      l(
        `An asset in isolation means nothing — what matters is its marginal contribution to the portfolio. Annualized volatility ${vol ?? "n/a"}%, max drawdown over the past year ${mdd ?? "n/a"}%.`,
        `单看这个资产没有意义,要看它对组合的边际贡献。年化波动 ${vol ?? "n/a"}%,过去一年最大回撤 ${mdd ?? "n/a"}%。`
      ),
      ids(ctx, "realized_vol", "max_drawdown_1y")
    ),
    arg(
      l(
        `[MOCK assumption] Correlation to global equities is estimated at ${assumedCorr} (not computed from real return series; will be replaced once portfolio data is wired in). High correlation means it mostly amplifies beta — limited diversification benefit.`,
        `[MOCK 假设] 与全球股票的相关性按 ${assumedCorr} 估算(未用真实收益序列计算,接入组合数据后替换)。高相关意味着它主要放大 beta,分散化收益有限。`
      ),
      [],
      true
    ),
    arg(
      l(
        `Against the default reference portfolio (global equity ETF 55% + US treasuries 25% + cash 10% + gold 10%), suggested position band: ${bandLo}%–${bandHi}%. At the top of the band, its risk contribution is roughly ${riskContribution ?? "n/a"} vol points.`,
        `在默认参考组合(全球股票 ETF 55% + 美债 25% + 现金 10% + 黄金 10%)下,建议仓位区间 ${bandLo}%–${bandHi}%;按上限计算,对组合的风险贡献约 ${riskContribution ?? "n/a"} 个波动点。`
      ),
      ids(ctx, "realized_vol"),
      true
    ),
  ];

  const risks = [
    arg(
      vol !== null && vol > 40
        ? l(
            `${vol}% volatility makes this a high-vol asset: at equal weight, it consumes more than twice the risk budget of a low-vol asset.`,
            `波动 ${vol}% 属于高波动资产:同样的仓位,它吃掉的组合风险预算是低波动资产的两倍以上。`
          )
        : l(
            "Position discipline: if any single asset contributes more than 20% of portfolio risk, it must be trimmed — regardless of the bull/bear view.",
            "仓位纪律:任何单一资产的风险贡献超过组合的 20%,就必须减仓,与看多看空无关。"
          ),
      ids(ctx, "realized_vol"),
      vol === null
    ),
    arg(
      l(
        "[MOCK] Efficient frontier and the correlation matrix are not yet wired to real multi-asset return data — the current band is a volatility-scaled approximation, not an optimizer output.",
        "[MOCK] 有效前沿与相关性矩阵尚未接入真实多资产收益数据——当前区间是波动率缩放的近似,不是优化解。"
      ),
      [],
      true
    ),
  ];

  return {
    persona: "markowitz",
    stance: stanceFromRating(rating),
    rating,
    confidence: 55,
    recommendedAction: l(
      `Suggested position band ${bandLo}%–${bandHi}% (volatility-scaled); take the bottom of the band if you already hold highly correlated positions.`,
      `建议仓位区间 ${bandLo}%–${bandHi}%(基于波动率缩放);若已有同类高相关持仓,取区间下限。`
    ),
    summary: args[0].text,
    arguments: args,
    risks,
    challenge: l(
      "Does adding this asset lower portfolio volatility — or did you just buy another serving of the same beta?",
      "加入这个资产后,组合的波动下降了吗?还是只是又加了一份同样的 beta?"
    ),
    disagreements: [],
    citedEvidenceIds: collectCited([...args, ...risks]),
    dataFreshness: freshness(input),
    usesMockData: true,
  };
}
