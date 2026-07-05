import { NextResponse } from "next/server";

// TEMPORARY diagnostic: probe several hosts directly from Vercel's egress, in
// PARALLEL with short per-probe timeouts, so the route always returns quickly
// with a per-host verdict (healthy / status code / hang-then-timeout). This
// distinguishes "only FRED is blocked" from "all egress is broken", which
// determines the fix. Safe to delete once resolved. No secrets, read-only.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const TARGETS: { name: string; url: string }[] = [
  { name: "egress-ip", url: "https://api.ipify.org?format=json" },
  { name: "control-example", url: "https://example.com/" },
  { name: "fred", url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10" },
  { name: "sec", url: "https://www.sec.gov/files/company_tickers.json" },
  { name: "fred-api-host", url: "https://api.stlouisfed.org/" },
  { name: "yahoo", url: "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=1d" },
];

async function probe(url: string) {
  const started = Date.now();
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json,text/csv,*/*" },
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
    return {
      ms: Date.now() - started,
      error: `${(e as Error).name}: ${(e as Error).message}`,
    };
  }
}

export async function GET() {
  const results = await Promise.all(
    TARGETS.map(async (t) => ({ target: t.name, url: t.url, ...(await probe(t.url)) }))
  );
  return NextResponse.json(
    {
      now: new Date().toISOString(),
      vercelRegion: process.env.VERCEL_REGION ?? null,
      node: process.version,
      results,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
