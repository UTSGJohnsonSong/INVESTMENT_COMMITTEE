import type { Argument, PersonaOpinion } from "@/lib/types";
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
  const { ctx, isEtf, portfolioContext: pc } = input;
  const vol = val(ctx, "realized_vol");
  const mdd = val(ctx, "max_drawdown_1y");

  const haveRealCorr = !!pc && pc.avgAbsCorrelation !== null;
  // Real correlation to actual holdings when supplied; otherwise fall back
  // to the labeled placeholder assumption used against a generic portfolio.
  const corr = haveRealCorr ? pc!.avgAbsCorrelation! : isEtf ? 0.95 : 0.8;

  // Position band: scale a 5% baseline by inverse volatility vs. a 16% market,
  // then compress further the more this asset overlaps what's already held.
  let bandLo = 1;
  let bandHi = 5;
  if (vol !== null) {
    const scaled = (16 / vol) * 5;
    bandLo = clamp(Math.round(scaled * 0.4), 1, 8);
    bandHi = clamp(Math.round(scaled), 2, 12);
  }
  if (haveRealCorr && corr > 0.7) {
    bandHi = clamp(Math.round(bandHi * (1 - (corr - 0.7))), 1, bandHi);
    bandLo = Math.min(bandLo, bandHi);
  }

  const riskContribution =
    vol !== null ? Math.round(((bandHi / 100) * vol * corr) * 100) / 100 : null;

  const overlapPenalty = haveRealCorr && corr > 0.75 ? -10 : haveRealCorr && corr < 0.4 ? 6 : 0;
  const rating = clamp(
    50 +
      (vol !== null ? (vol < 25 ? 8 : vol > 45 ? -12 : 0) : 0) +
      (mdd !== null && mdd < -35 ? -8 : 0) +
      overlapPenalty,
    25,
    68
  );

  const args: Argument[] = [
    arg(
      l(
        `An asset in isolation means nothing — what matters is its marginal contribution to the portfolio. Annualized volatility ${vol ?? "n/a"}%, max drawdown over the past year ${mdd ?? "n/a"}%.`,
        `单看这个资产没有意义,要看它对组合的边际贡献。年化波动 ${vol ?? "n/a"}%,过去一年最大回撤 ${mdd ?? "n/a"}%。`
      ),
      ids(ctx, "realized_vol", "max_drawdown_1y")
    ),
  ];

  if (haveRealCorr && pc) {
    const computed = pc.correlations.filter((c) => c.correlation !== null);
    const uncomputable = pc.correlations.filter((c) => c.correlation === null);
    const corrList = computed
      .map((c) => `${c.ticker} ${c.correlation!.toFixed(2)}`)
      .join(", ");
    const corrIds = computed.flatMap((c) => ids(ctx, `corr_${c.ticker}`));
    args.push(
      arg(
        l(
          `Real correlation to your actual holdings (daily log returns, aligned by trading day): ${corrList}. Average |correlation| ${corr.toFixed(2)}.${
            corr > 0.7
              ? " At this level the marginal diversification value is low — this is mostly a bigger serving of beta you already hold, not a new risk factor."
              : corr < 0.4
                ? " This is genuinely uncorrelated to what you already hold — real diversification, not just a different ticker."
                : " Moderate overlap — some diversification benefit, but don't overstate it."
          }`,
          `与你实际持仓的真实相关性(按交易日对齐的日收益):${corrList}。平均 |相关性| ${corr.toFixed(2)}。${
            corr > 0.7
              ? "在这个水平上,边际分散价值很低——这大概率只是加了一份你已经持有的 beta,不是新的风险来源。"
              : corr < 0.4
                ? "这与你现有持仓确实不相关——是真正的分散,不只是换了个代码。"
                : "中等重叠——有一定分散价值,但不要夸大。"
          }`
        ),
        corrIds
      )
    );
    if (uncomputable.length > 0)
      args.push(
        arg(
          l(
            `${uncomputable.map((c) => c.ticker).join(", ")}: insufficient overlapping trading history to compute a reliable correlation (need ≥30 aligned days) — treat as unverified, not as diversifying.`,
            `${uncomputable.map((c) => c.ticker).join("、")}:重叠交易日不足以计算可靠相关性(需要 ≥30 天)——按未验证处理,不要当作分散。`
          ),
          [],
          true
        )
      );
  } else {
    args.push(
      arg(
        l(
          `[MOCK assumption] No real holdings were supplied for this analysis, so correlation to your actual portfolio is estimated at ${corr} against a generic reference portfolio — not computed from your real return series. Add tickers to your basket to replace this with a real number.`,
          `[MOCK 假设] 本次分析未提供真实持仓,相关性按通用参考组合估算为 ${corr}——并非基于你的真实收益序列计算。把持仓加入购物篮即可替换为真实数字。`
        ),
        [],
        true
      )
    );
  }

  args.push(
    arg(
      l(
        `Suggested position band: ${bandLo}%–${bandHi}%${haveRealCorr ? " (compressed for measured overlap with your holdings)" : " (volatility-scaled against a generic reference portfolio)"}. At the top of the band, its risk contribution is roughly ${riskContribution ?? "n/a"} vol points.`,
        `建议仓位区间:${bandLo}%–${bandHi}%${haveRealCorr ? "(已按与你持仓的实测重叠度压缩)" : "(相对通用参考组合按波动率缩放)"};按上限计算,对组合的风险贡献约 ${riskContribution ?? "n/a"} 个波动点。`
      ),
      ids(ctx, "realized_vol"),
      !haveRealCorr
    )
  );

  const risks: Argument[] = [
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
  ];
  if (!haveRealCorr)
    risks.push(
      arg(
        l(
          "[MOCK] Efficient frontier and the correlation matrix are not yet wired to real multi-asset return data — the current band is a volatility-scaled approximation, not an optimizer output.",
          "[MOCK] 有效前沿与相关性矩阵尚未接入真实多资产收益数据——当前区间是波动率缩放的近似,不是优化解。"
        ),
        [],
        true
      )
    );
  else
    risks.push(
      arg(
        l(
          "This is still a 1-year pairwise correlation, not a full covariance-matrix optimization — regime shifts (rate cycles, sector rotations) can move it, and correlations spike toward 1 precisely in the crashes that matter most.",
          "这仍是一年期的两两相关性,不是完整协方差矩阵优化——利率周期、板块轮动等 regime 变化会改变它,而且相关性恰恰会在最重要的暴跌中集体飙向 1。"
        ),
        [],
        true
      )
    );

  const maxCorrText = pc?.maxCorrelation
    ? l(
        `Does adding this asset lower portfolio volatility — or did you just buy another serving of ${pc.maxCorrelation.ticker} (correlation ${pc.maxCorrelation.correlation.toFixed(2)})?`,
        `加入这个资产后,组合的波动下降了吗?还是只是又买了一份 ${pc.maxCorrelation.ticker}(相关性 ${pc.maxCorrelation.correlation.toFixed(2)})?`
      )
    : l(
        "Does adding this asset lower portfolio volatility — or did you just buy another serving of the same beta?",
        "加入这个资产后,组合的波动下降了吗?还是只是又加了一份同样的 beta?"
      );

  return {
    persona: "markowitz",
    stance: stanceFromRating(rating),
    rating,
    confidence: haveRealCorr ? 68 : 55,
    recommendedAction: l(
      `Suggested position band ${bandLo}%–${bandHi}%${haveRealCorr ? ", already adjusted for measured overlap with your holdings" : " (volatility-scaled)"}; take the bottom of the band if you already hold highly correlated positions.`,
      `建议仓位区间 ${bandLo}%–${bandHi}%${haveRealCorr ? "(已按与持仓的实测重叠度调整)" : "(基于波动率缩放)"};若已有同类高相关持仓,取区间下限。`
    ),
    summary: haveRealCorr ? args[1].text : args[0].text,
    arguments: args,
    risks,
    challenge: maxCorrText,
    disagreements: [],
    citedEvidenceIds: collectCited([...args, ...risks]),
    dataFreshness: freshness(input),
    usesMockData: !haveRealCorr,
  };
}
