// Market data (source level P1, delayed). Yahoo Finance chart endpoint via
// the robust fetcher (Yahoo TLS-blocks Node locally; curl fallback covers it).
// Every quote is labeled delayed with its regularMarketTime.
import { fetchJsonRobust } from "@/lib/fetcher";
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
}

export async function getMarketData(ticker: string): Promise<MarketData | null> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=1y&interval=1d`;
  try {
    const { data, retrievedAt } = await fetchJsonRobust<YahooChart>(url, {
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
    };
  } catch {
    return null;
  }
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
