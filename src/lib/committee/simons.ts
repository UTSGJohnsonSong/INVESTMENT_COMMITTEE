import type { PersonaOpinion } from "@/lib/types";
import { l } from "@/lib/i18n";
import {
  CommitteeInput,
  arg,
  clamp,
  collectCited,
  freshness,
  ids,
  stanceFromRating,
  val,
  yoyOf,
} from "./helpers";

export function simons(input: CommitteeInput): PersonaOpinion {
  const { ctx } = input;
  const mom12 = val(ctx, "momentum_12m");
  const mom3 = val(ctx, "momentum_3m");
  const above200 = val(ctx, "above_200dma");
  const vol = val(ctx, "realized_vol");
  const revYoy = yoyOf(ctx, "revenue");
  const epsE = ctx.byName.get("eps_diluted");

  // Signal tally. Each is a real computed signal from delayed daily closes.
  const signals: { name: string; value: string; dir: number }[] = [];
  if (mom12 !== null)
    signals.push({ name: "momentum 12m", value: `${mom12}%`, dir: mom12 > 5 ? 1 : mom12 < -5 ? -1 : 0 });
  if (mom3 !== null)
    signals.push({ name: "momentum 3m", value: `${mom3}%`, dir: mom3 > 3 ? 1 : mom3 < -3 ? -1 : 0 });
  if (above200 !== null)
    signals.push({ name: "trend vs 200DMA", value: above200 ? "above" : "below", dir: above200 ? 1 : -1 });
  if (revYoy !== null)
    signals.push({ name: "revenue trend", value: `${revYoy}% YoY`, dir: revYoy > 5 ? 1 : revYoy < 0 ? -1 : 0 });

  const net = signals.reduce((a, s) => a + s.dir, 0);
  const volRegime = vol === null ? "unknown" : vol > 40 ? "high-vol" : vol > 22 ? "mid-vol" : "low-vol";

  const rating = clamp(50 + net * 9 - (volRegime === "high-vol" ? 6 : 0), 15, 85);

  const signalStr = signals
    .map((s) => `${s.name}=${s.value}(${s.dir > 0 ? "+" : s.dir < 0 ? "−" : "0"})`)
    .join(", ");

  const args = [
    arg(
      l(
        `Signal panel: ${signalStr}. Net signal ${net >= 0 ? "+" : ""}${net}/${signals.length}.`,
        `信号面板:${signalStr}。净信号 ${net >= 0 ? "+" : ""}${net}/${signals.length}。`
      ),
      ids(ctx, "momentum_12m", "momentum_3m", "above_200dma", "revenue")
    ),
    arg(
      l(
        `Volatility regime: ${volRegime} (${vol ?? "n/a"}%). The same momentum signal has a materially lower historical hit rate in a high-vol regime — position size must scale with inverse volatility.`,
        `波动率 regime:${volRegime}(${vol ?? "n/a"}%)。同样的动量信号,在高波动 regime 下的历史胜率显著更低——仓位必须按波动率倒数缩放。`
      ),
      ids(ctx, "realized_vol"),
      true
    ),
    arg(
      epsE
        ? l(
            `Earnings data is verifiable (${epsE.statement.en}), but the earnings-revision trend needs analyst-estimate data — missing this round.`,
            `盈利数据可核实(${epsE.statement.zh}),但 earnings revision trend 需要分析师预期数据,本期缺失。`
          )
        : l("Earnings revision data missing.", "盈利修正趋势数据缺失。"),
      ids(ctx, "eps_diluted"),
      true
    ),
  ];

  const risks = [
    arg(
      l(
        "[MOCK / PLACEHOLDER] Historical-analog backtests and factor exposures (quality/value/momentum/size/low-vol) are not implemented — no numbers shown here, so fake data cannot masquerade as statistics.",
        "[MOCK / PLACEHOLDER] 历史相似环境回测、因子暴露 (quality/value/momentum/size/low-vol) 尚未实现——此处不给数字,免得假数据冒充统计。"
      ),
      [],
      true
    ),
    arg(
      l(
        "All signals above are in-sample on just one year of daily bars: limited statistical significance; confidence is discounted accordingly. One year of price action is not a law.",
        "以上信号全部 in-sample 且样本仅一年日线:统计意义有限,置信度按此打折。别把一年的价格行为当成规律。"
      ),
      [],
      true
    ),
  ];

  return {
    persona: "simons",
    stance: stanceFromRating(rating),
    rating,
    confidence: 45,
    recommendedAction:
      net >= 2
        ? l(
            "Data agrees with the narrative: trend-following participation is allowed, with the 200DMA as the signal-invalidation line.",
            "数据方向与叙事一致:允许顺势参与,但用 200DMA 作为信号失效线。"
          )
        : net <= -2
          ? l(
              "Data does not support the story: momentum and trend are negative — statistics are not on the buyer's side.",
              "数据不支持叙事:动量与趋势为负,统计上不站在买方一边。"
            )
          : l(
              "Mixed signals: no statistical edge. Not betting is also a position.",
              "信号混合:没有统计优势,不下注也是仓位。"
            ),
    summary: args[0].text,
    arguments: args,
    risks,
    challenge: l(
      "Does the data actually support the story? Strip the narrative away — what do the signals say by themselves?",
      "数据真的支持这个故事吗?把叙事拿走,信号本身在说什么?"
    ),
    disagreements: [],
    citedEvidenceIds: collectCited([...args, ...risks]),
    dataFreshness: freshness(input),
    usesMockData: true,
  };
}
