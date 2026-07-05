# Investment Committee

### 🔴 Live demo → **https://investment-committee.vercel.app**

> Try it now, no setup required. Search any US stock/ETF, read the committee debate, and trace every claim back to its source.

[![Live Demo](https://img.shields.io/badge/Live_Demo-investment--committee.vercel.app-black?style=for-the-badge&logo=vercel)](https://investment-committee.vercel.app)

An evidence-first investment decision support system. Eight committee members — decision frameworks inspired by published investment philosophies — debate the same body of primary-source evidence and synthesize a structured decision with vetoes, scenario ranges and kill criteria.

**Not a stock recommendation site.** The soul of the system is evidence management: every claim traces back to an evidence row with a source, URL and timestamp. Unsourced sentences can only be labeled as inference.

## Quick start

```bash
npm install
npm run dev   # http://localhost:3000
```

No API keys required — all data sources are key-free official/public endpoints, fetched live at runtime.

## Data sources (source hierarchy)

| Level | Source | Used for |
|-------|--------|----------|
| P0 | SEC EDGAR (company_tickers / submissions / XBRL companyfacts) | Financial facts, with accession number + form type + filed date |
| P0 | FRED public `fredgraph.csv` endpoint | DGS10 / DGS2 / T10Y2Y / DFF / CPI / UNRATE / HY OAS, with series ID + observation date |
| P1 | Yahoo Finance chart API (delayed quotes) | Price, momentum, volatility, drawdown; labeled *delayed* everywhere |

Local dev note: some networks TLS-fingerprint-block Node's fetch for Yahoo; `src/lib/fetcher.ts` automatically falls back to a curl subprocess. On Vercel, native fetch normally works.

## Architecture: one-way data flow

```
sources → Evidence[] (cited) → 8 persona pure functions → synthesis (vetoes) → FinalDecision
```

- `src/lib/sources/` — SEC / FRED / market data fetchers
- `src/lib/metrics.ts` — extracts revenue/EPS/FCF/margins from XBRL; every number carries a citation and period metadata (annual / quarterly / instant, reported / derived)
- `src/lib/evidence.ts` — assembles the evidence table; committee members may only consume these rows
- `src/lib/committee/` — 8 members (Bogle / Markowitz / Buffett / Marks / Dalio / Taleb / Simons-style quant / Soros), deterministic rule engines, zero hallucination; the interface is designed so an LLM can replace them later (an LLM would also only see the evidence table)
- `src/lib/committee/synthesis.ts` — direction/constraint separation: five direction members vote the score; Bogle / Markowitz / Taleb are constraint members controlling vetoes, position caps and confidence. Standing vetoes: Taleb tail risk, Marks market-greed (blocks Strong Buy), Bogle no-edge (index substitution), Buffett quality gate, Simons data-contradiction
- `src/lib/screener.ts` — scans the largest SEC filers (official market-cap ordering, no hand-picking) through the full pipeline
- `src/lib/basket.ts` — portfolio-level review of a user basket: per-name allocations under Taleb caps, Bogle core-first, Marks cash floor
- `src/db/schema.ts` — Drizzle Postgres schema (7 tables); wire up Neon with `npx drizzle-kit push`. The MVP runtime uses in-memory caching and does not require a database

## Pages

- `/` — Dashboard: search any US stock/ETF/index, live macro environment, watchlist
- `/asset/[ticker]` — full research page: decision panel with scenario ranges, price chart, grouped financial snapshot with data-quality badges, committee debate cards, filterable evidence panel with citation drawer
- `/screener` — committee screener over the 100 largest SEC filers, grouped by sector, transparent sort formula
- `/strategy` — no ticker: the committee debates current positioning and produces three risk-tiered plans (Conservative / Balanced / Aggressive) with adjustment rules, cash deployment rules and monitoring checklists
- `/basket` — shopping-basket workflow: collect candidates, submit the basket for a portfolio-level committee review with per-name allocations
- `/memo/[ticker]` — copyable professional decision memo, citations sorted P0-first
- `/portfolio` — simplified portfolio impact (concentration, before/after weights)
- `/guide` — methodology, source hierarchy, badge glossary, committee profiles, full disclaimer

## Internationalization

English by default; full Chinese via the header toggle (cookie-based). All engine-generated prose is bilingual at the source (`{en, zh}` pairs) — the Chinese mode is a complete translation, not a partial one.

## Explicitly mocked (never fake numbers)

- Markowitz correlation assumptions (0.8 / 0.95 placeholders)
- Simons-style historical backtests and factor exposures
- Portfolio page correlation matrix / sector look-through

Principle: mocks show a labeled placeholder note, never fabricated figures.

## Smoke test

```bash
npx tsx scripts/smoke.ts   # runs the full pipeline on AAPL and prints evidence / votes / synthesis
```

---

This is not financial advice. This tool is for research and decision support only.
