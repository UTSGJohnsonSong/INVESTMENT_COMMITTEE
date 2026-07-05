import { NextResponse } from "next/server";

// TEMPORARY diagnostic: probe FRED directly from the server (i.e. from Vercel's
// egress) so we can see what the deployed function actually gets back — status
// code, timeout, block page, or a healthy CSV — plus the egress IP/region. This
// answers "can Vercel reach FRED at all", which the macro panel depends on.
// Safe to delete once the FRED issue is resolved. No secrets, read-only.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SERIES = ["DGS10", "BAMLH0A0HYM2"];

export async function GET() {
  const out: Record<string, unknown> = {
    now: new Date().toISOString(),
    vercelRegion: process.env.VERCEL_REGION ?? null,
    node: process.version,
  };

  try {
    const ipr = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    out.egressIp = (await ipr.text()).slice(0, 120);
  } catch (e) {
    out.egressIp = `err: ${(e as Error).name}: ${(e as Error).message}`;
  }

  const results: unknown[] = [];
  for (const id of SERIES) {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
    const started = Date.now();
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json,text/csv,*/*" },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      const body = await r.text();
      results.push({
        id,
        status: r.status,
        ok: r.ok,
        ms: Date.now() - started,
        len: body.length,
        contentType: r.headers.get("content-type"),
        head: body.slice(0, 100),
      });
    } catch (e) {
      results.push({
        id,
        ms: Date.now() - started,
        error: `${(e as Error).name}: ${(e as Error).message}`,
      });
    }
  }
  out.fred = results;

  return NextResponse.json(out, {
    headers: { "cache-control": "no-store" },
  });
}
