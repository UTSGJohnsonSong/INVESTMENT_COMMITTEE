// Real portfolio correlation. Markowitz's whole point is that an asset means
// nothing in isolation — this computes ACTUAL Pearson correlation of daily
// log returns against the user's real holdings (sourced from the basket),
// replacing the fixed 0.8/0.95 placeholder the persona used to assume.
import { getMarketData, type MarketData } from "@/lib/sources/market";
import type { PricePoint } from "@/lib/types";

export interface HoldingCorrelation {
  ticker: string;
  correlation: number | null; // null when overlap is too thin to trust
  overlapDays: number;
}

export interface PortfolioContext {
  tickers: string[];
  correlations: HoldingCorrelation[];
  avgAbsCorrelation: number | null;
  maxCorrelation: { ticker: string; correlation: number } | null;
}

const MIN_OVERLAP_DAYS = 30;
const MAX_HOLDINGS = 8; // bound external fetches per page load

function logReturns(history: PricePoint[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].close;
    const cur = history[i].close;
    if (prev > 0 && cur > 0) out.set(history[i].date, Math.log(cur / prev));
  }
  return out;
}

function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 2) return null;
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

function correlateReturns(target: PricePoint[], other: PricePoint[]): { correlation: number | null; overlapDays: number } {
  const rt = logReturns(target);
  const ro = logReturns(other);
  const dates = [...rt.keys()].filter((d) => ro.has(d)).sort();
  if (dates.length < MIN_OVERLAP_DAYS) return { correlation: null, overlapDays: dates.length };
  const a = dates.map((d) => rt.get(d)!);
  const b = dates.map((d) => ro.get(d)!);
  return { correlation: pearson(a, b), overlapDays: dates.length };
}

export async function computeHoldingCorrelations(
  targetTicker: string,
  target: MarketData,
  rawHoldingTickers: string[]
): Promise<PortfolioContext | null> {
  const tickers = [...new Set(rawHoldingTickers.map((t) => t.trim().toUpperCase()).filter(Boolean))]
    .filter((t) => t !== targetTicker.toUpperCase())
    .slice(0, MAX_HOLDINGS);
  if (tickers.length === 0) return null;

  const results = await Promise.all(
    tickers.map(async (t) => {
      const m = await getMarketData(t).catch(() => null);
      if (!m) return { ticker: t, correlation: null, overlapDays: 0 };
      const { correlation, overlapDays } = correlateReturns(target.history, m.history);
      return { ticker: t, correlation, overlapDays };
    })
  );

  const valid = results.filter((r): r is HoldingCorrelation & { correlation: number } => r.correlation !== null);
  const avgAbsCorrelation = valid.length
    ? Math.round((valid.reduce((s, r) => s + Math.abs(r.correlation), 0) / valid.length) * 100) / 100
    : null;
  const maxEntry = valid.length
    ? valid.reduce((a, b) => (Math.abs(b.correlation) > Math.abs(a.correlation) ? b : a))
    : null;

  return {
    tickers,
    correlations: results,
    avgAbsCorrelation,
    maxCorrelation: maxEntry ? { ticker: maxEntry.ticker, correlation: maxEntry.correlation } : null,
  };
}
