"use client";
// Basket page: assemble candidates, then submit the whole basket to the
// committee for a portfolio-level review with per-name allocations.
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { pick } from "@/lib/i18n";
import type { BasketReview } from "@/lib/basket";
import { PERSONAS } from "@/lib/committee/meta";
import { Panel, StanceBadge, WarnBadge } from "@/components/ui";
import { removeFromCart, useCart, writeCart, addToCart } from "@/components/cart";

export default function BasketPage() {
  const [lang, setLang] = useState<Lang>("en");
  const items = useCart();
  const [manual, setManual] = useState("");
  const [review, setReview] = useState<BasketReview | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zh = lang === "zh";

  useEffect(() => {
    if (document.cookie.includes("lang=zh")) setLang("zh");
  }, []);

  const runReview = async () => {
    setRunning(true);
    setError(null);
    setReview(null);
    try {
      const res = await fetch("/api/basket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: items.map((i) => i.ticker) }),
      });
      if (!res.ok) {
        const e = (await res.json()) as { error?: string };
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      setReview((await res.json()) as BasketReview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "review failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">
          {zh ? "购物篮 · 委员会审核" : "Basket · Committee Review"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {zh
            ? "把看好的股票/ETF 加进篮子;凑齐后提交,八位委员对整个篮子做组合级审核,给出综合建议与每项占比。"
            : "Collect stocks/ETFs you like; when ready, submit the whole basket for a portfolio-level committee review with a verdict and per-name allocations."}
        </p>
      </div>

      {/* ---- Cart contents ---- */}
      <Panel
        title={zh ? `篮子 (${items.length}/15)` : `Basket (${items.length}/15)`}
        right={
          items.length > 0 ? (
            <button
              onClick={() => writeCart([])}
              className="text-[11px] text-muted hover:text-bearish"
            >
              {zh ? "清空" : "Clear all"}
            </button>
          ) : undefined
        }
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted">
            {zh ? (
              <>
                篮子是空的。去{" "}
                <Link href="/screener" className="text-blue-400 hover:underline">
                  扫描器
                </Link>{" "}
                或任意个股页点「+ 加入篮子」,或在下面直接输入 ticker。
              </>
            ) : (
              <>
                Empty. Add names from the{" "}
                <Link href="/screener" className="text-blue-400 hover:underline">
                  screener
                </Link>{" "}
                or any asset page, or type a ticker below.
              </>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((i) => (
              <span
                key={i.ticker}
                className="inline-flex items-center gap-1.5 border border-line rounded px-2 py-1 text-sm bg-panel2/50"
              >
                <Link href={`/asset/${i.ticker}`} className="num font-semibold hover:text-blue-400">
                  {i.ticker}
                </Link>
                {i.name && (
                  <span className="text-[11px] text-muted max-w-32 truncate">{i.name}</span>
                )}
                <button
                  onClick={() => removeFromCart(i.ticker)}
                  className="text-muted hover:text-bearish leading-none"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manual.trim()) {
                addToCart({ ticker: manual.trim() });
                setManual("");
              }
            }}
            placeholder={zh ? "手动输入 ticker,回车加入" : "Type a ticker, Enter to add"}
            className="num h-9 flex-1 max-w-xs bg-panel2 border border-line rounded px-3 text-sm outline-none focus:border-blue-500/60 placeholder:text-muted/60"
          />
          <button
            onClick={runReview}
            disabled={running || items.length === 0}
            className="h-9 px-4 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium"
          >
            {running
              ? zh
                ? "委员会审核中…"
                : "Committee reviewing…"
              : zh
                ? `提交委员会审核 (${items.length})`
                : `Submit for review (${items.length})`}
          </button>
        </div>
        {running && (
          <p className="text-[11px] text-muted mt-2 animate-pulse">
            {zh
              ? "每个标的都在跑完整管线(SEC + 行情 + 宏观),约每只 2–5 秒…"
              : "Each name runs the full pipeline (SEC + quotes + macro), ~2–5s per name…"}
          </p>
        )}
        {error && <p className="text-xs text-bearish mt-2">{error}</p>}
      </Panel>

      {/* ---- Review result ---- */}
      {review && (
        <>
          <Panel
            title={zh ? "委员会裁定 · Verdict" : "Committee Verdict"}
            right={
              <span className="num text-[11px] text-muted">
                HHI {review.hhi} · {review.generatedAt.slice(0, 16)}Z
              </span>
            }
          >
            <p className="text-sm leading-relaxed">{pick(review.verdict, lang)}</p>
            {review.unresolved.length > 0 && (
              <p className="text-xs text-warn mt-2">
                {zh ? "无法解析:" : "Unresolved: "}
                {review.unresolved.join(", ")}
              </p>
            )}
            {review.warnings.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {review.warnings.map((w, i) => (
                  <WarnBadge key={i}>{pick(w, lang)}</WarnBadge>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={zh ? "建议配比 · Suggested allocation" : "Suggested allocation"}>
            <div className="space-y-2">
              {review.allocations.map((a) => (
                <div key={a.ticker} className={a.dropped ? "opacity-60" : ""}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/asset/${a.ticker}`}
                        className="num font-semibold hover:text-blue-400"
                      >
                        {a.ticker}
                      </Link>
                      <span className="text-[10px] uppercase tracking-wider text-muted border border-line rounded px-1 py-0.5">
                        {pick(a.role, lang)}
                      </span>
                      {a.rating && (
                        <span
                          className={`text-[11px] ${
                            a.rating === "Buy" || a.rating === "Strong Buy"
                              ? "text-bullish"
                              : a.rating === "Reduce" || a.rating === "Avoid"
                                ? "text-bearish"
                                : "text-warn"
                          }`}
                        >
                          {a.rating}
                        </span>
                      )}
                    </span>
                    <span className="num font-bold">
                      {a.dropped ? (zh ? "剔除" : "OUT") : `${a.weight}%`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-panel2 rounded overflow-hidden mt-1">
                    <div
                      className={`h-full rounded ${a.dropped ? "bg-red-500/40" : "bg-blue-500/70"}`}
                      style={{ width: `${Math.min(a.weight * 2, 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">{pick(a.reason, lang)}</p>
                </div>
              ))}
              {/* Cash line */}
              <div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="num font-semibold">CASH</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted border border-line rounded px-1 py-0.5">
                      {zh ? "现金/短债" : "Cash / T-bills"}
                    </span>
                  </span>
                  <span className="num font-bold">{review.cashWeight}%</span>
                </div>
                <div className="h-1.5 bg-panel2 rounded overflow-hidden mt-1">
                  <div
                    className="h-full rounded bg-zinc-500/70"
                    style={{ width: `${Math.min(review.cashWeight * 2, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </Panel>

          <div>
            <h2 className="text-xs font-semibold tracking-widest text-muted uppercase mb-3">
              {zh ? "八位委员对整个篮子的意见" : "The committee on the basket as a whole"}
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {review.notes.map((n) => {
                const meta = PERSONAS[n.persona];
                return (
                  <div
                    key={n.persona}
                    className="bg-panel border border-line rounded-lg p-4"
                    style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-sm" style={{ color: meta.color }}>
                        {meta.name}
                      </span>
                      <StanceBadge stance={n.stance} />
                    </div>
                    <p className="text-[13px] leading-relaxed">{pick(n.text, lang)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-muted">
            {zh
              ? "This is not financial advice. 配比为决策辅助框架,分批执行、自负其责。"
              : "This is not financial advice. The allocation is a decision-support frame — execute in tranches, at your own responsibility."}
          </p>
        </>
      )}
    </div>
  );
}
