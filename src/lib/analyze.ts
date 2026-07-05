// Orchestrator: resolve asset -> fetch evidence -> normalize -> committee ->
// synthesis. This is Step 1-6 of the product spec's analysis flow.
import type { AnalysisResult, AssetInfo } from "@/lib/types";
import { L, l } from "@/lib/i18n";
import {
  getCompanyFacts,
  getRecentFilings,
  resolveTickerToCik,
} from "@/lib/sources/sec";
import { getMacroSnapshots } from "@/lib/sources/fred";
import { computeQuantStats, getMarketData } from "@/lib/sources/market";
import { deriveFinancials } from "@/lib/metrics";
import { buildEvidence } from "@/lib/evidence";
import { runCommittee } from "@/lib/committee";
import { enrichWithLLM } from "@/lib/committee/llm";
import { computeHoldingCorrelations } from "@/lib/portfolio-context";
import { unstable_cache } from "next/cache";

// Common index / natural-language aliases → Yahoo symbols. Indices have no
// SEC filer; they go through the fund/index committee path.
const ALIASES: Record<string, string> = {
  "SP500": "^GSPC",
  "S&P500": "^GSPC",
  "S&P 500": "^GSPC",
  "SPX": "^GSPC",
  "GSPC": "^GSPC",
  "标普500": "^GSPC",
  "NASDAQ": "^NDX",
  "NASDAQ100": "^NDX",
  "NDX": "^NDX",
  "纳指": "^NDX",
  "DOW": "^DJI",
  "DJIA": "^DJI",
  "道指": "^DJI",
  "VIX": "^VIX",
  "RUSSELL2000": "^RUT",
  "RUT": "^RUT",
};

export async function analyzeTicker(
  rawTicker: string,
  opts: { holdingTickers?: string[] } = {}
): Promise<AnalysisResult | null> {
  let ticker = rawTicker.trim().toUpperCase();
  ticker = ALIASES[ticker] ?? ticker;
  if (!/^\^?[A-Z0-9.\-]{1,12}$/.test(ticker)) return null;

  const holdingTickers = [...new Set((opts.holdingTickers ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean))].sort();

  // Durable, cross-instance cache (Vercel Data Cache): the whole analysis —
  // including the optional LLM pass and every external fetch — is recomputed at
  // most once per ticker+holdings per revalidate window, then reused across all
  // requests and serverless instances. runAnalysis THROWS (never returns null)
  // on a total data failure, so a transient outage is never cached as a
  // "not found".
  try {
    return await getCachedAnalysis(ticker, holdingTickers);
  } catch (e) {
    // Outside the Next.js server runtime (smoke scripts, tests, non-request
    // callers) the incremental cache store is absent and unstable_cache throws
    // before running. Fall back to an uncached run so those callers still work;
    // in production the store is always present and this branch never fires.
    if (e instanceof Error && e.message.includes("incrementalCache missing")) {
      try {
        return await runAnalysis(ticker, holdingTickers);
      } catch {
        return null;
      }
    }
    // runAnalysis itself threw (total data failure) — treat as not found. The
    // throw is never cached, so a transient outage won't stick for the window.
    return null;
  }
}

const getCachedAnalysis = unstable_cache(
  (ticker: string, holdingTickers: string[]) => runAnalysis(ticker, holdingTickers),
  ["analyze-ticker-v3"],
  { revalidate: 600 }
);

