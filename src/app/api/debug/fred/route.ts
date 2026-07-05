import { NextResponse } from "next/server";

// TEMPORARY diagnostic: probe candidate macro data sources directly from
// Vercel's egress, in parallel with short timeouts, to see which are reachable
// from the deployment (FRED is IP-blocked). Determines the replacement sources.
// Safe to delete once resolved. No secrets, read-only.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SEC_UA = "InvestmentCommittee/0.1 research zeksong0914@gmail.com";

const TARGETS: { name: string; url: string; ua?: string }[] = [
  // Fed funds effective rate (replaces DFF)
  { name: "nyfed-effr", url: "https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json" },
  // Treasury par yield curve (replaces DGS10/DGS2, derive T10Y2Y)
  { name: "treasury-xml", url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=202506" },
  // BLS: CPI (CUUR0000SA0) and unemployment (LNS14000000)
  { name: "bls-v2-cpi", url: "https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0" },
  { name: "bls-v1-cpi", url: "https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0" },
  // SEC with the PROPER app UA — confirm asset pages' data path works
  { name: "sec-proper-ua", url: "https://www.sec.gov/files/company_tickers.json", ua: SEC_UA },
  // FRED for comparison (expected: hang/timeout)
  { name: "fred", url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10" },
];

async function probe(url: string, ua: string) {
  const started = Date.now();
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": ua, Accept: "application/json,text/csv,application/xml,*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await r.text();
    return {
      status: r.status,
      ok: r.ok,
      ms: Date.now() - started,
      len: body.length,
      contentType: r.headers.get("content-type"),
      head: body.slice(0, 80),
    };
  } catch (e) {
    return { ms: Date.now() - started, error: `${(e as Error).name}: ${(e as Error).message}` };
  }
}

export async function GET() {
  const results = await Promise.all(
    TARGETS.map(async (t) => ({
      target: t.name,
      ...(await probe(t.url, t.ua ?? BROWSER_UA)),
    }))
  );
  return NextResponse.json(
    { now: new Date().toISOString(), vercelRegion: process.env.VERCEL_REGION ?? null, results },
    { headers: { "cache-control": "no-store" } }
  );
}
