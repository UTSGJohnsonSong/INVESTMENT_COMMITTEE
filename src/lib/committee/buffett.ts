import type { PersonaOpinion } from "@/lib/types";
import { l } from "@/lib/i18n";
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

export function buffett(input: CommitteeInput): PersonaOpinion {
  const { ctx, isEtf, asset } = input;

  if (isEtf) {
    const kind =
      asset.assetType === "index"
        ? { en: "an index", zh: "指数" }
        : { en: "an ETF", zh: "ETF" };
    const args = [
      arg(
        l(
          `${asset.ticker} is ${kind.en}, not a business — there is no moat, no management, no capital allocation to judge. Business-quality analysis does not apply; hand this one to Mr. Bogle.`,
          `${asset.ticker} 是${kind.zh},不是一门生意——没有护城河、管理层、资本配置可言。商业质量分析不适用,这个问题应该交给 Bogle 委员。`
        ),
        [],
        true
      ),
    ];
    return {
      persona: "buffett",
      stance: "neutral",
      rating: 50,
      confidence: 40,
      recommendedAction: l(
        "No rating. If you want my opinion, bring me a company.",
        "不评级。想让我出意见,给我一家公司。"
      ),
      summary: args[0].text,
      arguments: args,
      risks: [],
      challenge: l(
        "Are you buying a business, or a basket of tickers?",
        "你买的是生意,还是一篮子代码?"
      ),
      disagreements: [],
      citedEvidenceIds: [],
      dataFreshness: freshness(input),
      usesMockData: false,
    };
  }

  const gm = val(ctx, "gross_margin");
  const nm = val(ctx, "net_margin");
  const roe = val(ctx, "roe");
  const fcf = val(ctx, "free_cash_flow");
  const fcfYoy = yoyOf(ctx, "free_cash_flow");
  const revYoy = yoyOf(ctx, "revenue");
  const de = val(ctx, "debt_to_equity");
  const pe = val(ctx, "pe_trailing");

  // Moat score: pricing power shows up as sustained margins and ROE.
  let moat = 40;
  if (gm !== null) moat += gm > 40 ? 20 : gm > 25 ? 8 : -10;
  if (nm !== null) moat += nm > 20 ? 20 : nm > 10 ? 8 : -10;
  if (roe !== null) moat += roe > 25 ? 15 : roe > 12 ? 6 : -10;
  moat = clamp(moat, 0, 100);

  let quality = 0;
  if (fcf !== null && fcf > 0) quality += 15;
  if (fcfYoy !== null && fcfYoy > 0) quality += 8;
  if (revYoy !== null && revYoy > 5) quality += 8;
  if (de !== null && de < 1.5) quality += 8;

  let valuationPenalty = 0;
  if (pe !== null) {
    if (pe > 40) valuationPenalty = 22;
    else if (pe > 30) valuationPenalty = 14;
    else if (pe > 22) valuationPenalty = 6;
  }

  const rating = clamp(Math.round(moat * 0.45 + quality + 20 - valuationPenalty), 10, 90);

  const fcfWord = fcf !== null ? (fcf > 0 ? { en: "positive", zh: "为正" } : { en: "negative", zh: "为负" }) : { en: "missing", zh: "缺失" };
  const args = [
    arg(
      l(
        `Is this a good business? Gross margin ${gm ?? "n/a"}%, net margin ${nm ?? "n/a"}%, ROE ${roe ?? "n/a"}% — moat score ${moat}/100. High, durable margins are the direct evidence of pricing power.`,
        `这是不是一门好生意?毛利率 ${gm ?? "n/a"}%、净利率 ${nm ?? "n/a"}%、ROE ${roe ?? "n/a"}%——护城河评分 ${moat}/100。高且稳定的利润率就是定价权的直接证据。`
      ),
      ids(ctx, "gross_margin", "net_margin", "roe")
    ),
    arg(
      l(
        `Free cash flow is ${fcfWord.en} (${pct(fcfYoy)} YoY); revenue ${pct(revYoy)} YoY. A business is ultimately worth the cash it produces over its lifetime — not its story.`,
        `自由现金流${fcfWord.zh}(${pct(fcfYoy)} YoY),营收 ${pct(revYoy)} YoY。生意的价值最终等于它一生产生的现金,不是故事。`
      ),
      ids(ctx, "free_cash_flow", "revenue")
    ),
    arg(
      pe !== null
        ? l(
            `Valuation: trailing P/E ${pe}. ${pe > 30 ? "At this price a good chunk of the next decade's growth is prepaid — insufficient margin of safety." : pe < 18 ? "The price does not over-borrow from the future; a margin of safety exists." : "Fair but not cheap — returns will come from the business compounding, not multiple expansion."}`,
            `估值:trailing P/E ${pe}。${pe > 30 ? "以这个价格,未来十年的增长有相当一部分已经被预付了——安全边际不足。" : pe < 18 ? "价格没有透支太多未来,安全边际存在。" : "价格合理但不便宜,回报将主要来自业务本身的复利。"}`
          )
        : l(
            "Valuation data missing — no judgment on margin of safety, and without a price judgment there is no buy conclusion.",
            "估值数据缺失,无法判断安全边际——没有价格判断就没有买入结论。"
          ),
      ids(ctx, "pe_trailing")
    ),
  ];

  const risks = [
    arg(
      l(
        "Management and capital-allocation quality cannot be verified from XBRL numbers (requires the shareholder letter and the proxy) — a blind spot of this analysis.",
        "管理层与资本配置质量无法从 XBRL 数字直接核实(需要读 shareholder letter 与 proxy)——这是本次分析的盲区。"
      ),
      [],
      true
    ),
    arg(
      valuationPenalty >= 14
        ? l(
            "Biggest objection: a good company is not automatically a good investment. At this valuation, the implied forward return is badly compressed.",
            "最大反对点:好公司 ≠ 好投资。当前估值下,买入的隐含回报率被显著压缩。"
          )
        : l(
            "Biggest objection: when margins sit at historical highs, mean reversion is itself the risk.",
            "最大反对点:利润率处于历史高位时,均值回归本身就是风险。"
          ),
      ids(ctx, "pe_trailing", "net_margin"),
      true
    ),
  ];
  if (de !== null && de > 1.5)
    risks.push(
      arg(
        l(
          `Debt/Equity ${de}: leverage amplifies everything — including mistakes.`,
          `Debt/Equity ${de}:杠杆放大一切,包括错误。`
        ),
        ids(ctx, "debt_to_equity")
      )
    );

  return {
    persona: "buffett",
    stance: stanceFromRating(rating),
    rating,
    confidence: 72,
    recommendedAction:
      rating >= 65
        ? l(
            "Business quality supports a 5–10 year hold; buy when valuation offers a margin of safety, and buy more on weakness.",
            "生意质量足以支撑 5–10 年持有;在估值给出安全边际时买入,越跌越买。"
          )
        : rating >= 45
          ? l(
              "Good business, uncooperative price: put it on the watchlist and wait for a drawdown to hand you a margin of safety.",
              "好生意但价格不给机会:放进 watchlist,等回撤给出安全边际。"
            )
          : l(
              "Business quality or valuation fails the test. Pass.",
              "商业质量或估值不过关,不碰。"
            ),
    summary: args[0].text,
    arguments: args,
    risks,
    challenge: l(
      "Is this a good business or just a good story? Will it earn more cash in ten years than it does today?",
      "这是好生意,还是只是好故事?十年后它赚的现金比今天多吗?"
    ),
    disagreements: [],
    citedEvidenceIds: collectCited([...args, ...risks]),
    dataFreshness: freshness(input),
    usesMockData: false,
  };
}
