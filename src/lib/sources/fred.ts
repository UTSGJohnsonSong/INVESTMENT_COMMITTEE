// Macro snapshots (source level P0).
//
// FRED (fred.stlouisfed.org) silently drops traffic from cloud/datacenter IP
// ranges, so it is UNREACHABLE from Vercel (verified: connections hang until
// timeout). We therefore fetch each series from its ORIGINAL publisher, which
// is both reachable from datacenters and more authoritative than FRED's mirror:
//   - 10Y / 2Y Treasury yields (+ derived 10Y-2Y curve): U.S. Treasury XML feed
//   - Fed funds effective rate:                          NY Fed reference rates
//   - CPI (YoY) and unemployment rate:                   BLS public API
//   - High-yield OAS (ICE BofA, FRED-exclusive):         FRED, best-effort only;
//     omitted when FRED is unreachable rather than blocking the whole panel.
// Series IDs and the MacroSnapshot shape are unchanged, so every downstream
// consumer (regime notes, evidence table, page display) keeps working as-is.
import { unstable_cache } from "next/cache";
import type { MacroSnapshot } from "@/lib/types";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const round2 = (n: number) => Math.round(n * 100) / 100;

async function getText(
  url: string,
  opts: { timeoutMs?: number; method?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<string> {
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/json,text/csv,application/xml,*/*",
      ...(opts.headers ?? {}),
    },
    body: opts.body,
    cache: "no-store",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
  });
  return res.text();
}

// ---- U.S. Treasury: daily par yield curve (10Y / 2Y) ----------------------

function ym(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseTreasury(
  xml: string
): { date: string; y2: number | null; y10: number | null } | null {
  const entries = xml.split("<entry>").slice(1);
  let best: { date: string; y2: number | null; y10: number | null } | null = null;
  const num = (block: string, tag: string): number | null => {
    const m = new RegExp(`<d:${tag}[^>]*>([^<]*)<`).exec(block);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return Number.isNaN(v) ? null : v;
  };
  for (const e of entries) {
    const dm = /<d:NEW_DATE[^>]*>([^<]+)</.exec(e);
    if (!dm) continue;
    const rec = { date: dm[1].slice(0, 10), y2: num(e, "BC_2YEAR"), y10: num(e, "BC_10YEAR") };
    if (!best || rec.date > best.date) best = rec;
  }
  return best;
}

async function fetchTreasuryYields(): Promise<MacroSnapshot[]> {
  const base =
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=";
  const now = new Date();
  const months = [ym(now), ym(new Date(now.getFullYear(), now.getMonth() - 1, 1))];
  const cite =
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve";

  let latest: { date: string; y2: number | null; y10: number | null } | null = null;
  for (const m of months) {
    try {
      const parsed = parseTreasury(await getText(base + m, { timeoutMs: 8000 }));
      if (parsed && (parsed.y2 !== null || parsed.y10 !== null)) {
        latest = parsed;
        break;
      }
    } catch {
      /* try previous month */
    }
  }
  if (!latest) return [];

  const retrievedAt = new Date().toISOString();
  const base_ = { unit: "%", observationDate: latest.date, retrievedAt, url: cite };
  const out: MacroSnapshot[] = [];
  if (latest.y10 !== null)
    out.push({ seriesId: "DGS10", label: "10Y Treasury Yield", value: round2(latest.y10), sourceName: "U.S. Treasury", ...base_ });
  if (latest.y2 !== null)
    out.push({ seriesId: "DGS2", label: "2Y Treasury Yield", value: round2(latest.y2), sourceName: "U.S. Treasury", ...base_ });
  if (latest.y10 !== null && latest.y2 !== null)
    out.push({
      seriesId: "T10Y2Y",
      label: "10Y-2Y Curve",
      value: round2(latest.y10 - latest.y2),
      sourceName: "U.S. Treasury (derived)",
      derived: `BC_10YEAR ${round2(latest.y10)} − BC_2YEAR ${round2(latest.y2)}`,
      ...base_,
    });
  return out;
}

// ---- NY Fed: effective federal funds rate (replaces FRED DFF) --------------

async function fetchEffr(): Promise<MacroSnapshot | null> {
  try {
    const j = JSON.parse(
      await getText("https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json", { timeoutMs: 8000 })
    );
    const r = j?.refRates?.[0];
    if (!r || typeof r.percentRate !== "number") return null;
    return {
      seriesId: "DFF",
      label: "Fed Funds Rate (effective)",
      value: round2(r.percentRate),
      unit: "%",
      observationDate: String(r.effectiveDate).slice(0, 10),
      retrievedAt: new Date().toISOString(),
      url: "https://www.newyorkfed.org/markets/reference-rates/effr",
      sourceName: "NY Fed (EFFR)",
    };
  } catch {
    return null;
  }
}

// ---- BLS: CPI (YoY) and unemployment rate ----------------------------------

interface BlsObs {
  year: string;
  period: string;
  periodName: string;
  value: string;
}

