// Market data (source level P1, delayed). Primary: Yahoo Finance chart
// endpoint. Fallback: Stooq end-of-day CSV (equities/ETFs only — index
// symbology differs). Both go through the robust fetcher (both TLS-block
// Node locally; curl fallback covers it). Every quote is labeled delayed
// with its regularMarketTime, and the actual source is carried on the
// record so citations name what really served the data.
import { fetchJsonRobust, fetchTextRobust } from "@/lib/fetcher";
import type { PricePoint, QuantStats } from "@/lib/types";

interface YahooChart {
  chart: {
    result: {
      meta: {
        symbol: string;
        currency: string;
        regularMarketPrice: number;
        regularMarketTime: number;
        exchangeName: string;
        fullExchangeName?: string;
        instrumentType: string;
        longName?: string;
        shortName?: string;
        marketState?: string;
        fiftyTwoWeekHigh?: number;
      };
      timestamp: number[];
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
    error: unknown;
  };
}

export interface MarketData {
  name: string | null;
  exchange: string | null;
  instrumentType: string;
  currency: string;
  lastPrice: number;
  lastPriceTime: string;
  marketState: string;
  history: PricePoint[];
  retrievedAt: string;
  sourceUrl: string;
  /** which provider actually served this run (for citations) */
  sourceName: string;
  /** true when served from an expired cache entry after live fetches failed */
  stale: boolean;
}

async function getYahooData(ticker: string): Promise<MarketData | null> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=1y&interval=1d`;
  try {
    const { data, retrievedAt, stale } = await fetchJsonRobust<YahooChart>(url, {
      ttlMs: 10 * 60 * 1000,
    });
    const res = data.chart?.result?.[0];
    if (!res) return null;
    const closes = res.indicators.quote[0].close;
    const history: PricePoint[] = [];
    for (let i = 0; i < res.timestamp.length; i++) {
      const c = closes[i];
      if (c === null || c === undefined) continue;
      history.push({
        date: new Date(res.timestamp[i] * 1000).toISOString().slice(0, 10),
        close: Math.round(c * 100) / 100,
      });
    }
    return {
      name: res.meta.longName ?? res.meta.shortName ?? null,
      exchange: res.meta.fullExchangeName ?? res.meta.exchangeName ?? null,
      instrumentType: res.meta.instrumentType,
      currency: res.meta.currency,
      lastPrice: res.meta.regularMarketPrice,
      lastPriceTime: new Date(res.meta.regularMarketTime * 1000).toISOString(),
      marketState: res.meta.marketState ?? "UNKNOWN",
      history,
      retrievedAt,
      sourceUrl: url,
      sourceName: "Yahoo Finance chart API (delayed)",
      stale,
    };
  } catch {
    return null;
  }
}

// Stooq serves end-of-day daily bars as CSV: Date,Open,High,Low,Close,Volume.
// US listings use the ".us" suffix. Index symbology differs from Yahoo's
// caret tickers, so the fallback covers equities/ETFs only.
async function getStooqData(ticker: string): Promise<MarketData | null> {
  if (ticker.startsWith("^")) return null;
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const now = new Date();
  const yearAgo = new Date(now.getTime() - 380 * 86400000);
  const symbol = `${ticker.toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d&d1=${fmt(yearAgo)}&d2=${fmt(now)}`;
  try {
    const { body, retrievedAt, stale } = await fetchTextRobust(url, {
      ttlMs: 10 * 60 * 1000,
      validate: (b) => b.trimStart().toLowerCase().startsWith("date,"),
    });
    const lines = body.trim().split("\n");
    const history: PricePoint[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const close = parseFloat(cols[4]);
      if (!cols[0] || Number.isNaN(close)) continue;
      history.push({ date: cols[0], close: Math.round(close * 100) / 100 });
    }
    if (history.length < 2) return null;
    const last = history[history.length - 1];
    return {
      name: null,
      exchange: null,
      instrumentType: "EQUITY",
      currency: "USD",
      lastPrice: last.close,
      lastPriceTime: `${last.date}T00:00:00.000Z`,
      marketState: "EOD",
      history,
      retrievedAt,
      sourceUrl: url,
      sourceName: "Stooq end-of-day CSV (fallback, EOD close)",
      stale,
    };
  } catch {
    return null;
  }
}

export async function getMarketData(ticker: string): Promise<MarketData | null> {
  const yahoo = await getYahooData(ticker);
  // A stale Yahoo answer loses to a live Stooq answer, but beats nothing.
  if (yahoo && !yahoo.stale) return yahoo;
  const stooq = await getStooqData(ticker);
  if (stooq && !stooq.stale) return stooq;
  return yahoo ?? stooq;
}

export function computeQuantStats(m: MarketData): QuantStats {
  const closes = m.history.map((p) => p.close);
  const n = closes.length;
  const last = m.lastPrice;

  const pctFrom = (barsAgo: number): number | null => {
    if (n <= barsAgo) return null;
    const base = closes[n - 1 - barsAgo];
    return Math.round(((last - base) / base) * 10000) / 100;
  };

  let realizedVol: number | null = null;
  if (n > 30) {
    const rets: number[] = [];
    for (let i = 1; i < n; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const varr =
      rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
    realizedVol = Math.round(Math.sqrt(varr) * Math.sqrt(252) * 10000) / 100;
  }

  let maxDrawdown: number | null = null;
  if (n > 30) {
    let peak = closes[0];
    let mdd = 0;
    for (const c of closes) {
      if (c > peak) peak = c;
      const dd = (c - peak) / peak;
      if (dd < mdd) mdd = dd;
    }
    maxDrawdown = Math.round(mdd * 10000) / 100;
  }

  let above200dma: boolean | null = null;
  if (n >= 200) {
    const ma = closes.slice(n - 200).reduce((a, b) => a + b, 0) / 200;
    above200dma = last > ma;
  }

  const high = Math.max(...closes, last);
  const pctFromHigh = Math.round(((last - high) / high) * 10000) / 100;

  return {
    lastPrice: last,
    lastPriceTime: m.lastPriceTime,
    currency: m.currency,
    momentum12m: pctFrom(Math.min(n - 1, 251)),
    momentum3m: pctFrom(Math.min(n - 1, 63)),
    above200dma,
    realizedVol,
    maxDrawdown1y: maxDrawdown,
    pctFromHigh,
    marketState: m.marketState,
    delayed: true,
  };
}
