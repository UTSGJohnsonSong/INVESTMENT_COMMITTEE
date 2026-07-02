// Basket review: the committee audits a user-assembled basket of stocks/ETFs
// as a PORTFOLIO, not as a list of isolated picks. Each name runs the full
// pipeline; allocation is then built basket-wide under the standing
// constraints (Taleb caps, Bogle core-first, Marks cash floor).
import { analyzeTicker } from "@/lib/analyze";
import { sectorBucket } from "@/lib/screener";
import type { OverallRating, PersonaId } from "@/lib/types";
import { L, l } from "@/lib/i18n";

export const BASKET_LIMIT = 15;

const BROAD_ETF = new Set(["SPY", "VOO", "IVV", "VTI", "VT", "QQQ", "XEQT", "XEQT.TO"]);

export interface BasketItem {
  ticker: string;
  name: string;
  isEtf: boolean;
  isBroadCore: boolean;
  sector: string;
  rating: OverallRating;
  score: number;
  confidence: number;
  vetoCount: number;
  talebVeto: boolean;
  marksVeto: boolean;
  vol: number | null;
  momentum12m: number | null;
  above200dma: boolean | null;
  buffettScore: number | null;
  sorosScore: number | null;
  resolved: boolean;
}

export interface BasketAllocation {
  ticker: string;
  weight: number; // % of total
  role: L;
  reason: L;
  rating: OverallRating | null;
  dropped: boolean;
}

export interface BasketNote {
  persona: PersonaId;
  stance: "bullish" | "neutral" | "bearish";
  text: L;
}

export interface BasketReview {
  generatedAt: string;
  items: BasketItem[];
  unresolved: string[];
  allocations: BasketAllocation[];
  cashWeight: number;
  verdict: L;
  notes: BasketNote[];
  warnings: L[];
  hhi: number;
  topSector: { name: string; share: number } | null;
}

const RATING_DROP = new Set<OverallRating>(["Reduce", "Avoid"]);

