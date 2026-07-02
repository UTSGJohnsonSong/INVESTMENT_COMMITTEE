"use client";
// Committee screener: runs the full committee pipeline over the N largest
// SEC filers and surfaces Buy / Strong Buy names grouped by sector.
// Universe and sort formula are stated on-page — no hidden curation.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import type { ScreenerRow } from "@/lib/screener";
import { Panel } from "@/components/ui";
import { CartMiniButton } from "@/components/cart";

type RatingFilter = "strongbuy" | "buyplus" | "watchplus" | "all";

const RATING_ORDER: Record<string, number> = {
  "Strong Buy": 5,
  Buy: 4,
  Watch: 3,
  Hold: 2,
  Reduce: 1,
  Avoid: 0,
};

const RATING_COLOR: Record<string, string> = {
  "Strong Buy": "text-bullish",
  Buy: "text-bullish",
  Watch: "text-warn",
  Hold: "text-zinc-300",
  Reduce: "text-bearish",
  Avoid: "text-bearish",
};

const CACHE_KEY = "ic-screener-v1";
const CACHE_TTL = 10 * 60 * 1000;

export default function ScreenerPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [scanned, setScanned] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RatingFilter>("buyplus");
  const [scanTime, setScanTime] = useState<string | null>(null);
  const abortRef = useRef(false);
  const zh = lang === "zh";

  useEffect(() => {
    if (document.cookie.includes("lang=zh")) setLang("zh");
  }, []);

  const runScan = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    setError(null);
    setRows([]);
    setScanned(0);
    const acc: ScreenerRow[] = [];
    let offset = 0;
    try {
      for (;;) {
        if (abortRef.current) break;
        const res = await fetch(`/api/screener?offset=${offset}&limit=8`);
        if (!res.ok) throw new Error(`batch failed (${res.status})`);
        const data = (await res.json()) as {
          total: number;
          rows: ScreenerRow[];
          skipped: string[];
          done: boolean;
        };
        acc.push(...data.rows);
        offset += 8;
        setTotal(data.total);
        setScanned(Math.min(offset, data.total));
        setRows([...acc]);
        if (data.done) break;
      }
      const now = new Date().toISOString();
      setScanTime(now);
      try {
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ rows: acc, time: now, total: total || 100 })
        );
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan failed");
    } finally {
      setRunning(false);
    }
  }, [total]);

  // Restore a recent scan from sessionStorage; otherwise start automatically.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { rows: ScreenerRow[]; time: string; total: number };
        if (Date.now() - new Date(c.time).getTime() < CACHE_TTL && c.rows.length > 0) {
          setRows(c.rows);
          setScanTime(c.time);
          setTotal(c.total);
          setScanned(c.total);
          return;
        }
      }
    } catch {}
    runScan();
    return () => {
      abortRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minRating =
    filter === "strongbuy" ? 5 : filter === "buyplus" ? 4 : filter === "watchplus" ? 3 : 0;
  const filtered = rows.filter((r) => RATING_ORDER[r.rating] >= minRating);

  // Group by sector; sectors ordered by their best sortScore.
  const bySector = new Map<string, ScreenerRow[]>();
  for (const r of filtered) {
    const list = bySector.get(r.sector) ?? [];
    list.push(r);
    bySector.set(r.sector, list);
  }
  const sectors = [...bySector.entries()]
    .map(([sector, list]) => ({
      sector,
      list: list.sort((a, b) => b.sortScore - a.sortScore),
    }))
    .sort((a, b) => b.list[0].sortScore - a.list[0].sortScore);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {zh ? "委员会扫描器 · Screener" : "Committee Screener"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {zh
              ? "对 SEC 官方名单中市值最大的 100 家公司逐一运行完整委员会管线,按板块分组呈现。"
              : "Runs the full committee pipeline over the 100 largest SEC filers, grouped by sector."}
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={running}
          className="text-xs border border-blue-500/40 bg-blue-500/10 text-blue-400 rounded px-3 py-1.5 hover:bg-blue-500/20 disabled:opacity-50"
        >
          {running
            ? zh
              ? "扫描中…"
              : "Scanning…"
            : zh
              ? "重新扫描"
              : "Rescan"}
        </button>
      </div>

      {/* Universe & sort transparency */}
      <div className="text-[11px] text-muted border border-line rounded-lg px-4 py-2.5 bg-panel space-y-1">
        <p>
          <span className="text-foreground/80">{zh ? "宇宙:" : "Universe: "}</span>
          {zh
            ? "SEC company_tickers.json(P0,官方全量申报名单,按市值降序)前 100 名。偏差声明:这是大盘股偏差,不是名气偏差——没有人工挑选。20-F 外国申报公司因无 10-K 数据被跳过。"
            : "Top 100 of SEC company_tickers.json (P0, the official full filer list, market-cap descending). Bias statement: this is a large-cap bias, not a fame bias — nothing is hand-picked. Foreign 20-F filers are skipped (no 10-K data)."}
        </p>
        <p>
          <span className="text-foreground/80">{zh ? "排序:" : "Sort: "}</span>
          <span className="num">
            sortScore = score + 0.3×confidence − 10×vetoes + quality(A+5/B0/C−5/D−10)
          </span>
          {zh ? " —— 信念优先,证据薄与被否决者后置。" : " — conviction first; thin evidence and vetoes push a name down."}
        </p>
        {scanTime && (
          <p className="num">
            {zh ? "扫描时间:" : "Scanned: "}
            {scanTime.slice(0, 16)}Z · {rows.length}{" "}
            {zh ? "家有完整数据" : "names with full data"}
          </p>
        )}
      </div>

      {/* Progress */}
      {running && (
        <div>
          <div className="flex justify-between text-[11px] text-muted mb-1">
            <span>
              {zh
                ? `逐家运行委员会分析(SEC XBRL + 行情 + 宏观)…`
                : `Running the committee on each name (SEC XBRL + quotes + macro)…`}
            </span>
            <span className="num">
              {scanned}/{total || 100}
            </span>
          </div>
          <div className="h-1.5 bg-panel2 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded transition-all"
              style={{ width: `${(scanned / (total || 100)) * 100}%` }}
            />
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs text-bearish">
          {zh ? "扫描出错:" : "Scan error: "}
          {error}
        </p>
      )}

      {/* Rating filter */}
      <div className="flex gap-1.5 text-[11px]">
        {(
          [
            ["strongbuy", "Strong Buy"],
            ["buyplus", zh ? "Buy 及以上" : "Buy +"],
            ["watchplus", zh ? "Watch 及以上" : "Watch +"],
            ["all", zh ? "全部" : "All"],
          ] as [RatingFilter, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-2.5 py-1 rounded border ${
              filter === v
                ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                : "border-line text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto num text-muted self-center">
          {filtered.length} {zh ? "个结果" : "results"}
        </span>
      </div>

      {/* Sector groups */}
      {sectors.length === 0 && !running && rows.length > 0 && (
        <p className="text-sm text-muted py-8 text-center">
          {zh
            ? "当前筛选条件下没有结果——这本身就是信息:委员会现在不觉得有什么值得追。"
            : "No results under this filter — which is itself information: the committee sees nothing worth chasing right now."}
        </p>
      )}
      {sectors.map(({ sector, list }) => (
        <Panel
          key={sector}
          title={`${sector} (${list.length})`}
        >
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {list.map((r) => (
              <Link
                key={r.ticker}
                href={`/asset/${r.ticker}`}
                className="border border-line rounded-lg p-3 bg-panel2/40 hover:border-blue-500/50 block"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="num font-bold flex items-center gap-1.5">
                    {r.ticker}
                    <CartMiniButton ticker={r.ticker} name={r.name} />
                  </span>
                  <span className={`text-xs font-semibold ${RATING_COLOR[r.rating]}`}>
                    {r.rating}
                  </span>
                </div>
                <div className="text-[11px] text-muted truncate mt-0.5">{r.name}</div>
                <div className="flex items-center gap-3 mt-2 text-[11px] num">
                  <span title="committee score">
                    <span className="text-muted">S</span> {r.score}
                  </span>
                  <span title="confidence">
                    <span className="text-muted">C</span> {r.confidence}
                  </span>
                  <span title="evidence quality">
                    <span className="text-muted">Q</span> {r.evidenceQuality}
                  </span>
                  {r.vetoCount > 0 && (
                    <span className="text-bearish" title="vetoes">
                      V{r.vetoCount}
                    </span>
                  )}
                  <span
                    className={`ml-auto ${
                      (r.momentum12m ?? 0) >= 0 ? "text-bullish" : "text-bearish"
                    }`}
                    title="12m momentum"
                  >
                    {r.momentum12m !== null
                      ? `${r.momentum12m >= 0 ? "+" : ""}${r.momentum12m}%`
                      : ""}
                  </span>
                  {r.pe !== null && (
                    <span className="text-muted" title="trailing P/E">
                      PE {r.pe}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
