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

const resultCache = new Map<string, { result: AnalysisResult; expires: number }>();

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
  rawTicker: string
): Promise<AnalysisResult | null> {
  let ticker = rawTicker.trim().toUpperCase();
  ticker = ALIASES[ticker] ?? ticker;
  if (!/^\^?[A-Z0-9.\-]{1,12}$/.test(ticker)) return null;

  // version-prefixed key so stale pre-refactor objects can never be served
  const cacheKey = `v3:${ticker}`;
  const hit = resultCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.result;

  const dataWarnings: L[] = [];

  const [market, identity, macro] = await Promise.all([
    getMarketData(ticker),
    resolveTickerToCik(ticker).catch(() => null),
    getMacroSnapshots().catch(() => []),
  ]);

  if (!market && !identity) return null;
  if (!market)
    dataWarnings.push(
      l(
        "Market price data unavailable: no price/momentum evidence this run.",
        "市场价格数据获取失败:本次分析无价格/动量证据。"
      )
    );
  if (macro.length === 0)
    dataWarnings.push(
      l(
        "FRED macro data unavailable: the macro committee members cannot judge.",
        "FRED 宏观数据获取失败:宏观委员的判断不可用。"
      )
    );

  let filings: AnalysisResult["filings"] = [];
  let financials: AnalysisResult["financials"] = [];
  let sicDescription: string | null = null;
  let sharesOutstanding: Parameters<typeof buildEvidence>[0]["sharesOutstanding"] = null;

  if (identity) {
    const [filingsRes, factsRes] = await Promise.all([
      getRecentFilings(identity).catch(() => null),
      getCompanyFacts(identity).catch(() => null),
    ]);
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

  const ctx = buildEvidence({
    ticker,
    financials,
    macro,
    quant,
    market,
    filings,
    sharesOutstanding,
  });

  const { opinions, decision } = runCommittee({
    asset,
    ctx,
    quant,
    macro,
    isEtf,
  });

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

  resultCache.set(cacheKey, { result, expires: Date.now() + 10 * 60 * 1000 });
  return result;
}
