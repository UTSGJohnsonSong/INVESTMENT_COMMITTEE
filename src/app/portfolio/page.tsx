"use client";
// Portfolio Impact — simplified MVP. Weight math, concentration and
// before/after are real arithmetic on user input; correlation, sector and
// factor exposure need real return series and are explicitly marked MOCK.
import { useEffect, useMemo, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { MockBadge, Panel, WarnBadge } from "@/components/ui";

interface Position {
  ticker: string;
  weight: number;
  accountType: string;
}

const DEFAULT_POSITIONS: Position[] = [
  { ticker: "XEQT.TO", weight: 50, accountType: "TFSA" },
  { ticker: "SPY", weight: 20, accountType: "taxable" },
  { ticker: "CASH", weight: 20, accountType: "general" },
  { ticker: "GLD", weight: 10, accountType: "general" },
];

export default function PortfolioPage() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    if (document.cookie.includes("lang=zh")) setLang("zh");
  }, []);
  const zh = lang === "zh";

  const [positions, setPositions] = useState<Position[]>(DEFAULT_POSITIONS);
  const [target, setTarget] = useState("NVDA");
  const [targetWeight, setTargetWeight] = useState(5);

  const totalWeight = positions.reduce((a, p) => a + (p.weight || 0), 0);

  const after = useMemo(() => {
    const scale = (100 - targetWeight) / (totalWeight || 1);
    return [
      ...positions.map((p) => ({
        ticker: p.ticker,
        weight: Math.round(p.weight * scale * 10) / 10,
      })),
      { ticker: target.toUpperCase() || "?", weight: targetWeight },
    ];
  }, [positions, target, targetWeight, totalWeight]);

  const hhiBefore = useMemo(
    () =>
      Math.round(
        positions.reduce((a, p) => a + Math.pow(p.weight / (totalWeight || 1), 2), 0) * 10000
      ),
    [positions, totalWeight]
  );
  const hhiAfter = useMemo(
    () => Math.round(after.reduce((a, p) => a + Math.pow(p.weight / 100, 2), 0) * 10000),
    [after]
  );

  const maxAfter = after.reduce((a, p) => Math.max(a, p.weight), 0);

  const update = (i: number, field: keyof Position, value: string) => {
    setPositions((ps) =>
      ps.map((p, j) =>
        j === i
          ? { ...p, [field]: field === "weight" ? parseFloat(value) || 0 : value }
          : p
      )
    );
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold">
          {zh ? "Portfolio Impact · 组合影响" : "Portfolio Impact"}
        </h1>
        <p className="text-xs text-muted mt-1">
          {zh
            ? "输入当前持仓与目标资产,计算加入后的权重结构与集中度变化。"
            : "Enter current positions and a target asset; see the weight structure and concentration change after adding it."}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title={zh ? "当前持仓 Current positions" : "Current positions"}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted text-left">
                <th className="pb-2">Ticker</th>
                <th className="pb-2 w-24">Weight %</th>
                <th className="pb-2 w-28">Account</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={i} className="border-t border-line/50">
                  <td className="py-1.5 pr-2">
                    <input
                      value={p.ticker}
                      onChange={(e) => update(i, "ticker", e.target.value)}
                      className="num w-full bg-panel2 border border-line rounded px-2 py-1 outline-none focus:border-blue-500/60"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      value={p.weight}
                      onChange={(e) => update(i, "weight", e.target.value)}
                      className="num w-full bg-panel2 border border-line rounded px-2 py-1 outline-none focus:border-blue-500/60"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      value={p.accountType}
                      onChange={(e) => update(i, "accountType", e.target.value)}
                      className="w-full bg-panel2 border border-line rounded px-2 py-1 outline-none"
                    >
                      <option value="TFSA">TFSA</option>
                      <option value="RRSP">RRSP</option>
                      <option value="taxable">taxable</option>
                      <option value="general">general</option>
                    </select>
                  </td>
                  <td>
                    <button
                      onClick={() => setPositions((ps) => ps.filter((_, j) => j !== i))}
                      className="text-muted hover:text-bearish"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() =>
                setPositions((ps) => [...ps, { ticker: "", weight: 0, accountType: "general" }])
              }
              className="text-xs text-blue-400 hover:underline"
            >
              {zh ? "+ 添加持仓" : "+ Add position"}
            </button>
            <span
              className={`num text-xs ${Math.abs(totalWeight - 100) > 0.5 ? "text-warn" : "text-muted"}`}
            >
              {zh ? "合计" : "Total"} {Math.round(totalWeight * 10) / 10}%
              {Math.abs(totalWeight - 100) > 0.5 &&
                (zh ? " (≠100%,将按比例归一化)" : " (≠100%, will be normalized)")}
            </span>
          </div>
        </Panel>

        <Panel title={zh ? "目标资产 Target addition" : "Target addition"}>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-widest text-muted">
                  Ticker
                </label>
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value.toUpperCase())}
                  className="num w-full bg-panel2 border border-line rounded px-2 py-1.5 mt-1 outline-none focus:border-blue-500/60"
                />
              </div>
              <div className="w-32">
                <label className="text-[10px] uppercase tracking-widest text-muted">
                  Weight %
                </label>
                <input
                  type="number"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(parseFloat(e.target.value) || 0)}
                  className="num w-full bg-panel2 border border-line rounded px-2 py-1.5 mt-1 outline-none focus:border-blue-500/60"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <Metric label={zh ? "集中度 HHI (before)" : "Concentration HHI (before)"} value={String(hhiBefore)} />
              <Metric
                label={zh ? "集中度 HHI (after)" : "Concentration HHI (after)"}
                value={String(hhiAfter)}
                tone={hhiAfter > hhiBefore ? "bad" : "good"}
              />
              <Metric
                label={zh ? "最大单仓 (after)" : "Largest position (after)"}
                value={`${maxAfter}%`}
                tone={maxAfter > 25 ? "bad" : undefined}
              />
            </div>
            {targetWeight > 10 && (
              <WarnBadge>
                {zh
                  ? `目标仓位 ${targetWeight}% 超过 Taleb 委员对单一资产的常规上限区间 (2–8%),请先看该资产研究页的 veto 与仓位约束。`
                  : `A ${targetWeight}% target exceeds Taleb's normal single-asset cap range (2–8%). Check the asset's research page for vetoes and caps first.`}
              </WarnBadge>
            )}
            <a
              href={`/asset/${target}`}
              className="inline-block text-xs text-blue-400 hover:underline"
            >
              {zh
                ? `查看 ${target} 的委员会分析 →`
                : `See the committee analysis for ${target} →`}
            </a>
          </div>
        </Panel>
      </div>

      <Panel title="Before vs After">
        <div className="grid md:grid-cols-2 gap-6">
          <WeightList
            title="Before"
            rows={positions.map((p) => ({
              ticker: p.ticker,
              weight: Math.round(((p.weight / (totalWeight || 1)) * 100) * 10) / 10,
            }))}
          />
          <WeightList title={`After (+${target} ${targetWeight}%)`} rows={after} highlight={target} />
        </div>
      </Panel>

      <Panel
        title="Correlation / Sector / Factor exposure"
        right={<MockBadge />}
      >
        <p className="text-[13px] text-muted leading-relaxed">
          {zh ? (
            <>
              相关性矩阵、行业敞口、因子暴露与最大回撤模拟需要真实多资产收益序列与持仓穿透数据,
              MVP 尚未接入——此模块整体为 <span className="text-purple-400">MOCK / 占位</span>,
              不显示假数字。接入计划:用各 ETF issuer 官网 holdings (P0) + 日线收益序列计算真实相关性,
              替换 Markowitz 委员当前的 0.8/0.95 占位假设。
            </>
          ) : (
            <>
              The correlation matrix, sector exposure, factor exposure and
              max-drawdown simulation require real multi-asset return series and
              holdings look-through, not yet wired in the MVP — this module is
              entirely <span className="text-purple-400">MOCK / placeholder</span>{" "}
              and shows no fake numbers. Plan: compute real correlations from ETF
              issuer holdings (P0) + daily return series, replacing Markowitz&apos;s
              current 0.8/0.95 placeholder assumptions.
            </>
          )}
        </p>
      </Panel>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="border border-line rounded p-2.5 bg-panel2/50">
      <div className="text-[10px] text-muted">{label}</div>
      <div
        className={`num text-lg font-semibold ${
          tone === "bad" ? "text-warn" : tone === "good" ? "text-bullish" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function WeightList({
  title,
  rows,
  highlight,
}: {
  title: string;
  rows: { ticker: string; weight: number }[];
  highlight?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted mb-2">
        {title}
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-[13px]">
            <span
              className={`num w-20 shrink-0 ${r.ticker === highlight ? "text-blue-400 font-semibold" : ""}`}
            >
              {r.ticker || "—"}
            </span>
            <div className="flex-1 h-2 bg-panel2 rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.min(r.weight, 100)}%`,
                  background: r.ticker === highlight ? "#3b82f6" : "#334155",
                }}
              />
            </div>
            <span className="num w-12 text-right text-muted">{r.weight}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