export async function reviewBasket(tickers: string[]): Promise<BasketReview> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    BASKET_LIMIT
  );

  const items: BasketItem[] = [];
  const unresolved: string[] = [];

  // Pool of 3 keeps SEC traffic polite.
  for (let i = 0; i < unique.length; i += 3) {
    const chunk = unique.slice(i, i + 3);
    const results = await Promise.all(
      chunk.map(async (t) => ({ t, r: await analyzeTicker(t).catch(() => null) }))
    );
    for (const { t, r } of results) {
      if (!r) {
        unresolved.push(t);
        continue;
      }
      const isEtf = r.asset.assetType === "etf" || r.asset.assetType === "index";
      const buffett = r.opinions.find((o) => o.persona === "buffett");
      const sorosOp = r.opinions.find((o) => o.persona === "soros");
      const taleb = r.opinions.find((o) => o.persona === "taleb");
      const marks = r.opinions.find((o) => o.persona === "marks");
      items.push({
        ticker: r.asset.ticker,
        name: r.asset.name,
        isEtf,
        isBroadCore: isEtf && BROAD_ETF.has(r.asset.ticker.toUpperCase()),
        sector: isEtf ? "ETF / Fund" : sectorBucket(r.asset.sector),
        rating: r.decision.overallRating,
        score: r.decision.score,
        confidence: r.decision.confidence,
        vetoCount: r.decision.vetoesApplied.length,
        talebVeto: !!taleb?.veto?.triggered,
        marksVeto: !!marks?.veto?.triggered,
        vol: r.quant?.realizedVol ?? null,
        momentum12m: r.quant?.momentum12m ?? null,
        above200dma: r.quant?.above200dma ?? null,
        buffettScore: !isEtf ? (buffett?.rating ?? null) : null,
        sorosScore: sorosOp?.rating ?? null,
        resolved: true,
      });
    }
  }

  // ---- Allocation engine ----
  const marksGreedy = items.some((i) => i.marksVeto);
  const cashFloor = marksGreedy ? 20 : 10;

  const cores = items.filter((i) => i.isEtf && !RATING_DROP.has(i.rating));
  const stocks = items.filter((i) => !i.isEtf && !RATING_DROP.has(i.rating));
  const dropped = items.filter((i) => RATING_DROP.has(i.rating));

  const allocations: BasketAllocation[] = [];

  // Satellite budget: 10% per qualifying stock, hard basket-wide cap.
  const satelliteCap = cores.length > 0 ? 40 : 50;
  const satelliteBudget = Math.min(stocks.length * 10, satelliteCap);

  // Raw stock weights: conviction above the Hold line, scaled by inverse vol.
  const raws = stocks.map((s) => {
    const conviction = Math.max(s.score - 42, 2);
    const volScale = s.vol ? Math.min(Math.max(20 / s.vol, 0.5), 1.5) : 1;
    return conviction * volScale;
  });
  const rawSum = raws.reduce((a, b) => a + b, 0) || 1;

  let stockTotal = 0;
  stocks.forEach((s, i) => {
    let w = (raws[i] / rawSum) * satelliteBudget;
    const cap = s.talebVeto ? 2 : 8; // Taleb per-name hard caps
    w = Math.min(w, cap);
    w = Math.round(w * 2) / 2;
    stockTotal += w;
    allocations.push({
      ticker: s.ticker,
      weight: w,
      role: l("Satellite", "卫星仓"),
      reason: l(
        `${s.rating}, score ${s.score}, vol ${s.vol ?? "n/a"}%${s.talebVeto ? " — Taleb veto caps it at 2%" : ""}. Sized by conviction ÷ volatility.`,
        `${s.rating},${s.score} 分,波动 ${s.vol ?? "n/a"}%${s.talebVeto ? "——Taleb 否决,硬上限 2%" : ""}。按信念÷波动率定权重。`
      ),
      rating: s.rating,
      dropped: false,
    });
  });

  // Core budget: everything left after satellites and cash.
  const coreBudget = Math.max(100 - cashFloor - stockTotal, 0);
  if (cores.length > 0) {
    const coreRaws = cores.map((c) => Math.max(c.score - 30, 5) * (c.isBroadCore ? 1.5 : 1));
    const coreSum = coreRaws.reduce((a, b) => a + b, 0) || 1;
    cores.forEach((c, i) => {
      const w = Math.round(((coreRaws[i] / coreSum) * coreBudget) * 2) / 2;
      allocations.push({
        ticker: c.ticker,
        weight: w,
        role: c.isBroadCore ? l("Core", "核心仓") : l("Thematic fund", "主题基金"),
        reason: c.isBroadCore
          ? l(
              `Broad-market core — carries the portfolio so the satellites don't have to.`,
              `宽基核心——组合的承重墙,让卫星仓不必承担全部。`
            )
          : l(
              `Fund, but not broad-market: treated as a tilt, not a core.`,
              `是基金但不是宽基:按倾斜仓对待,不算核心。`
            ),
        rating: c.rating,
        dropped: false,
      });
    });
  }

  for (const d of dropped) {
    allocations.push({
      ticker: d.ticker,
      weight: 0,
      role: l("Rejected", "剔除"),
      reason: l(
        `Committee rating is ${d.rating} (${d.vetoCount} veto${d.vetoCount === 1 ? "" : "es"}) — the committee refuses to allocate to it.`,
        `委员会评级 ${d.rating}(${d.vetoCount} 个 veto)——委员会拒绝为它分配仓位。`
      ),
      rating: d.rating,
      dropped: true,
    });
  }

  const invested = allocations.reduce((a, x) => a + x.weight, 0);
  const cashWeight = Math.round((100 - invested) * 2) / 2;

  // ---- Portfolio-level stats ----
  const live = allocations.filter((a) => a.weight > 0);
  const hhi = Math.round(
    live.reduce((a, x) => a + Math.pow(x.weight / 100, 2), 0) * 10000 +
      Math.pow(cashWeight / 100, 2) * 10000
  );
  const sectorTotals = new Map<string, number>();
  for (const a of live) {
    const item = items.find((i) => i.ticker === a.ticker);
    if (!item || item.isEtf) continue;
    sectorTotals.set(item.sector, (sectorTotals.get(item.sector) ?? 0) + a.weight);
  }
  const topSectorEntry = [...sectorTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const topSector = topSectorEntry
    ? { name: topSectorEntry[0], share: Math.round(topSectorEntry[1] * 10) / 10 }
    : null;

  // ---- Committee notes on the basket as a whole ----
  const notes: BasketNote[] = [];
  const warnings: L[] = [];

  const hasCore = cores.some((c) => c.isBroadCore);
  notes.push({
    persona: "bogle",
    stance: hasCore ? "neutral" : "bearish",
    text: hasCore
      ? l(
          `A broad-market core is present — good. Remember every large-cap stock here is already inside that index: each satellite must earn its slot with an edge, not duplicate beta you already own.`,
          `篮子里有宽基核心——很好。但记住:这里的每只大盘股本来就在指数里。每个卫星仓必须用 edge 证明自己,而不是重复你已经持有的 beta。`
        )
      : l(
          `No broad-market core in this basket. An all-single-stock portfolio is an implicit claim that you can out-pick the index across the board — I don't believe it, and the satellite budget is capped harder because of it.`,
          `篮子里没有宽基核心。全个股组合等于宣称你每一笔都能跑赢指数——我不信,因此卫星仓预算被压得更紧。`
        ),
  });
  if (!hasCore)
    warnings.push(
      l(
        "No broad-market ETF core: consider adding VT/VTI/SPY before adding more stocks.",
        "缺少宽基 ETF 核心:加更多个股之前,先考虑加入 VT/VTI/SPY。"
      )
    );

  notes.push({
    persona: "markowitz",
    stance: hhi > 2500 ? "bearish" : "neutral",
    text: l(
      `Concentration HHI ${hhi}${hhi > 2500 ? " — too concentrated; the math wants more, smaller positions" : " — acceptable"}. ${topSector ? `Largest single-stock sector exposure: ${topSector.name} at ${topSector.share}%.` : ""} Correlations are still placeholder — treat diversification claims as directional.`,
      `集中度 HHI ${hhi}${hhi > 2500 ? "——过于集中,数学上需要更多、更小的仓位" : "——可接受"}。${topSector ? `个股中最大板块敞口:${topSector.name} ${topSector.share}%。` : ""}相关性仍是占位假设——分散化结论按方向性参考。`
    ),
  });
  if (topSector && topSector.share > 20)
    warnings.push(
      l(
        `Sector concentration: ${topSector.name} holds ${topSector.share}% of single-stock weight.`,
        `板块集中:个股仓位中 ${topSector.name} 占 ${topSector.share}%。`
      )
    );

  const stockQ = items.filter((i) => i.buffettScore !== null);
  if (stockQ.length > 0) {
    const avgQ = Math.round(
      stockQ.reduce((a, i) => a + (i.buffettScore ?? 0), 0) / stockQ.length
    );
    const worst = stockQ.reduce((a, b) =>
      (a.buffettScore ?? 0) < (b.buffettScore ?? 0) ? a : b
    );
    notes.push({
      persona: "buffett",
      stance: avgQ >= 60 ? "bullish" : avgQ >= 45 ? "neutral" : "bearish",
      text: l(
        `Average business quality of the stock picks: ${avgQ}/100. The weakest business in the basket is ${worst.ticker} (${worst.buffettScore}) — a portfolio is only as honest as the story you tell about its worst holding.`,
        `个股部分的平均商业质量:${avgQ}/100。篮子里最弱的生意是 ${worst.ticker}(${worst.buffettScore})——一个组合的诚实程度,取决于你如何解释它最差的持仓。`
      ),
    });
  }

  notes.push({
    persona: "marks",
    stance: marksGreedy ? "bearish" : "neutral",
    text: marksGreedy
      ? l(
          `The greed veto is active market-wide (credit spreads too tight), so the cash floor for this basket is raised to ${cashFloor}%. You are assembling this basket at a point in the cycle when future returns have been partly prepaid.`,
          `贪婪 veto 全市场生效(信用利差过窄),本篮子现金下限上调至 ${cashFloor}%。你是在周期中「未来回报已被部分预支」的位置组装这个篮子的。`
        )
      : l(
          `Cycle readings are not extreme; the standard ${cashFloor}% cash floor applies.`,
          `周期读数不极端,适用标准现金下限 ${cashFloor}%。`
        ),
  });

  const allEquity = cores.every((c) => !c.ticker.match(/TLT|IEF|BND|GLD|IAU/)) ;
  if (allEquity && items.length > 0) {
    notes.push({
      persona: "dalio",
      stance: "bearish",
      text: l(
        `This basket is 100% equity-risk. Every line rises and falls with the same growth factor. There is no leg for recession (long bonds) or inflation/debasement (gold). That is a bet on one macro regime.`,
        `这个篮子是 100% 股票风险——每一行都随同一个增长因子涨跌,没有衰退腿(长债)、没有通胀/贬值腿(黄金)。这等于对单一宏观 regime 下注。`
      ),
    });
    warnings.push(
      l(
        "All-equity basket: no bond or gold hedge leg. See /strategy for the all-weather frame.",
        "全股票篮子:没有债券或黄金对冲腿。参考 /strategy 的全天候框架。"
      )
    );
  }

  const vetoed = items.filter((i) => i.talebVeto);
  notes.push({
    persona: "taleb",
    stance: vetoed.length > 0 ? "bearish" : "neutral",
    text:
      vetoed.length > 0
        ? l(
            `Veto enforced on ${vetoed.map((v) => v.ticker).join(", ")}: hard-capped at 2% each. Also standing: no single name above 8%, cash never below ${cashFloor}%, no leverage on any of this.`,
            `对 ${vetoed.map((v) => v.ticker).join("、")} 执行否决:每个硬上限 2%。常设规则:单一标的不超过 8%,现金不低于 ${cashFloor}%,整个篮子禁止杠杆。`
          )
        : l(
            `No ruin-grade names in the basket. Standing rules still apply: single name ≤8%, cash ≥${cashFloor}%, no leverage.`,
            `篮子里没有毁灭级标的。常设规则依然生效:单一标的 ≤8%,现金 ≥${cashFloor}%,禁止杠杆。`
          ),
  });

  const withTrend = items.filter((i) => i.above200dma !== null);
  const aboveShare = withTrend.length
    ? Math.round((withTrend.filter((i) => i.above200dma).length / withTrend.length) * 100)
    : null;
  notes.push({
    persona: "simons",
    stance: aboveShare !== null && aboveShare >= 60 ? "bullish" : aboveShare !== null && aboveShare < 40 ? "bearish" : "neutral",
    text: l(
      `Trend health: ${aboveShare ?? "n/a"}% of the basket trades above its 200DMA. Names that break trend should be the first candidates for the exit — that rule has statistical support; loyalty doesn't.`,
      `趋势健康度:篮子中 ${aboveShare ?? "n/a"}% 的标的位于 200DMA 上方。破位的名字应该是第一批退出候选——这条规则有统计支持,忠诚没有。`
    ),
  });

  const tactical = items.filter((i) => (i.sorosScore ?? 0) >= 60 && !i.isEtf);
  notes.push({
    persona: "soros",
    stance: "neutral",
    text:
      tactical.length > 0
        ? l(
            `${tactical.map((t) => t.ticker).join(", ")} qualify as tactical trend positions — but only with the exit pre-written: below the 200DMA they are gone, no debate.`,
            `${tactical.map((t) => t.ticker).join("、")} 符合战术趋势仓条件——但退出必须预先写好:跌破 200DMA 即离场,不讨论。`
          )
        : l(
            `Nothing here is an asymmetric opportunity in my sense. Fine — the cash line is the option on future asymmetry.`,
            `这里没有我定义的非对称机会。没关系——现金那一行就是对未来非对称机会的期权。`
          ),
  });

  // ---- Verdict ----
  const avgScore = items.length
    ? Math.round(items.reduce((a, i) => a + i.score, 0) / items.length)
    : 0;
  const verdict = l(
    `Basket of ${items.length} (${stocks.length} stocks, ${cores.length} funds${dropped.length ? `, ${dropped.length} rejected` : ""}). Average committee score ${avgScore}. Suggested structure: ${Math.round(100 - cashWeight - stockTotal)}% core, ${stockTotal}% satellites, ${cashWeight}% cash. ${marksGreedy ? "Assemble it in tranches — the cycle is not on your side for lump-sum entry." : "Deploy in 2–3 tranches as usual."}`,
    `篮子共 ${items.length} 项(${stocks.length} 只个股、${cores.length} 只基金${dropped.length ? `、${dropped.length} 项被剔除` : ""})。委员会平均分 ${avgScore}。建议结构:核心 ${Math.round(100 - cashWeight - stockTotal)}% + 卫星 ${stockTotal}% + 现金 ${cashWeight}%。${marksGreedy ? "分批组装——当前周期位置不适合一次性入场。" : "照常分 2–3 批部署。"}`
  );

  return {
    generatedAt: new Date().toISOString(),
    items,
    unresolved,
    allocations: allocations.sort((a, b) => b.weight - a.weight),
    cashWeight,
    verdict,
    notes,
    warnings,
    hhi,
    topSector,
  };
}
