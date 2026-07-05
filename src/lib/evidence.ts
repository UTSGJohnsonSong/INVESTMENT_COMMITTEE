// Evidence assembly. Everything the committee is allowed to know gets turned
// into an Evidence row here — with id, direction, source level, citation and
// confidence. Personas can only reference these rows.
import type {
  Evidence,
  FinancialMetric,
  MacroSnapshot,
  QuantStats,
  FilingRecord,
  Direction,
} from "@/lib/types";
import type { MarketData } from "@/lib/sources/market";
import type { PortfolioContext } from "@/lib/portfolio-context";
import { fmtUsd } from "@/lib/metrics";
import { l } from "@/lib/i18n";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `E${counter}`;
}

function yoyDirection(yoy: number | null): Direction {
  if (yoy === null) return "neutral";
  if (yoy > 3) return "bullish";
  if (yoy < -3) return "bearish";
  return "neutral";
}

export interface EvidenceContext {
  evidence: Evidence[];
  byName: Map<string, Evidence>;
}

export function buildEvidence(input: {
  ticker: string;
  financials: FinancialMetric[];
  macro: MacroSnapshot[];
  quant: QuantStats | null;
  market: MarketData | null;
  filings: FilingRecord[];
  sharesOutstanding?: { value: number; citationExcerpt: string; url: string; publishedAt: string; retrievedAt: string } | null;
  portfolioContext?: PortfolioContext | null;
}): EvidenceContext {
  counter = 0;
  const evidence: Evidence[] = [];
  const byName = new Map<string, Evidence>();

  const push = (e: Omit<Evidence, "id">) => {
    const row: Evidence = { ...e, id: nextId() };
    evidence.push(row);
    if (row.metricName) byName.set(row.metricName, row);
    return row;
  };

  // --- Financial facts (P0, SEC XBRL) ---
  for (const f of input.financials) {
    const valStr =
      f.unit === "USD"
        ? fmtUsd(f.value)
        : f.unit === "%"
          ? `${f.value}%`
          : `$${f.value}`;
    const yoyStr =
      f.yoyChange !== null
        ? `, ${f.yoyChange >= 0 ? "+" : ""}${f.yoyChange}% YoY`
        : "";
    push({
      statement: l(
        `${f.label} (${f.period}): ${valStr}${yoyStr}`,
        `${f.label}(${f.period}):${valStr}${yoyStr}`
      ),
      direction:
        f.name.startsWith("revenue") ||
        f.name.startsWith("net_income") ||
        f.name.startsWith("eps") ||
        f.name.startsWith("free_cash_flow") ||
        f.name.startsWith("operating_cash_flow")
          ? yoyDirection(f.yoyChange)
          : "neutral",
      tags: ["sec", "financials"],
      citation: f.citation,
      metricName: f.name,
      metricValue: f.value,
      metricUnit: f.unit,
      confidence: 95,
      isMock: false,
    });
  }

  // --- Macro (P0, FRED) ---
  for (const m of input.macro) {
    let direction: Direction = "neutral";
    if (m.seriesId === "T10Y2Y") direction = m.value < 0 ? "bearish" : "neutral";
    if (m.seriesId === "CPIAUCSL")
      direction = m.value > 3.2 ? "bearish" : m.value < 2.5 ? "bullish" : "neutral";
    if (m.seriesId === "BAMLH0A0HYM2")
      direction = m.value > 5 ? "bearish" : m.value < 3.2 ? "bullish" : "neutral";
    if (m.seriesId === "UNRATE")
      direction = m.value > 4.5 ? "bearish" : "neutral";
    push({
      statement: l(
        `${m.label}: ${m.value}${m.unit} (observation ${m.observationDate})`,
        `${m.label}:${m.value}${m.unit}(观测日 ${m.observationDate})`
      ),
      direction,
      tags: ["macro"],
      citation: {
        sourceName: `FRED ${m.seriesId}`,
        sourceUrl: m.url,
        sourceLevel: "P0",
        sourceType: "fred_series",
        publishedAt: m.observationDate,
        retrievedAt: m.retrievedAt,
        seriesId: m.seriesId,
        excerpt: m.derived ?? `${m.seriesId} = ${m.value} on ${m.observationDate}`,
      },
      metricName: `macro_${m.seriesId}`,
      metricValue: m.value,
      metricUnit: m.unit,
      confidence: 92,
      isMock: false,
    });
  }

  // --- Market / quant (P1, delayed) ---
  const q = input.quant;
  const mkt = input.market;
  if (q && mkt) {
    const cite = (excerpt: string) => ({
      sourceName: mkt.sourceName,
      sourceUrl: mkt.sourceUrl,
      sourceLevel: "P1" as const,
      sourceType: "market_quote",
      publishedAt: q.lastPriceTime,
      retrievedAt: mkt.retrievedAt,
      excerpt,
    });
    push({
      statement: l(
        `Last price ${q.lastPrice} ${q.currency} (delayed, as of ${q.lastPriceTime})`,
        `最新价格 ${q.lastPrice} ${q.currency}(延迟数据,截至 ${q.lastPriceTime})`
      ),
      direction: "neutral",
      tags: ["market"],
      citation: cite(`regularMarketPrice=${q.lastPrice} at ${q.lastPriceTime}`),
      metricName: "last_price",
      metricValue: q.lastPrice,
      metricUnit: q.currency,
      confidence: 80,
      isMock: false,
    });
    if (q.momentum12m !== null)
      push({
        statement: l(
          `12-month price momentum: ${q.momentum12m >= 0 ? "+" : ""}${q.momentum12m}%`,
          `12 个月价格动量:${q.momentum12m >= 0 ? "+" : ""}${q.momentum12m}%`
        ),
        direction: q.momentum12m > 5 ? "bullish" : q.momentum12m < -5 ? "bearish" : "neutral",
        tags: ["market", "quant"],
        citation: cite(`computed from ${mkt.history.length} daily closes`),
        metricName: "momentum_12m",
        metricValue: q.momentum12m,
        metricUnit: "%",
        confidence: 78,
        isMock: false,
      });
    if (q.momentum3m !== null)
      push({
        statement: l(
          `3-month price momentum: ${q.momentum3m >= 0 ? "+" : ""}${q.momentum3m}%`,
          `3 个月价格动量:${q.momentum3m >= 0 ? "+" : ""}${q.momentum3m}%`
        ),
        direction: q.momentum3m > 3 ? "bullish" : q.momentum3m < -3 ? "bearish" : "neutral",
        tags: ["market", "quant"],
        citation: cite(`computed from daily closes`),
        metricName: "momentum_3m",
        metricValue: q.momentum3m,
        metricUnit: "%",
        confidence: 78,
        isMock: false,
      });
    if (q.above200dma !== null)
      push({
        statement: l(
          `Price is ${q.above200dma ? "above" : "below"} its 200-day moving average`,
          `价格${q.above200dma ? "站上" : "跌破"} 200 日均线`
        ),
        direction: q.above200dma ? "bullish" : "bearish",
        tags: ["market", "quant"],
        citation: cite(`200DMA computed from daily closes`),
        metricName: "above_200dma",
        metricValue: q.above200dma ? 1 : 0,
        confidence: 78,
        isMock: false,
      });
    if (q.realizedVol !== null)
      push({
        statement: l(
          `Realized volatility (1y, annualized): ${q.realizedVol}%`,
          `已实现波动率(1 年,年化):${q.realizedVol}%`
        ),
        direction: q.realizedVol > 45 ? "bearish" : "neutral",
        tags: ["market", "quant"],
        citation: cite(`stdev of daily log returns × √252`),
        metricName: "realized_vol",
        metricValue: q.realizedVol,
        metricUnit: "%",
        confidence: 78,
        isMock: false,
      });
    if (q.maxDrawdown1y !== null)
      push({
        statement: l(
          `Max drawdown over the past year: ${q.maxDrawdown1y}%`,
          `过去一年最大回撤:${q.maxDrawdown1y}%`
        ),
        direction: q.maxDrawdown1y < -30 ? "bearish" : "neutral",
        tags: ["market", "quant"],
        citation: cite(`peak-to-trough on daily closes`),
        metricName: "max_drawdown_1y",
        metricValue: q.maxDrawdown1y,
        metricUnit: "%",
        confidence: 78,
        isMock: false,
      });
    if (q.pctFromHigh !== null)
      push({
        statement: l(
          `Price is ${Math.abs(q.pctFromHigh)}% below its 1-year high`,
          `价格低于一年高点 ${Math.abs(q.pctFromHigh)}%`
        ),
        direction: "neutral",
        tags: ["market", "quant", "valuation"],
        citation: cite(`vs. max daily close in trailing year`),
        metricName: "pct_from_high",
        metricValue: q.pctFromHigh,
        metricUnit: "%",
        confidence: 78,
        isMock: false,
      });
  }

  // --- Real portfolio correlation (Markowitz): only present when the caller
  // supplied actual holdings. Each successfully computed correlation becomes
  // its own citable evidence row so the persona's argument is traceable.
  if (input.portfolioContext) {
    const pc = input.portfolioContext;
    for (const c of pc.correlations) {
      if (c.correlation === null) continue;
      push({
        statement: l(
          `Correlation to ${c.ticker} (${c.overlapDays} trading days of aligned daily returns): ${c.correlation.toFixed(2)}`,
          `与 ${c.ticker} 的相关性(${c.overlapDays} 个交易日对齐日收益):${c.correlation.toFixed(2)}`
        ),
        direction: "neutral",
        tags: ["quant", "valuation"],
        citation: {
          sourceName: "Derived: Pearson correlation of daily log returns",
          sourceUrl: `https://finance.yahoo.com/quote/${c.ticker}`,
          sourceLevel: "P1",
          sourceType: "derived",
          publishedAt: mkt?.retrievedAt ?? new Date().toISOString(),
          retrievedAt: mkt?.retrievedAt ?? new Date().toISOString(),
          excerpt: `corr(${input.ticker}, ${c.ticker}) over ${c.overlapDays} aligned trading days = ${c.correlation.toFixed(3)}`,
        },
        metricName: `corr_${c.ticker}`,
        metricValue: c.correlation,
        confidence: c.overlapDays >= 180 ? 70 : 55,
        isMock: false,
      });
    }
  }

  // --- Derived valuation: P/E from delayed price + SEC diluted EPS ---
  const eps = byName.get("eps_diluted");
  if (q && eps && typeof eps.metricValue === "number" && eps.metricValue > 0) {
    const pe = Math.round((q.lastPrice / eps.metricValue) * 10) / 10;
    push({
      statement: l(
        `Trailing P/E ≈ ${pe} (delayed price ${q.lastPrice} ÷ diluted EPS $${eps.metricValue} from ${eps.citation.formType})`,
        `Trailing P/E ≈ ${pe}(延迟价格 ${q.lastPrice} ÷ ${eps.citation.formType} 摊薄 EPS $${eps.metricValue})`
      ),
      direction: pe > 35 ? "bearish" : pe < 15 ? "bullish" : "neutral",
      tags: ["valuation"],
      citation: {
        ...eps.citation,
        sourceName: `Derived: delayed price ÷ SEC diluted EPS`,
        excerpt: `P/E = ${q.lastPrice} / ${eps.metricValue} = ${pe}. EPS from ${eps.citation.sourceName} (${eps.citation.accessionNumber}); price delayed as of ${q.lastPriceTime}.`,
      },
      metricName: "pe_trailing",
      metricValue: pe,
      confidence: 72,
      isMock: false,
    });
  }

  // --- Market cap from shares outstanding × delayed price ---
  if (q && input.sharesOutstanding) {
    const s = input.sharesOutstanding;
    const mcap = s.value * q.lastPrice;
    push({
      statement: l(
        `Market cap ≈ ${fmtUsd(mcap)} (${(s.value / 1e9).toFixed(2)}B shares × delayed price ${q.lastPrice})`,
        `市值 ≈ ${fmtUsd(mcap)}(${(s.value / 1e9).toFixed(2)}B 股 × 延迟价格 ${q.lastPrice})`
      ),
      direction: "neutral",
      tags: ["valuation", "market"],
      citation: {
        sourceName: "Derived: SEC shares outstanding × delayed price",
        sourceUrl: s.url,
        sourceLevel: "P1",
        sourceType: "derived",
        publishedAt: s.publishedAt,
        retrievedAt: s.retrievedAt,
        excerpt: s.citationExcerpt,
      },
      metricName: "market_cap",
      metricValue: mcap,
      metricUnit: "USD",
      confidence: 72,
      isMock: false,
    });
  }

  // --- Filing recency (P0) ---
  const latestReport = input.filings.find(
    (f) => f.form === "10-Q" || f.form === "10-K"
  );
  if (latestReport) {
    push({
      statement: l(
        `Latest ${latestReport.form} filed ${latestReport.filingDate}${latestReport.reportDate ? ` for period ending ${latestReport.reportDate}` : ""}`,
        `最新 ${latestReport.form} 于 ${latestReport.filingDate} 提交${latestReport.reportDate ? `(报告期截至 ${latestReport.reportDate})` : ""}`
      ),
      direction: "neutral",
      tags: ["sec"],
      citation: {
        sourceName: `SEC EDGAR ${latestReport.form}`,
        sourceUrl: latestReport.url,
        sourceLevel: "P0",
        sourceType: "sec_filing",
        publishedAt: latestReport.filingDate,
        retrievedAt: new Date().toISOString(),
        accessionNumber: latestReport.accessionNumber,
        formType: latestReport.form,
        periodEnd: latestReport.reportDate,
        excerpt: `${latestReport.form} accession ${latestReport.accessionNumber}`,
      },
      metricName: "latest_filing",
      confidence: 95,
      isMock: false,
    });
  }

  // --- Derived ratios personas need ---
  const debt = byName.get("total_debt");
  const equity = byName.get("equity");
  if (
    debt?.metricValue !== undefined &&
    equity?.metricValue !== undefined &&
    equity.metricValue > 0
  ) {
    const de = Math.round((debt.metricValue / equity.metricValue) * 100) / 100;
    push({
      statement: l(
        `Debt / Equity ≈ ${de} (LT debt ${fmtUsd(debt.metricValue)} ÷ equity ${fmtUsd(equity.metricValue)})`,
        `负债/权益 ≈ ${de}(长期负债 ${fmtUsd(debt.metricValue)} ÷ 股东权益 ${fmtUsd(equity.metricValue)})`
      ),
      direction: de > 2 ? "bearish" : "neutral",
      tags: ["financials", "valuation"],
      citation: {
        ...debt.citation,
        sourceName: "Derived from SEC XBRL balance sheet",
        excerpt: `D/E = ${fmtUsd(debt.metricValue)} / ${fmtUsd(equity.metricValue)}`,
      },
      metricName: "debt_to_equity",
      metricValue: de,
      confidence: 90,
      isMock: false,
    });
  }
  const ni = byName.get("net_income");
  if (
    ni?.metricValue !== undefined &&
    equity?.metricValue !== undefined &&
    equity.metricValue > 0
  ) {
    const roe = Math.round((ni.metricValue / equity.metricValue) * 10000) / 100;
    push({
      statement: l(
        `Return on equity ≈ ${roe}% (FY net income ÷ latest equity)`,
        `净资产收益率 ROE ≈ ${roe}%(全年净利润 ÷ 最新股东权益)`
      ),
      direction: roe > 15 ? "bullish" : roe < 5 ? "bearish" : "neutral",
      tags: ["financials"],
      citation: {
        ...ni.citation,
        sourceName: "Derived from SEC XBRL",
        excerpt: `ROE = ${fmtUsd(ni.metricValue)} / ${fmtUsd(equity.metricValue)}`,
      },
      metricName: "roe",
      metricValue: roe,
      metricUnit: "%",
      confidence: 88,
      isMock: false,
    });
  }

  return { evidence, byName };
}
