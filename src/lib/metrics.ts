// Derives normalized financial metrics from SEC XBRL company facts.
// Every metric keeps the accession number, form type, filed date and period
// end of the filing it came from — the citation rules make this mandatory.
import type { CompanyFacts, XbrlFactEntry } from "@/lib/sources/sec";
import { filingArchiveUrl } from "@/lib/sources/sec";
import type { Citation, FinancialMetric } from "@/lib/types";

// XBRL tag fallback chains: companies use different tags for the same concept.
const TAGS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
  ],
  netIncome: ["NetIncomeLoss"],
  epsDiluted: ["EarningsPerShareDiluted"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"],
  grossProfit: ["GrossProfit"],
  totalDebt: ["LongTermDebt", "LongTermDebtNoncurrent"],
  cash: ["CashAndCashEquivalentsAtCarryingValue"],
  equity: ["StockholdersEquity"],
} as const;

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}

function getEntries(
  facts: CompanyFacts,
  tags: readonly string[]
): { entries: XbrlFactEntry[]; unit: string } | null {
  const gaap = facts.facts["us-gaap"];
  if (!gaap) return null;
  for (const tag of tags) {
    const fact = gaap[tag];
    if (!fact) continue;
    for (const unit of ["USD", "USD/shares"]) {
      if (fact.units[unit]?.length) return { entries: fact.units[unit], unit };
    }
  }
  return null;
}

/** Latest annual (FY, ~365d span, 10-K) values, newest first, deduped by period end. */
function annualSeries(entries: XbrlFactEntry[]): XbrlFactEntry[] {
  const fy = entries.filter(
    (e) =>
      e.form === "10-K" &&
      e.fp === "FY" &&
      e.start &&
      daysBetween(e.start, e.end) > 300
  );
  const byEnd = new Map<string, XbrlFactEntry>();
  for (const e of fy) {
    const cur = byEnd.get(e.end);
    if (!cur || e.filed > cur.filed) byEnd.set(e.end, e);
  }
  return [...byEnd.values()].sort((a, b) => (a.end < b.end ? 1 : -1));
}

/** Latest quarterly (~90d span) values, newest first. */
function quarterlySeries(entries: XbrlFactEntry[]): XbrlFactEntry[] {
  const q = entries.filter(
    (e) => e.start && daysBetween(e.start, e.end) < 120
  );
  const byEnd = new Map<string, XbrlFactEntry>();
  for (const e of q) {
    const cur = byEnd.get(e.end);
    if (!cur || e.filed > cur.filed) byEnd.set(e.end, e);
  }
  return [...byEnd.values()].sort((a, b) => (a.end < b.end ? 1 : -1));
}

/** Balance sheet items are instants (no start). Newest first. */
function instantSeries(entries: XbrlFactEntry[]): XbrlFactEntry[] {
  const inst = entries.filter((e) => !e.start);
  const byEnd = new Map<string, XbrlFactEntry>();
  for (const e of inst) {
    const cur = byEnd.get(e.end);
    if (!cur || e.filed > cur.filed) byEnd.set(e.end, e);
  }
  return [...byEnd.values()].sort((a, b) => (a.end < b.end ? 1 : -1));
}

function makeCitation(
  e: XbrlFactEntry,
  cikRaw: number,
  retrievedAt: string,
  excerpt: string
): Citation {
  return {
    sourceName: `SEC EDGAR ${e.form} (XBRL company facts)`,
    sourceUrl: filingArchiveUrl(cikRaw, e.accn),
    sourceLevel: "P0",
    sourceType: "sec_filing",
    publishedAt: e.filed,
    retrievedAt,
    accessionNumber: e.accn,
    formType: e.form,
    periodEnd: e.end,
    excerpt,
  };
}

function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function periodLabel(e: XbrlFactEntry, kind: "annual" | "quarter" | "instant") {
  if (kind === "annual") return `FY${e.fy}`;
  if (kind === "quarter") return `${e.fp} FY${e.fy}`;
  return `as of ${e.end}`;
}