async function runAnalysis(
  ticker: string,
  holdingTickers: string[]
): Promise<AnalysisResult> {
  const dataWarnings: L[] = [];

  // Resolve identity first so the SEC filings/facts fetches can start the
  // moment the CIK is known, overlapping with the identity-independent market
  // and macro fetches instead of waiting for them to complete.
  const identityP = resolveTickerToCik(ticker).catch(() => null);
  type FilingsRes = Awaited<ReturnType<typeof getRecentFilings>> | null;
  type FactsRes = Awaited<ReturnType<typeof getCompanyFacts>> | null;
  const secP: Promise<[FilingsRes, FactsRes]> = identityP.then((id) =>
    id
      ? Promise.all([
          getRecentFilings(id).catch(() => null),
          getCompanyFacts(id).catch(() => null),
        ])
      : [null, null]
  );
  const [market, identity, macro, [filingsRes, factsRes]] = await Promise.all([
    getMarketData(ticker),
    identityP,
    getMacroSnapshots().catch(() => []),
    secP,
  ]);

  if (!market && !identity) throw new Error("no market or identity data");
  if (!market)
    dataWarnings.push(
      l(
        "Market price data unavailable: no price/momentum evidence this run.",
        "市场价格数据获取失败:本次分析无价格/动量证据。"
      )
    );
  if (market?.stale)
    dataWarnings.push(
      l(
        `Market data is STALE: live fetch failed; serving the last successful pull from ${market.retrievedAt} (${market.sourceName}).`,
        `市场数据为 STALE:实时获取失败,当前展示的是 ${market.retrievedAt} 的上次成功数据(${market.sourceName})。`
      )
    );
  if (market && !market.stale && market.sourceName.includes("Stooq"))
    dataWarnings.push(
      l(
        "Primary market source (Yahoo) failed; price data comes from the Stooq end-of-day fallback (EOD close, no intraday).",
        "主市场源(Yahoo)失败,价格数据来自 Stooq 日线备用源(收盘价,无盘中数据)。"
      )
    );
  if (macro.length === 0)
    dataWarnings.push(
      l(
        "FRED macro data unavailable: the macro committee members cannot judge.",
        "FRED 宏观数据获取失败:宏观委员的判断不可用。"
      )
    );
  const staleMacro = macro.filter((m) => m.stale);
  if (staleMacro.length > 0)
    dataWarnings.push(
      l(
        `Macro series STALE (live fetch failed, serving last successful pull): ${staleMacro.map((m) => m.seriesId).join(", ")}.`,
        `宏观序列为 STALE(实时获取失败,展示上次成功数据):${staleMacro.map((m) => m.seriesId).join("、")}。`
      )
    );

  let filings: AnalysisResult["filings"] = [];
  let financials: AnalysisResult["financials"] = [];
  let sicDescription: string | null = null;
  let sharesOutstanding: Parameters<typeof buildEvidence>[0]["sharesOutstanding"] = null;

  if (identity) {
    if (filingsRes) {
      filings = filingsRes.filings;
      sicDescription = filingsRes.sicDescription;
    } else
      dataWarnings.push(
        l(
          "SEC submissions unavailable: filing list missing.",
          "SEC submissions 获取失败:filing 列表缺失。"
        )
      );
    if (factsRes) {
      financials = deriveFinancials(factsRes.facts, identity.cikRaw, factsRes.retrievedAt);
      const dei = factsRes.facts.facts.dei?.["EntityCommonStockSharesOutstanding"];
      const sharesEntries = dei?.units?.["shares"];
      if (sharesEntries?.length) {
        const latest = [...sharesEntries].sort((a, b) => (a.end < b.end ? 1 : -1))[0];
        sharesOutstanding = {
          value: latest.val,
          citationExcerpt: `EntityCommonStockSharesOutstanding = ${latest.val.toLocaleString()} as of ${latest.end} (${latest.form}, accession ${latest.accn})`,
          url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${identity.cik}.json`,
          publishedAt: latest.filed,
          retrievedAt: factsRes.retrievedAt,
        };
      }
    } else if (market?.instrumentType === "EQUITY") {
      dataWarnings.push(
        l(
          "SEC company facts unavailable: financial evidence missing; the business-quality member cannot opine.",
          "SEC company facts 获取失败:财务证据缺失,商业质量委员意见不可用。"
        )
      );
    }
  }

  const isIndex = market?.instrumentType === "INDEX" || ticker.startsWith("^");
  const isEtf =
    market?.instrumentType === "ETF" || isIndex || (!identity && !!market);
  if (isEtf && !identity)
    dataWarnings.push(
      isIndex
        ? l(
            "This is an index (not directly tradable): financial modules do not apply; to invest, see the corresponding ETF (e.g. SPY/QQQ).",
            "这是指数(不可直接交易):财务模块不适用;如需投资请看对应 ETF(如 SPY/QQQ)。"
          )
        : l(
            "No SEC company file for this symbol (ETF or non-US listing): financial modules do not apply.",
            "该标的无 SEC 公司档案(ETF 或非美股):财务模块不适用。"
          )
    );

  const asset: AssetInfo = {
    ticker,
    name: market?.name ?? identity?.name ?? ticker,
    cik: identity?.cik ?? null,
    exchange: market?.exchange ?? null,
    assetType: isIndex ? "index" : isEtf ? "etf" : identity ? "stock" : "unknown",
    sector: sicDescription ?? undefined,
  };

  // ---- Data quality checks (never silently pass questionable numbers) ----
  const fin = (n: string) => financials.find((f) => f.name === n);
  const revA = fin("revenue");
  const ocfA = fin("operating_cash_flow");
  const nmA = fin("net_margin");
  if (revA && ocfA && ocfA.value > revA.value)
    dataWarnings.push(
      l(
        `Quality flag: operating cash flow (${ocfA.period}) exceeds revenue (${revA.period}) — verify against the filing before trusting either.`,
        `质量警示:经营现金流(${ocfA.period})大于营收(${revA.period})——采信前请对照原始 filing 核实。`
      )
    );
  if (nmA && nmA.value > 60)
    dataWarnings.push(
      l(
        `Quality flag: net margin of ${nmA.value}% is abnormally high — possible one-off items or tag mismatch; flagged for review.`,
        `质量警示:净利率 ${nmA.value}% 异常偏高——可能包含一次性项目或 XBRL 标签错配,已标记复核。`
      )
    );
  const latestQ = financials.find((f) => f.periodType === "quarterly");
  if (latestQ) {
    const ageDays =
      (Date.now() - new Date(latestQ.periodEnd).getTime()) / 86400000;
    if (ageDays > 150)
      dataWarnings.push(
        l(
          `Stale: the "latest quarter" ended ${latestQ.periodEnd} (${Math.round(ageDays)} days ago) — a newer quarter has likely been reported or is imminent.`,
          `Stale:「最新季度」截至 ${latestQ.periodEnd}(${Math.round(ageDays)} 天前)——更新的季度大概率已发布或临近。`
        )
      );
  }

  const quant = market ? computeQuantStats(market) : null;

  // Real portfolio correlation (Markowitz): only computed when the caller
  // supplies actual holdings (wired from the user's basket). Without them
  // the persona falls back to its labeled placeholder assumption.
  const portfolioContext =
    market && holdingTickers.length > 0
      ? await computeHoldingCorrelations(ticker, market, holdingTickers).catch(() => null)
      : null;

  const ctx = buildEvidence({
    ticker,
    financials,
    macro,
    quant,
    market,
    filings,
    sharesOutstanding,
    portfolioContext,
  });

  const { opinions, decision } = runCommittee({
    asset,
    ctx,
    quant,
    macro,
    isEtf,
    portfolioContext,
  });

  // Optional LLM layer: deepens qualitative text only (evidence-only, ids
  // validated); scores/vetoes stay deterministic. No-op without an API key.
  const llm = await enrichWithLLM({ asset, evidence: ctx.evidence, opinions });
  if (llm.warning) dataWarnings.push(llm.warning);

  const result: AnalysisResult = {
    asset,
    generatedAt: new Date().toISOString(),
    quant,
    priceHistory: market?.history ?? [],
    macro,
    financials,
    filings,
    evidence: ctx.evidence,
    opinions,
    decision,
    dataWarnings,
  };

  return result;
}
