// FRED / Federal Reserve data (source level P0).
// Uses the public fredgraph.csv endpoint, which needs no API key and serves
// the same official series as the FRED API. Each snapshot records series_id,
// latest observation date, and retrieval time, per the citation rules.
import { fetchTextRobust } from "@/lib/fetcher";
import type { MacroSnapshot } from "@/lib/types";

interface SeriesSpec {
  id: string;
  label: string;
  unit: string;
  /** compute year-over-year % change instead of the raw level */
  yoy?: boolean;
}

const SERIES: SeriesSpec[] = [
  { id: "DGS10", label: "10Y Treasury Yield", unit: "%" },
  { id: "DGS2", label: "2Y Treasury Yield", unit: "%" },
  { id: "T10Y2Y", label: "10Y-2Y Curve", unit: "%" },
  { id: "DFF", label: "Fed Funds Rate (effective)", unit: "%" },
  { id: "CPIAUCSL", label: "CPI YoY", unit: "%", yoy: true },
  { id: "UNRATE", label: "Unemployment Rate", unit: "%" },
  { id: "BAMLH0A0HYM2", label: "High Yield OAS", unit: "%" },
];

function parseCsv(body: string): { date: string; value: number }[] {
  const lines = body.trim().split("\n");
  const out: { date: string; value: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, raw] = lines[i].split(",");
    const v = parseFloat(raw);
    if (!Number.isNaN(v)) out.push({ date, value: v });
  }
  return out;
}

async function fetchSeries(spec: SeriesSpec): Promise<MacroSnapshot | null> {
  try {
    const { body, retrievedAt } = await fetchTextRobust(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${spec.id}`,
      { ttlMs: 60 * 60 * 1000 }
    );
    const obs = parseCsv(body);
    if (obs.length === 0) return null;
    const last = obs[obs.length - 1];

    if (spec.yoy) {
      const target = new Date(last.date);
      target.setFullYear(target.getFullYear() - 1);
      const targetStr = target.toISOString().slice(0, 7);
      const prior = obs.find((o) => o.date.startsWith(targetStr));
      if (!prior) return null;
      const yoy = ((last.value - prior.value) / prior.value) * 100;
      return {
        seriesId: spec.id,
        label: spec.label,
        value: Math.round(yoy * 100) / 100,
        unit: spec.unit,
        observationDate: last.date,
        retrievedAt,
        url: `https://fred.stlouisfed.org/series/${spec.id}`,
        derived: `YoY from index ${prior.value} (${prior.date}) to ${last.value} (${last.date})`,
      };
    }

    return {
      seriesId: spec.id,
      label: spec.label,
      value: last.value,
      unit: spec.unit,
      observationDate: last.date,
      retrievedAt,
      url: `https://fred.stlouisfed.org/series/${spec.id}`,
    };
  } catch {
    return null;
  }
}

export async function getMacroSnapshots(): Promise<MacroSnapshot[]> {
  const results = await Promise.all(SERIES.map(fetchSeries));
  return results.filter((r): r is MacroSnapshot => r !== null);
}