export function deriveFinancials(
  facts: CompanyFacts,
  cikRaw: number,
  retrievedAt: string
): FinancialMetric[] {
  const out: FinancialMetric[] = [];

  const pushFlow = (
    key: keyof typeof TAGS,
    name: string,
    label: string,
    opts: { quarterly?: boolean; perShare?: boolean } = {}
  ): XbrlFactEntry[] | null => {
    const found = getEntries(facts, TAGS[key]);
    if (!found) return null;
    const series = annualSeries(found.entries);
    if (series.length === 0) return null;
    const latest = series[0];
    const prior = series[1];
    const yoy =
      prior && prior.val !== 0
        ? Math.round(((latest.val - prior.val) / Math.abs(prior.val)) * 10000) /
          100
        : null;
    const isPerShare = opts.perShare ?? false;
    out.push({
      name,
      label,
      value: latest.val,
      unit: isPerShare ? "USD/share" : "USD",
      period: periodLabel(latest, "annual"),
      periodEnd: latest.end,
      periodType: "annual",
      basis: "reported",
      yoyChange: yoy,
      citation: makeCitation(
        latest,
        cikRaw,
        retrievedAt,
        `${label} ${periodLabel(latest, "annual")}: ${
          isPerShare ? `$${latest.val}` : fmtUsd(latest.val)
        } (period ${latest.start} to ${latest.end})`
      ),
    });

    if (opts.quarterly) {
      const q = quarterlySeries(found.entries);
      if (q.length > 0) {
        const latestQ = q[0];
        // same fiscal quarter one year earlier for the YoY comparison
        const priorQ = q.find(
          (e) =>
            e.end !== latestQ.end &&
            Math.abs(daysBetween(e.end, latestQ.end) - 365) < 20
        );
        const qYoy =
          priorQ && priorQ.val !== 0
            ? Math.round(
                ((latestQ.val - priorQ.val) / Math.abs(priorQ.val)) * 10000
              ) / 100
            : null;
        out.push({
          name: `${name}_q`,
          label: `${label} (latest quarter)`,
          value: latestQ.val,
          unit: isPerShare ? "USD/share" : "USD",
          period: periodLabel(latestQ, "quarter"),
          periodEnd: latestQ.end,
          periodType: "quarterly",
          basis: "reported",
          yoyChange: qYoy,
          citation: makeCitation(
            latestQ,
            cikRaw,
            retrievedAt,
            `${label} ${periodLabel(latestQ, "quarter")}: ${
              isPerShare ? `$${latestQ.val}` : fmtUsd(latestQ.val)
            } (period ${latestQ.start} to ${latestQ.end})`
          ),
        });
      }
    }
    return series;
  };

  const revSeries = pushFlow("revenue", "revenue", "Revenue", {
    quarterly: true,
  });
  const niSeries = pushFlow("netIncome", "net_income", "Net Income", {
    quarterly: true,
  });
  pushFlow("epsDiluted", "eps_diluted", "Diluted EPS", { perShare: true });
  const ocfSeries = pushFlow(
    "operatingCashFlow",
    "operating_cash_flow",
    "Operating Cash Flow"
  );
  const gpFound = getEntries(facts, TAGS.grossProfit);
  const capexFound = getEntries(facts, TAGS.capex);

  // Free cash flow = OCF - capex, matched on the same annual period.
  if (ocfSeries && capexFound) {
    const capexSeries = annualSeries(capexFound.entries);
    const ocf = ocfSeries[0];
    const capex = capexSeries.find((e) => e.end === ocf.end);
    if (capex) {
      const fcf = ocf.val - capex.val;
      const ocfPrior = ocfSeries[1];
      const capexPrior = ocfPrior
        ? capexSeries.find((e) => e.end === ocfPrior.end)
        : undefined;
      const fcfPrior =
        ocfPrior && capexPrior ? ocfPrior.val - capexPrior.val : null;
      out.push({
        name: "free_cash_flow",
        label: "Free Cash Flow (OCF − capex)",
        value: fcf,
        unit: "USD",
        period: periodLabel(ocf, "annual"),
        periodEnd: ocf.end,
        periodType: "annual",
        basis: "derived",
        yoyChange:
          fcfPrior && fcfPrior !== 0
            ? Math.round(((fcf - fcfPrior) / Math.abs(fcfPrior)) * 10000) / 100
            : null,
        citation: makeCitation(
          ocf,
          cikRaw,
          retrievedAt,
          `FCF ${periodLabel(ocf, "annual")} = OCF ${fmtUsd(ocf.val)} − capex ${fmtUsd(capex.val)} = ${fmtUsd(fcf)}`
        ),
      });
    }
  }

  // Margins (derived, cited to the filings both numerator and denominator came from)
  if (revSeries && niSeries) {
    const rev = revSeries[0];
    const ni = niSeries.find((e) => e.end === rev.end);
    if (ni && rev.val !== 0) {
      out.push({
        name: "net_margin",
        label: "Net Margin",
        value: Math.round((ni.val / rev.val) * 10000) / 100,
        unit: "%",
        period: periodLabel(rev, "annual"),
        periodEnd: rev.end,
        periodType: "annual",
        basis: "derived",
        yoyChange: null,
        citation: makeCitation(
          ni,
          cikRaw,
          retrievedAt,
          `Net margin ${periodLabel(rev, "annual")} = ${fmtUsd(ni.val)} / ${fmtUsd(rev.val)}`
        ),
      });
    }
  }
  if (revSeries && gpFound) {
    const gp = annualSeries(gpFound.entries);
    const rev = revSeries[0];
    const g = gp.find((e) => e.end === rev.end);
    if (g && rev.val !== 0) {
      out.push({
        name: "gross_margin",
        label: "Gross Margin",
        value: Math.round((g.val / rev.val) * 10000) / 100,
        unit: "%",
        period: periodLabel(rev, "annual"),
        periodEnd: rev.end,
        periodType: "annual",
        basis: "derived",
        yoyChange: null,
        citation: makeCitation(
          g,
          cikRaw,
          retrievedAt,
          `Gross margin ${periodLabel(rev, "annual")} = ${fmtUsd(g.val)} / ${fmtUsd(rev.val)}`
        ),
      });
    }
  }

  // Capex intensity (derived): how capital-heavy the business is, matched to
  // the same annual period as revenue. Used by the business-quality persona
  // to distinguish an asset-light moat (brand/IP/switching costs) from a
  // capital-intensive one (scale, vulnerable to capex-cycle downturns).
  if (revSeries && capexFound) {
    const capexSeries = annualSeries(capexFound.entries);
    const rev = revSeries[0];
    const capex = capexSeries.find((e) => e.end === rev.end);
    if (capex && rev.val !== 0) {
      out.push({
        name: "capex_intensity",
        label: "Capex Intensity (capex / revenue)",
        value: Math.round((capex.val / rev.val) * 10000) / 100,
        unit: "%",
        period: periodLabel(rev, "annual"),
        periodEnd: rev.end,
        periodType: "annual",
        basis: "derived",
        yoyChange: null,
        citation: makeCitation(
          capex,
          cikRaw,
          retrievedAt,
          `Capex intensity ${periodLabel(rev, "annual")} = ${fmtUsd(capex.val)} / ${fmtUsd(rev.val)}`
        ),
      });
    }
  }

  // Balance sheet instants
  const pushInstant = (key: keyof typeof TAGS, name: string, label: string) => {
    const found = getEntries(facts, TAGS[key]);
    if (!found) return;
    const series = instantSeries(found.entries);
    if (series.length === 0) return;
    const latest = series[0];
    out.push({
      name,
      label,
      value: latest.val,
      unit: "USD",
      period: periodLabel(latest, "instant"),
      periodEnd: latest.end,
      periodType: "instant",
      basis: "reported",
      yoyChange: null,
      citation: makeCitation(
        latest,
        cikRaw,
        retrievedAt,
        `${label} as of ${latest.end}: ${fmtUsd(latest.val)}`
      ),
    });
  };
  pushInstant("totalDebt", "total_debt", "Long-Term Debt");
  pushInstant("cash", "cash", "Cash & Equivalents");
  pushInstant("equity", "equity", "Stockholders' Equity");

  return out;
}

export { fmtUsd };
