// SEC EDGAR (source level P0). Three endpoints, all official:
//   company_tickers.json  -> ticker -> CIK resolution
//   /submissions/CIK*.json -> recent filings metadata
//   /api/xbrl/companyfacts -> XBRL financial facts
import { fetchJsonRobust } from "@/lib/fetcher";
import type { FilingRecord } from "@/lib/types";

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

export interface SecIdentity {
  cik: string; // zero-padded to 10
  cikRaw: number;
  name: string;
  ticker: string;
}

export async function resolveTickerToCik(
  ticker: string
): Promise<SecIdentity | null> {
  const { data } = await fetchJsonRobust<Record<string, TickerEntry>>(
    "https://www.sec.gov/files/company_tickers.json",
    { ua: "sec", ttlMs: 24 * 60 * 60 * 1000 }
  );
  const t = ticker.toUpperCase();
  const hit = Object.values(data).find((e) => e.ticker === t);
  if (!hit) return null;
  return {
    cik: String(hit.cik_str).padStart(10, "0"),
    cikRaw: hit.cik_str,
    name: hit.title,
    ticker: t,
  };
}

interface SubmissionsResponse {
  name: string;
  sicDescription?: string;
  filings: {
    recent: {
      accessionNumber: string[];
      form: string[];
      filingDate: string[];
      reportDate: string[];
      primaryDocument: string[];
    };
  };
}

const INTERESTING_FORMS = new Set([
  "10-K",
  "10-Q",
  "8-K",
  "S-1",
  "DEF 14A",
  "13F-HR",
  "4",
]);

export async function getRecentFilings(identity: SecIdentity): Promise<{
  filings: FilingRecord[];
  sicDescription: string | null;
  retrievedAt: string;
}> {
  const { data, retrievedAt } = await fetchJsonRobust<SubmissionsResponse>(
    `https://data.sec.gov/submissions/CIK${identity.cik}.json`,
    { ua: "sec", ttlMs: 30 * 60 * 1000 }
  );
  const r = data.filings.recent;
  const filings: FilingRecord[] = [];
  let form4Count = 0;
  for (let i = 0; i < r.form.length && filings.length < 12; i++) {
    if (!INTERESTING_FORMS.has(r.form[i])) continue;
    // insider Form 4s are frequent; keep only the two most recent
    if (r.form[i] === "4" && ++form4Count > 2) continue;
    const accnNoDash = r.accessionNumber[i].replaceAll("-", "");
    filings.push({
      form: r.form[i],
      filingDate: r.filingDate[i],
      accessionNumber: r.accessionNumber[i],
      primaryDoc: r.primaryDocument[i],
      reportDate: r.reportDate[i] || undefined,
      url: `https://www.sec.gov/Archives/edgar/data/${identity.cikRaw}/${accnNoDash}/${r.primaryDocument[i]}`,
    });
  }
  return {
    filings,
    sicDescription: data.sicDescription ?? null,
    retrievedAt,
  };
}

export interface XbrlFactEntry {
  end: string;
  start?: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
}

export interface CompanyFacts {
  entityName: string;
  facts: {
    "us-gaap"?: Record<
      string,
      { label: string; units: Record<string, XbrlFactEntry[]> }
    >;
    dei?: Record<
      string,
      { label: string; units: Record<string, XbrlFactEntry[]> }
    >;
  };
}

export async function getCompanyFacts(
  identity: SecIdentity
): Promise<{ facts: CompanyFacts; retrievedAt: string }> {
  const { data, retrievedAt } = await fetchJsonRobust<CompanyFacts>(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${identity.cik}.json`,
    { ua: "sec", ttlMs: 60 * 60 * 1000 }
  );
  return { facts: data, retrievedAt };
}

export function filingArchiveUrl(cikRaw: number, accn: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${cikRaw}/${accn.replaceAll("-", "")}/`;
}
