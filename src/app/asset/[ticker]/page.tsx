import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { analyzeTicker, getEnrichedCommittee } from "@/lib/analyze";
import { PERSONAS, PERSONA_ORDER } from "@/lib/committee/meta";
import type { PersonaId, PersonaOpinion } from "@/lib/types";
import { Lang, langFromCookie, pick } from "@/lib/i18n";
import { EvidenceProvider } from "@/components/evidence-drawer";
import { EvidencePanel } from "@/components/evidence-panel";
import { CommitteeCard } from "@/components/committee-card";
import { DecisionPanel } from "@/components/decision-panel";
import { PriceChart } from "@/components/price-chart";
import {
  DataBadge,
  Panel,
  SourceLevelBadge,
  WarnBadge,
  fmtCompact,
  directionColor,
} from "@/components/ui";
import { Chips } from "@/components/evidence-drawer";
import { WhatChanged } from "@/components/what-changed";
import { CartButton } from "@/components/cart";
import { AutoHoldingsParam } from "@/components/auto-holdings-param";
import type { FinancialMetric } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ holdings?: string }>;
}) {
  const { ticker } = await params;
  const { holdings } = await searchParams;
  const holdingTickers = holdings
    ? holdings.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;
  const lang = langFromCookie((await cookies()).get("lang")?.value);
  const zh = lang === "zh";
  // When the LLM deliberation layer is configured, the committee section is
  // streamed in behind Suspense so the deterministic result paints instantly;
  // otherwise there's nothing to wait for and we render it synchronously.
  const llmEnabled = !!process.env.ANTHROPIC_API_KEY;
  const r = await analyzeTicker(decodeURIComponent(ticker), { holdingTickers });
  if (!r) notFound();

  const usedBy: Record<string, PersonaId[]> = {};
  for (const o of r.opinions) {
    for (const id of o.citedEvidenceIds) {
      (usedBy[id] ??= []).push(o.persona);
    }
  }
  const personaNames = Object.fromEntries(
    Object.values(PERSONAS).map((p) => [p.id, p.name])
  );

  const mcap = r.evidence.find((e) => e.metricName === "market_cap");
  const pe = r.evidence.find((e) => e.metricName === "pe_trailing");

  return (
    <EvidenceProvider
      evidence={r.evidence}
      usedBy={usedBy}
      personaNames={personaNames}
      lang={lang}
    >
      <AutoHoldingsParam ticker={r.asset.ticker} hasHoldingsParam={!!holdings} />
      <div className="space-y-5">
        {/* ---- Header ---- */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <h1 className="text-2xl font-bold num">{r.asset.ticker}</h1>
            <p className="text-sm text-muted">
              {r.asset.name}
              {r.asset.sector ? ` · ${r.asset.sector}` : ""}
              {r.asset.exchange ? ` · ${r.asset.exchange}` : ""} ·{" "}
              {r.asset.assetType.toUpperCase()}
            </p>
          </div>
          {r.quant && (
            <div>
              <div className="num text-2xl font-bold">
                {r.quant.lastPrice}{" "}
                <span className="text-sm text-muted">{r.quant.currency}</span>
              </div>
              <div className="text-[11px] text-warn">
                delayed · last updated {r.quant.lastPriceTime.slice(0, 16)}Z
              </div>
            </div>
          )}
          {mcap && typeof mcap.metricValue === "number" && (
            <HeaderStat label="Market cap (derived)">
              {fmtCompact(mcap.metricValue, "USD")}
            </HeaderStat>
          )}
          {pe && typeof pe.metricValue === "number" && (
            <HeaderStat label="Trailing P/E (derived)">
              {pe.metricValue}
            </HeaderStat>
          )}
          <div className="ml-auto flex items-center gap-2">
            <CartButton ticker={r.asset.ticker} name={r.asset.name} lang={lang} />
            <Link
              href="/guide"
              className="text-xs text-muted border border-line rounded px-3 py-1.5 hover:text-foreground hover:border-blue-500/40"
            >
              {zh ? "如何阅读这份分析?" : "How to read this analysis?"}
            </Link>
            <Link
              href={`/memo/${r.asset.ticker}`}
              className="text-xs border border-blue-500/40 bg-blue-500/10 text-blue-400 rounded px-3 py-1.5 hover:bg-blue-500/20"
            >
              {zh ? "生成 Decision Memo →" : "Generate Decision Memo →"}
            </Link>
          </div>
        </div>

        <WhatChanged
          ticker={r.asset.ticker}
          lang={lang}
          current={{
            date: r.generatedAt,
            price: r.quant?.lastPrice ?? null,
            rating: r.decision.overallRating,
            confidence: r.decision.confidence,
            vetoCount: r.decision.vetoesApplied.length,
            latestFiling:
              r.filings.find((f) => f.form === "10-Q" || f.form === "10-K")
                ?.accessionNumber ?? null,
            stances: Object.fromEntries(
              r.opinions.map((o) => [PERSONAS[o.persona].name, o.stance])
            ),
          }}
        />

        {r.dataWarnings.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {r.dataWarnings.map((w, i) => (
              <WarnBadge key={i}>{pick(w, lang)}</WarnBadge>
            ))}
          </div>
        )}

        {/* ---- Decision ---- */}
        <DecisionPanel decision={r.decision} opinions={r.opinions} lang={lang} />

        {/* ---- Chart + financial snapshot ---- */}
        <div className="grid lg:grid-cols-5 gap-5">
          <Panel
            title="Price · 1Y daily"
            className="lg:col-span-3"
            right={<span className="text-[10px] text-muted">P1 · delayed</span>}
          >
            <PriceChart data={r.priceHistory} />
            {r.quant && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3 text-center">
                <QuantStat label="12m" v={r.quant.momentum12m} pctSign />
                <QuantStat label="3m" v={r.quant.momentum3m} pctSign />
                <QuantStat
                  label="200DMA"
                  v={r.quant.above200dma === null ? null : r.quant.above200dma ? 1 : 0}
                  render={(v) => (
                    <span className={v ? "text-bullish" : "text-bearish"}>
                      {v ? "above" : "below"}
                    </span>
                  )}
                />
                <QuantStat label="vol (ann.)" v={r.quant.realizedVol} suffix="%" />
                <QuantStat label="max DD 1y" v={r.quant.maxDrawdown1y} suffix="%" />
                <QuantStat label="vs 1y high" v={r.quant.pctFromHigh} suffix="%" />
              </div>
            )}
          </Panel>

          <Panel title="Financial snapshot · SEC XBRL" className="lg:col-span-2">
            {r.financials.length === 0 ? (
              <p className="text-xs text-muted">
                {zh
                  ? "无 SEC 财务数据(ETF/指数或非申报主体)。"
                  : "No SEC financial data (ETF/index or non-filer)."}
              </p>
            ) : (
              <FinancialSections financials={r.financials} r={r} zh={zh} />
            )}
          </Panel>
        </div>

        {/* ---- Macro + filings ---- */}
        <div className="grid lg:grid-cols-5 gap-5">
          <Panel
            title="Macro environment · FRED"
            className="lg:col-span-3"
            right={<SourceLevelBadge level="P0" />}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {r.macro.map((m) => {
                const e = r.evidence.find(
                  (x) => x.metricName === `macro_${m.seriesId}`
                );
                return (
                  <div
                    key={m.seriesId}
                    className="border border-line rounded p-2.5 bg-panel2/50"
                  >
                    <div className="text-[10px] text-muted">{m.label}</div>
                    <div
                      className={`num text-lg font-semibold ${e ? directionColor(e.direction) : ""}`}
                    >
                      {m.value}
                      {m.unit}
                    </div>
                    <div className="text-[10px] text-muted num">
                      {m.seriesId} · {m.observationDate}{" "}
                      {e && <Chips ids={[e.id]} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Recent SEC filings" className="lg:col-span-2">
            {r.filings.length === 0 ? (
              <p className="text-xs text-muted">
                {zh ? "无 filing 数据。" : "No filing data."}
              </p>
            ) : (
              <ul className="space-y-1.5 text-[13px]">
                {r.filings.map((f) => (
                  <li key={f.accessionNumber} className="flex items-center gap-2">
                    <span className="num text-[11px] border border-line rounded px-1.5 py-0.5 w-16 text-center shrink-0">
                      {f.form}
                    </span>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline truncate"
                    >
                      {f.filingDate}
                      {f.reportDate ? ` (period ${f.reportDate})` : ""}
                    </a>
                    <span className="num text-[10px] text-muted ml-auto shrink-0">
                      {f.accessionNumber}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ---- Committee ---- */}
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-muted uppercase mb-3">
            {zh
              ? "Committee Debate · 委员会辩论 — 八位委员,同一组证据"
              : "Committee Debate — eight members, one body of evidence"}
          </h2>
          {llmEnabled ? (
            <Suspense
              fallback={
                <CommitteeGrid
                  opinions={r.opinions}
                  personaNames={personaNames}
                  lang={lang}
                  pending
                />
              }
            >
              <CommitteeCards
                ticker={r.asset.ticker}
                holdingTickers={holdingTickers ?? []}
                base={r.opinions}
                personaNames={personaNames}
                lang={lang}
              />
            </Suspense>
          ) : (
            <CommitteeGrid
              opinions={r.opinions}
              personaNames={personaNames}
              lang={lang}
            />
          )}
        </div>

        {/* ---- Evidence panel ---- */}
        <Panel
          title={
            zh
              ? `Evidence Panel · 证据面板 (${r.evidence.length})`
              : `Evidence Panel (${r.evidence.length})`
          }
          right={
            <span className="text-[10px] text-muted">
              generated {r.generatedAt.slice(0, 16)}Z
            </span>
          }
        >
          <EvidencePanel evidence={r.evidence} lang={lang} />
        </Panel>
      </div>
    </EvidenceProvider>
  );
}

// Grouped snapshot: never mix annual / quarterly / balance-sheet / derived
// metrics in one flat list. Each row carries its basis and staleness badges.
function FinancialSections({
  financials,
  r,
  zh,
}: {
  financials: FinancialMetric[];
  r: { evidence: { id: string; metricName?: string }[] };
  zh: boolean;
}) {
  const groups: {
    title: string;
    items: FinancialMetric[];
  }[] = [
    {
      title: zh ? "最新年度 (10-K)" : "Latest Annual (10-K)",
      items: financials.filter((f) => f.periodType === "annual" && f.basis === "reported"),
    },
    {
      title: zh ? "最新季度 (10-Q)" : "Latest Quarter (10-Q)",
      items: financials.filter((f) => f.periodType === "quarterly"),
    },
    {
      title: zh ? "资产负债表快照" : "Balance Sheet Snapshot",
      items: financials.filter((f) => f.periodType === "instant"),
    },
    {
      title: zh ? "衍生指标" : "Derived Metrics",
      items: financials.filter((f) => f.basis === "derived"),
    },
  ];

  const isStale = (f: FinancialMetric) =>
    f.periodType === "quarterly" &&
    (Date.now() - new Date(f.periodEnd).getTime()) / 86400000 > 150;

  return (
    <div className="space-y-3">
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.title}>
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1 flex items-center gap-2">
              {g.title}
              <span className="num normal-case">{g.items[0]?.period}</span>
            </div>
            <table className="w-full text-[13px]">
              <tbody>
                {g.items.map((f) => {
                  const e = r.evidence.find((x) => x.metricName === f.name);
                  return (
                    <tr key={f.name} className="border-b border-line/40 last:border-0">
                      <td className="py-1 text-muted pr-2">
                        {f.label.replace(" (latest quarter)", "")}
                      </td>
                      <td className="py-1 num text-right">
                        {fmtCompact(f.value, f.unit)}
                      </td>
                      <td
                        className={`py-1 num text-right w-16 ${
                          f.yoyChange === null
                            ? "text-muted"
                            : f.yoyChange >= 0
                              ? "text-bullish"
                              : "text-bearish"
                        }`}
                      >
                        {f.yoyChange !== null
                          ? `${f.yoyChange >= 0 ? "+" : ""}${f.yoyChange}%`
                          : ""}
                      </td>
                      <td className="py-1 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <DataBadge kind={f.basis === "derived" ? "derived" : "reported"} />
                          {isStale(f) && <DataBadge kind="stale" />}
                          {e && <Chips ids={[e.id]} />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

// Presentational committee grid, shared by the synchronous path, the Suspense
// fallback (deterministic cards + a "deepening" hint) and the streamed result.
function CommitteeGrid({
  opinions,
  personaNames,
  lang,
  pending = false,
}: {
  opinions: PersonaOpinion[];
  personaNames: Record<string, string>;
  lang: Lang;
  pending?: boolean;
}) {
  return (
    <>
      {pending && (
        <div className="mb-3 inline-flex items-center gap-2 text-[11px] text-muted">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          {lang === "zh"
            ? "LLM 深化审议中,先展示规则引擎结论…"
            : "LLM deliberation in progress — showing rule-engine conclusions…"}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {PERSONA_ORDER.map((pid) => {
          const op = opinions.find((o) => o.persona === pid)!;
          return (
            <CommitteeCard
              key={pid}
              opinion={op}
              meta={PERSONAS[pid]}
              allNames={personaNames}
              lang={lang}
            />
          );
        })}
      </div>
    </>
  );
}

// Async boundary: awaits the LLM-deepened committee (its own cache), falling
// back to the deterministic opinions if the layer is unavailable or errors.
async function CommitteeCards({
  ticker,
  holdingTickers,
  base,
  personaNames,
  lang,
}: {
  ticker: string;
  holdingTickers: string[];
  base: PersonaOpinion[];
  personaNames: Record<string, string>;
  lang: Lang;
}) {
  const enriched = await getEnrichedCommittee(ticker, holdingTickers);
  const opinions = enriched?.opinions ?? base;
  return (
    <>
      {enriched?.warning && (
        <div className="mb-3">
          <WarnBadge>{pick(enriched.warning, lang)}</WarnBadge>
        </div>
      )}
      <CommitteeGrid opinions={opinions} personaNames={personaNames} lang={lang} />
    </>
  );
}

function HeaderStat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="num text-lg font-semibold">{children}</div>
    </div>
  );
}

function QuantStat({
  label,
  v,
  suffix = "",
  pctSign = false,
  render,
}: {
  label: string;
  v: number | null;
  suffix?: string;
  pctSign?: boolean;
  render?: (v: number) => React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted">{label}</div>
      <div
        className={`num text-sm font-semibold ${
          v !== null && pctSign ? (v >= 0 ? "text-bullish" : "text-bearish") : ""
        }`}
      >
        {v === null
          ? "n/a"
          : render
            ? render(v)
            : `${pctSign && v >= 0 ? "+" : ""}${v}${pctSign ? "%" : suffix}`}
      </div>
    </div>
  );
}
