// Core domain types for the Investment Committee.
// The whole system is a one-way pipeline:
//   sources -> Evidence[] -> persona opinions -> synthesis
// Nothing downstream may state a fact that is not traceable to an Evidence id.
// All generated prose is bilingual (L = {en, zh}); numbers/labels that are
// standard financial English stay plain strings.
import type { L } from "@/lib/i18n";

export type SourceLevel = "P0" | "P1" | "P2" | "P3";

export type Direction = "bullish" | "bearish" | "neutral";

export type EvidenceTag =
  | "sec"
  | "financials"
  | "macro"
  | "market"
  | "valuation"
  | "quant"
  | "news"
  | "mock";

export interface Citation {
  sourceName: string;
  sourceUrl: string;
  sourceLevel: SourceLevel;
  /** e.g. "SEC 10-K", "FRED series", "Delayed market data" */
  sourceType: string;
  publishedAt: string; // ISO date of publication / filing / observation
  retrievedAt: string; // ISO datetime we fetched it
  /** SEC-specific */
  accessionNumber?: string;
  formType?: string;
  periodEnd?: string;
  /** Macro-specific */
  seriesId?: string;
  /** verbatim excerpt or the exact reported figure */
  excerpt?: string;
}

export interface Evidence {
  id: string; // "E1", "E2", ...
  statement: L; // human-readable factual statement
  direction: Direction;
  tags: EvidenceTag[];
  citation: Citation;
  /** related metric, if this evidence is a number */
  metricName?: string;
  metricValue?: number;
  metricUnit?: string;
  /** 0-100: how much we trust this datum (source quality x freshness) */
  confidence: number;
  isMock: boolean;
}

export type PersonaId =
  | "bogle"
  | "markowitz"
  | "buffett"
  | "marks"
  | "dalio"
  | "taleb"
  | "simons"
  | "soros";

export interface PersonaMeta {
  id: PersonaId;
  name: string;
  title: L;
  color: string; // tailwind-compatible hex accent
  philosophy: L;
  /** the question this member always asks first */
  firstQuestion: L;
  /** what breaks this member's patience */
  hates: L;
  /** the standing veto rule, if any */
  vetoRule?: L;
  /** known blind spot of this framework */
  blindSpot: L;
}

export interface Argument {
  text: L;
  evidenceIds: string[];
  /** true when the point is inference, not sourced fact */
  isInference: boolean;
}

export interface PersonaOpinion {
  persona: PersonaId;
  stance: Direction;
  rating: number; // 0-100
  confidence: number; // 0-100
  recommendedAction: L;
  summary: L;
  arguments: Argument[];
  risks: Argument[];
  /** challenge aimed at the rest of the committee */
  challenge: L;
  /** disagreements with named committee members */
  disagreements: { with: PersonaId; text: L }[];
  citedEvidenceIds: string[];
  veto?: { triggered: boolean; reason: L; effect: L };
  dataFreshness: string;
  usesMockData: boolean;
  /** true when the qualitative text was deepened by the optional LLM layer */
  llmEnriched?: boolean;
}

export type OverallRating =
  | "Strong Buy"
  | "Buy"
  | "Watch"
  | "Hold"
  | "Reduce"
  | "Avoid";

export interface Scenario {
  name: L; // Bull / Base / Bear
  range: string; // e.g. "-15% to -30%" — always a range, never a point
  method: L; // the formula/basis that produced the range
  drivers: L; // what must happen
  invalidation: L; // what would invalidate this case
  evidenceIds: string[];
}

export interface FinalDecision {
  overallRating: OverallRating;
  /** the weighted committee score behind the rating label, 0-100 */
  score: number;
  confidence: number; // 0-100
  suggestedRole:
    | "Core holding"
    | "Satellite holding"
    | "Tactical trade"
    | "Hedge"
    | "Avoid";
  allocation: { conservative: number; balanced: number; aggressive: number }; // % of portfolio
  timeHorizon: L;
  scenarios: Scenario[];
  expectedUpside: L;
  expectedDownside: L;
  keyRisks: Argument[];
  keyCatalysts: Argument[];
  killCriteria: L[];
  changeOfMind: L[];
  vetoesApplied: { persona: PersonaId; reason: L; effect: L }[];
  evidenceQuality: "A" | "B" | "C" | "D";
  citationCoverage: number; // 0-100 %
  disclaimers: L[];
}

export interface FilingRecord {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDoc: string;
  reportDate?: string;
  url: string;
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface QuantStats {
  lastPrice: number;
  lastPriceTime: string;
  currency: string;
  momentum12m: number | null; // % return over lookback
  momentum3m: number | null;
  above200dma: boolean | null;
  realizedVol: number | null; // annualized, %
  maxDrawdown1y: number | null; // %
  pctFromHigh: number | null; // % below 1y high
  marketState: string;
  delayed: boolean;
}

export interface MacroSnapshot {
  seriesId: string;
  label: string;
  value: number;
  unit: string;
  observationDate: string;
  retrievedAt: string;
  url: string;
  /** publisher of this datum, e.g. "U.S. Treasury", "NY Fed (EFFR)", "BLS", "FRED" */
  sourceName?: string;
  /** derived, e.g. YoY for CPI */
  derived?: string;
  /** true when served from an expired cache entry after live fetches failed */
  stale?: boolean;
}

export type PeriodType = "annual" | "quarterly" | "instant" | "derived";
export type MetricBasis = "reported" | "derived" | "normalized" | "mock";

export interface FinancialMetric {
  name: string;
  label: string;
  value: number;
  unit: string;
  period: string; // e.g. "FY2025" or "Q2 2026"
  periodEnd: string;
  periodType: PeriodType;
  basis: MetricBasis;
  yoyChange: number | null; // %
  citation: Citation;
}

export interface AssetInfo {
  ticker: string;
  name: string;
  cik: string | null;
  exchange: string | null;
  assetType: "stock" | "etf" | "index" | "unknown";
  sector?: string;
}

export interface AnalysisResult {
  asset: AssetInfo;
  generatedAt: string;
  quant: QuantStats | null;
  priceHistory: PricePoint[];
  macro: MacroSnapshot[];
  financials: FinancialMetric[];
  filings: FilingRecord[];
  evidence: Evidence[];
  opinions: PersonaOpinion[];
  decision: FinalDecision;
  dataWarnings: L[];
}