async function fetchBls(): Promise<MacroSnapshot[]> {
  const now = new Date();
  try {
    const j = JSON.parse(
      await getText("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesid: ["CUUR0000SA0", "LNS14000000"],
          startyear: String(now.getFullYear() - 1),
          endyear: String(now.getFullYear()),
        }),
        timeoutMs: 9000,
      })
    );
    if (j?.status !== "REQUEST_SUCCEEDED") return [];
    const series: { seriesID: string; data: BlsObs[] }[] = j?.Results?.series ?? [];
    const retrievedAt = new Date().toISOString();
    const out: MacroSnapshot[] = [];
    for (const s of series) {
      const data = (s.data ?? []).filter((d) => d.period?.startsWith("M")); // monthly only
      if (data.length === 0) continue;
      const latest = data[0]; // BLS returns most-recent-first
      const val = parseFloat(latest.value);
      if (Number.isNaN(val)) continue;
      const obs = `${latest.year}-${latest.period.slice(1)}`;

      if (s.seriesID === "CUUR0000SA0") {
        // YoY: same calendar month one year earlier
        const prior = data.find((d) => d.period === latest.period && d.year === String(+latest.year - 1));
        const pv = prior ? parseFloat(prior.value) : NaN;
        if (!prior || Number.isNaN(pv)) continue;
        out.push({
          seriesId: "CPIAUCSL",
          label: "CPI YoY",
          value: round2(((val - pv) / pv) * 100),
          unit: "%",
          observationDate: obs,
          retrievedAt,
          url: "https://data.bls.gov/timeseries/CUUR0000SA0",
          sourceName: "BLS (CPI-U)",
          derived: `YoY from ${prior.periodName} ${prior.year} index ${pv} to ${latest.periodName} ${latest.year} index ${val}`,
        });
      } else if (s.seriesID === "LNS14000000") {
        out.push({
          seriesId: "UNRATE",
          label: "Unemployment Rate",
          value: round2(val),
          unit: "%",
          observationDate: obs,
          retrievedAt,
          url: "https://data.bls.gov/timeseries/LNS14000000",
          sourceName: "BLS",
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ---- FRED: high-yield OAS (ICE BofA) — best-effort, short timeout ----------
// FRED-exclusive series; unreachable from Vercel, so this normally returns null
// there and the panel simply omits it. Works in any environment that can reach
// FRED (e.g. local dev).

function parseCsvLast(body: string): { date: string; value: number } | null {
  const lines = body.trim().split("\n");
  for (let i = lines.length - 1; i >= 1; i--) {
    const [date, raw] = lines[i].split(",");
    const v = parseFloat(raw);
    if (!Number.isNaN(v)) return { date, value: v };
  }
  return null;
}

async function fetchHyOas(): Promise<MacroSnapshot | null> {
  try {
    const body = await getText("https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2", {
      timeoutMs: 4000,
    });
    if (!/^(observation_)?date,/i.test(body.trimStart())) return null;
    const last = parseCsvLast(body);
    if (!last) return null;
    return {
      seriesId: "BAMLH0A0HYM2",
      label: "High Yield OAS",
      value: last.value,
      unit: "%",
      observationDate: last.date,
      retrievedAt: new Date().toISOString(),
      url: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
      sourceName: "FRED (ICE BofA)",
    };
  } catch {
    return null;
  }
}

// ---- Assembly + durable cache ---------------------------------------------

const DISPLAY_ORDER = ["DGS10", "DGS2", "T10Y2Y", "DFF", "CPIAUCSL", "UNRATE", "BAMLH0A0HYM2"];

async function fetchMacroSnapshots(): Promise<MacroSnapshot[]> {
  const [treasury, effr, bls, hyoas] = await Promise.all([
    fetchTreasuryYields(),
    fetchEffr(),
    fetchBls(),
    fetchHyOas(),
  ]);
  const all = [...treasury, effr, ...bls, hyoas].filter((x): x is MacroSnapshot => x != null);
  all.sort((a, b) => DISPLAY_ORDER.indexOf(a.seriesId) - DISPLAY_ORDER.indexOf(b.seriesId));
  // A total outage must NOT be cached as an empty panel for the whole window:
  // throw so unstable_cache stores nothing and keeps serving the last good pull
  // (or retries next request) instead of freezing the empty state.
  if (all.length === 0) throw new Error("all macro sources failed");
  return all;
}

// Durable, cross-instance cache (Vercel Data Cache): one successful pull is
// shared across every request and instance for the window. Macro series update
// at most daily, so two hours is plenty fresh and keeps BLS well under its
// keyless daily request budget.
const getMacroCached = unstable_cache(fetchMacroSnapshots, ["macro-snapshots-v2"], {
  revalidate: 2 * 60 * 60,
});

export async function getMacroSnapshots(): Promise<MacroSnapshot[]> {
  try {
    return await getMacroCached();
  } catch (e) {
    // Outside the Next.js server runtime (scripts/tests) unstable_cache throws
    // "incrementalCache missing" before running — fall back to an uncached
    // pull. On a real outage the inner throw also lands here; return [] so
    // callers render the honest "temporarily unavailable" state.
    if (e instanceof Error && e.message.includes("incrementalCache missing")) {
      try {
        return await fetchMacroSnapshots();
      } catch {
        return [];
      }
    }
    return [];
  }
}
