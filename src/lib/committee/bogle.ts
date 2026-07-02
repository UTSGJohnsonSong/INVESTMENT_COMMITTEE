import type { Argument, PersonaOpinion } from "@/lib/types";
import { L, l } from "@/lib/i18n";
import {
  CommitteeInput,
  arg,
  clamp,
  collectCited,
  freshness,
  ids,
  pct,
  stanceFromRating,
  val,
  yoyOf,
} from "./helpers";

const BROAD_INDEX = new Set(["SPY", "VOO", "VTI", "VT", "QQQ", "IVV", "XEQT.TO", "XEQT"]);

export function bogle(input: CommitteeInput): PersonaOpinion {
  const { ctx, asset, isEtf } = input;
  const args: Argument[] = [];
  const risks: Argument[] = [];
  let rating = 50;

  if (isEtf) {
    const isIndexAsset = asset.assetType === "index";
    const broad = BROAD_INDEX.has(asset.ticker.toUpperCase()) || isIndexAsset;
    rating = broad ? 72 : 58;
    args.push(
      arg(
        isIndexAsset
          ? l(
              `${asset.name} is the index itself — not directly tradable. The implementation is a low-cost broad ETF (e.g. SPY/VOO for the S&P). Indexing is exactly my default answer for ordinary investors.`,
              `${asset.name} 是指数本身,不可直接交易——实现方式是对应的低成本宽基 ETF(如标普用 SPY/VOO)。指数化投资正是我给普通投资者的默认答案。`
            )
          : broad
            ? l(
                `${asset.ticker} is a broad-market index vehicle — this IS my default answer for ordinary investors: low cost, diversified, held for the long run.`,
                `${asset.ticker} 是宽基指数工具,本身就是我给普通投资者的默认答案:低成本、分散、长期持有。`
              )
            : l(
                `${asset.ticker} is an ETF — structurally better than concentrated single-stock bets, but confirm whether it is broad-market or thematic. A thematic ETF is still an active bet.`,
                `${asset.ticker} 是 ETF,结构上优于个股集中持仓,但需要确认它是宽基还是主题基金——主题 ETF 依然是主动下注。`
              ),
        ids(ctx, "last_price"),
        true
      )
    );
    risks.push(
      arg(
        l(
          "Expense ratio, tracking error and holdings concentration were NOT verified in this evidence set (needs issuer data) — that is a data gap, not a safety signal.",
          "费率、跟踪误差、成分集中度未在本次证据中核实(需要 issuer 官网数据)——这是数据缺口,不是安全信号。"
        ),
        [],
        true
      )
    );
    return finish(
      input, rating, args, risks,
      l(
        "For broad index funds: buy, automate, hold — stop fiddling. For thematic ETFs: first answer why not the whole market.",
        "对宽基 ETF:直接定投持有,别折腾。对主题 ETF:先回答“为什么不买全市场”。"
      ),
      l(
        "Why not just buy the index? What exactly is your edge — information, analysis, or just emotion?",
        "为什么不直接买指数?你的 edge 到底是什么——信息、分析,还是只是情绪?"
      )
    );
  }

  // Single stock: does the active thesis clear the bar?
  const roe = val(ctx, "roe");
  const revYoy = yoyOf(ctx, "revenue");
  const pe = val(ctx, "pe_trailing");
  const fcf = val(ctx, "free_cash_flow");
  const vol = val(ctx, "realized_vol");

  let edge = 0;
  if (roe !== null && roe > 20) edge += 1;
  if (revYoy !== null && revYoy > 5) edge += 1;
  if (fcf !== null && fcf > 0) edge += 1;
  if (pe !== null && pe < 28) edge += 1;

  rating = clamp(34 + edge * 6, 25, 62);

  const fcfWord = fcf !== null ? (fcf > 0 ? { en: "positive", zh: "为正" } : { en: "negative", zh: "为负" }) : { en: "n/a", zh: "n/a" };
  args.push(
    arg(
      l(
        `The bar for beating the index with single stocks is high. Verifiable edge evidence: ${edge}/4 (ROE ${roe ?? "n/a"}%, revenue ${pct(revYoy)} YoY, FCF ${fcfWord.en}, P/E ${pe ?? "n/a"}).`,
        `个股相对指数的超额收益门槛很高。当前可核实的 edge 证据:${edge}/4 项(ROE ${roe ?? "n/a"}%、营收 ${pct(revYoy)} YoY、FCF ${fcfWord.zh}、P/E ${pe ?? "n/a"})。`
      ),
      ids(ctx, "roe", "revenue", "free_cash_flow", "pe_trailing")
    )
  );
  if (pe !== null && pe > 30)
    args.push(
      arg(
        l(
          `A P/E of ${pe} means you are paying a premium for that edge — a good company bought expensively regresses toward index returns.`,
          `P/E ${pe} 意味着你为这份 edge 付了溢价——买贵了的好公司,长期收益会向指数回归。`
        ),
        ids(ctx, "pe_trailing")
      )
    );
  if (vol !== null)
    risks.push(
      arg(
        l(
          `Annualized volatility of ${vol}% is well above a broad index. Volatility is itself a holding cost — most people cannot sit through it.`,
          `个股年化波动 ${vol}%,高于宽基指数的典型水平;波动本身就是持有成本,大多数人拿不住。`
        ),
        ids(ctx, "realized_vol")
      )
    );
  risks.push(
    arg(
      l(
        "Single-stock concentration: no matter how good the company, it should not replace the core of the portfolio.",
        "单一个股集中度风险:无论公司多好,都不应替代组合的核心仓位。"
      ),
      [],
      true
    ),
    arg(
      l(
        "Taxes and turnover: the friction costs of active trading erode returns over the long run.",
        "税务与换手成本:主动买卖个股的摩擦成本长期侵蚀收益。"
      ),
      [],
      true
    )
  );

  return finish(
    input, rating, args, risks,
    edge >= 3
      ? l(
          "Acceptable as a satellite position, but the core stays in broad index funds; cap the single stock at ~10% of the portfolio.",
          "允许作为 satellite(卫星仓)持有,但核心仓位仍应是宽基指数;个股上限建议不超过组合 10%。"
        )
      : l(
          "Index-first: the evidence does not justify deviating from the index. Get exposure through a broad ETF — the company is in the index anyway.",
          "index-first:当前证据不足以支持偏离指数,建议用宽基 ETF 获得该公司的敞口(它本来就在指数里)。"
        ),
    l(
      "Why not just buy the index? What exactly is your edge — information, analysis, or just emotion?",
      "为什么不直接买指数?你的 edge 到底是什么——信息、分析,还是只是情绪?"
    )
  );
}

function finish(
  input: CommitteeInput,
  rating: number,
  args: Argument[],
  risks: Argument[],
  action: L,
  challenge: L
): PersonaOpinion {
  return {
    persona: "bogle",
    stance: stanceFromRating(rating),
    rating,
    confidence: 70,
    recommendedAction: action,
    summary: args[0]?.text ?? l("", ""),
    arguments: args,
    risks,
    challenge,
    disagreements: [],
    citedEvidenceIds: collectCited([...args, ...risks]),
    dataFreshness: freshness(input),
    usesMockData: false,
  };
}
