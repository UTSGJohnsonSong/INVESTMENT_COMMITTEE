import Link from "next/link";
import { cookies } from "next/headers";
import { getMacroSnapshots } from "@/lib/sources/fred";
import { langFromCookie } from "@/lib/i18n";
import { SearchBox } from "@/components/search-box";
import { Panel, SourceLevelBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const WATCHLIST = ["AAPL", "NVDA", "MSFT", "TSLA", "GOOGL", "AMZN", "SPY", "QQQ"];

export default async function Dashboard() {
  const lang = langFromCookie((await cookies()).get("lang")?.value);
  const zh = lang === "zh";
  const macro = await getMacroSnapshots().catch(() => []);

  const cpi = macro.find((m) => m.seriesId === "CPIAUCSL");
  const hy = macro.find((m) => m.seriesId === "BAMLH0A0HYM2");
  const curve = macro.find((m) => m.seriesId === "T10Y2Y");
  const dff = macro.find((m) => m.seriesId === "DFF");

  const regimeNotes: string[] = [];
  if (cpi)
    regimeNotes.push(
      cpi.value > 3.2
        ? zh
          ? `通胀 ${cpi.value}% 高于目标区间——实际利率与估值承压`
          : `Inflation at ${cpi.value}%, above target — pressure on real rates and valuations`
        : zh
          ? `通胀 ${cpi.value}%,处于可控区间`
          : `Inflation at ${cpi.value}%, within the manageable range`
    );
  if (curve)
    regimeNotes.push(
      curve.value < 0
        ? zh
          ? `收益率曲线倒挂 (${curve.value}%),周期后段信号`
          : `Yield curve inverted (${curve.value}%) — late-cycle signal`
        : zh
          ? `收益率曲线 ${curve.value}%,未倒挂`
          : `Yield curve at ${curve.value}%, not inverted`
    );
  if (hy)
    regimeNotes.push(
      hy.value < 3.5
        ? zh
          ? `高收益利差 ${hy.value}% 偏窄——信用市场情绪偏贪婪,坏消息没有被定价`
          : `High-yield spread at ${hy.value}% is tight — credit sentiment leans greedy; bad news is not priced`
        : hy.value > 5
          ? zh
            ? `高收益利差 ${hy.value}% 走阔——信用压力上升`
            : `High-yield spread widening to ${hy.value}% — credit stress rising`
          : zh
            ? `高收益利差 ${hy.value}%,中性`
            : `High-yield spread at ${hy.value}%, neutral`
    );

  return (
    <div className="space-y-6">
      <div className="pt-10 pb-4 text-center space-y-4">
        <h1 className="text-3xl font-bold">
          {zh ? "投资思想委员会" : "Investment Committee"}
          <span className="block text-sm font-normal text-muted mt-2">
            {zh
              ? "8 位投资大师 · 同一组一手证据 · 每个结论可回溯到来源与时间戳"
              : "8 investing masters · one shared body of primary evidence · every conclusion traceable to a source and timestamp"}
          </span>
        </h1>
        <div className="flex justify-center">
          <SearchBox large lang={lang} />
        </div>
        <p className="text-[11px] text-muted">
          {zh
            ? "支持任意美股 / ETF / 主要指数(SP500、NASDAQ、DOW)。数据源:SEC EDGAR (P0) · FRED (P0) · 延迟行情 (P1)。分析约需 5–10 秒。"
            : "Any US stock / ETF / major index (SP500, NASDAQ, DOW). Sources: SEC EDGAR (P0) · FRED (P0) · delayed quotes (P1). Analysis takes ~5–10s."}
        </p>
        <Link
          href="/strategy"
          className="inline-block text-sm border border-blue-500/40 bg-blue-500/10 text-blue-400 rounded px-4 py-2 hover:bg-blue-500/20"
        >
          {zh
            ? "不选标的?让委员会讨论「当下该怎么配置」→ 三套风险方案"
            : "No ticker in mind? Let the committee debate how to be positioned now → three risk-tiered plans"}
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Panel
          title={zh ? "Market environment · 当前市场环境" : "Market environment"}
          className="lg:col-span-2"
          right={<SourceLevelBadge level="P0" />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {macro.map((m) => (
              <a
                key={m.seriesId}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-line rounded p-2.5 bg-panel2/50 hover:border-blue-500/40"
              >
                <div className="text-[10px] text-muted">{m.label}</div>
                <div className="num text-lg font-semibold">
                  {m.value}
                  {m.unit}
                </div>
                <div className="text-[10px] text-muted num">
                  {m.seriesId} · {m.observationDate}
                </div>
              </a>
            ))}
            {macro.length === 0 && (
              <p className="text-xs text-muted col-span-4">
                {zh ? "FRED 数据暂时不可用。" : "FRED data temporarily unavailable."}
              </p>
            )}
          </div>
          <ul className="space-y-1 text-[13px] text-muted">
            {regimeNotes.map((n, i) => (
              <li key={i}>· {n}</li>
            ))}
          </ul>
          {dff && (
            <p className="text-[11px] text-muted mt-3">
              {zh
                ? "数据为 FRED 官方序列最新观测值;点击卡片查看原始序列。"
                : "Latest observations of official FRED series; click a card for the raw series."}{" "}
              retrieved {dff.retrievedAt.slice(0, 16)}Z
            </p>
          )}
        </Panel>

        <Panel title="Watchlist">
          <ul className="divide-y divide-line/50">
            {WATCHLIST.map((t) => (
              <li key={t}>
                <Link
                  href={`/asset/${t}`}
                  className="flex items-center justify-between py-2 hover:text-blue-400"
                >
                  <span className="num font-semibold">{t}</span>
                  <span className="text-[11px] text-muted">
                    {zh ? "召集委员会 →" : "Convene committee →"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <p className="text-center text-xs text-muted">
        {zh ? "第一次使用?先读" : "New here? Start with the"}{" "}
        <Link href="/guide" className="text-blue-400 hover:underline">
          {zh ? "使用指南与方法论 →" : "Guide & Methodology →"}
        </Link>
      </p>
    </div>
  );
}
