// Market screener. Universe = the N largest SEC filers taken from the SEC's
// own company_tickers.json ordering (P0, market-cap descending) — not a
// hand-picked watchlist, so there is no fame bias. The remaining bias is
// large-cap bias, and the UI states it.
//
// Each name runs the FULL committee pipeline (SEC XBRL + FRED + delayed
// quotes) via analyzeTicker; the screener only summarizes the output.
//
// Sort: sortScore = committee score + 0.3×confidence − 10×vetoes
//                   + quality bonus (A +5 / B 0 / C −5 / D −10)
// Conviction first; thin evidence and vetoes push a name down.
import { analyzeTicker } from "@/lib/analyze";
import { fetchJsonRobust } from "@/lib/fetcher";
import type { OverallRating } from "@/lib/types";

export const UNIVERSE_SIZE = 100;
export const BATCH_SIZE = 8;

export interface ScreenerRow {
  ticker: string;
  name: string;
  sector: string;
  rating: OverallRating;
  score: number;
  sortScore: number;
  confidence: number;
  evidenceQuality: "A" | "B" | "C" | "D";
  vetoCount: number;
  price: number | null;
  momentum12m: number | null;
  pe: number | null;
  generatedAt: string;
}

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let universeCache: { list: { ticker: string; name: string }[]; expires: number } | null = null;

export async function getUniverse(): Promise<{ ticker: string; name: string }[]> {
  if (universeCache && universeCache.expires > Date.now()) return universeCache.list;
  const { data } = await fetchJsonRobust<Record<string, TickerEntry>>(
    "https://www.sec.gov/files/company_tickers.json",
    { ua: "sec", ttlMs: 24 * 60 * 60 * 1000 }
  );
  const list = Object.values(data)
    .slice(0, UNIVERSE_SIZE)
    .map((e) => ({ ticker: e.ticker, name: e.title }));
  universeCache = { list, expires: Date.now() + 24 * 60 * 60 * 1000 };
  return list;
}

// Coarse sector buckets from SEC SIC descriptions.
const SECTOR_RULES: [RegExp, string][] = [
  [/semiconductor/i, "Semiconductors"],
  [/software|computer|electronic|data processing|internet|information/i, "Technology"],
  [/pharmaceutical|biological|medical|health|surgical|diagnostic/i, "Healthcare"],
  [/bank|finance|credit|insurance|investment|broker|savings|asset/i, "Financials"],
  [/petroleum|crude|oil|natural gas|drilling|energy/i, "Energy"],
  [/retail|food|beverage|apparel|restaurant|consumer|cosmetic|household|tobacco/i, "Consumer"],
  [/motor|aircraft|aerospace|machinery|industrial|construction|engine|defense|transport|railroad|air courier/i, "Industrials"],
  [/telephone|communication|broadcast|media|telecom|cable|entertainment/i, "Communications"],
  [/real estate|reit/i, "Real Estate"],
  [/chemical|mining|metal|steel|paper|gold|material/i, "Materials"],
  [/electric|utilit|power|water supply/i, "Utilities"],
];

export function sectorBucket(sic: string | undefined | null): string {
  if (!sic) return "Other";
  for (const [re, bucket] of SECTOR_RULES) if (re.test(sic)) return bucket;
  return "Other";
}

const QUALITY_BONUS = { A: 5, B: 0, C: -5, D: -10 } as const;

/**
 * Screens universe[offset, offset+limit). Returns summary rows for names
 * where the pipeline produced enough data (financials + quotes); names with
 * insufficient data (e.g. foreign filers on 20-F) are skipped.
 */
export async function screenBatch(
  offset: number,
  limit: number
): Promise<{ total: number; rows: ScreenerRow[]; skipped: string[] }> {
  const universe = await getUniverse();
  const slice = universe.slice(offset, offset + limit);
  const rows: ScreenerRow[] = [];
  const skipped: string[] = [];

  // Pool of 4 with a stagger keeps us inside SEC's 10 req/s guidance.
  const POOL = 4;
  for (let i = 0; i < slice.length; i += POOL) {
    const chunk = slice.slice(i, i + POOL);
    const results = await Promise.all(
      chunk.map(async (u) => {
        try {
          const r = await analyzeTicker(u.ticker);
          return { u, r };
        } catch {
          return { u, r: null };
        }
      })
    );
    for (const { u, r } of results) {
      // require real financials + a live quote, otherwise the rating is noise
      if (!r || r.financials.length === 0 || !r.quant) {
        skipped.push(u.ticker);
        continue;
      }
      const d = r.decision;
      const sortScore =
        d.score +
        0.3 * d.confidence -
        10 * d.vetoesApplied.length +
        QUALITY_BONUS[d.evidenceQuality];
      rows.push({
        ticker: r.asset.ticker,
        name: r.asset.name,
        sector: sectorBucket(r.asset.sector),
        rating: d.overallRating,
        score: d.score,
        sortScore: Math.round(sortScore * 10) / 10,
        confidence: d.confidence,
        evidenceQuality: d.evidenceQuality,
        vetoCount: d.vetoesApplied.length,
        price: r.quant?.lastPrice ?? null,
        momentum12m: r.quant?.momentum12m ?? null,
        pe:
          (r.evidence.find((e) => e.metricName === "pe_trailing")
            ?.metricValue as number | undefined) ?? null,
        generatedAt: r.generatedAt,
      });
    }
    if (i + POOL < slice.length) await new Promise((res) => setTimeout(res, 300));
  }

  return { total: universe.length, rows, skipped };
}
