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
} from "./helpers";

export function soros(input: CommitteeInput): PersonaOpinion {
  const { ctx } = input;
  const mom12 = val(ctx, "momentum_12m");
  const mom3 = val(ctx, "momentum_3m");
  const above200 = val(ctx, "above_200dma");
  const curve = val(ctx, "macro_T10Y2Y");
  const cpi = val(ctx, "macro_CPIAUCSL");
  const pctFromHigh = val(ctx, "pct_from_high");

  // Reflexivity check: a self-reinforcing trend needs price trend + a macro
  // or narrative trigger. We can verify the trend leg; the trigger leg needs
  // policy/flows data we don't fetch yet.
  const trendUp = above200 === 1 && mom12 !== null && mom12 > 10;
  const trendDown = above200 === 0 && mom12 !== null && mom12 < -10;
  const hasTrend = trendUp || trendDown;

  const asymmetric = trendUp && mom3 !== null && mom3 > 0;

  const rating = clamp(
    50 + (trendUp ? 14 : trendDown ? -14 : 0) + (asymmetric ? 6 : -4),
    20,
    78
  );

  const trendState =
    above200 === 1 ? { en: "above", zh: "站上" } : above200 === 0 ? { en: "below", zh: "跌破" } : { en: "n/a vs", zh: "n/a" };
  const args = [
    arg(
      l(
        `Trend leg: 12m ${mom12 ?? "n/a"}%, 3m ${mom3 ?? "n/a"}%, ${trendState.en} the 200DMA. ${hasTrend ? (trendUp ? "Uptrend confirmed — soil for reflexivity exists." : "Downtrend confirmed — buying here is catching a falling knife.") : "No clear trend; reflexivity has nothing to feed on."}`,
        `趋势腿:12m ${mom12 ?? "n/a"}%,3m ${mom3 ?? "n/a"}%,${trendState.zh} 200DMA。${hasTrend ? (trendUp ? "上行趋势成立,存在 reflexivity 的土壤。" : "下行趋势成立——做多就是接飞刀。") : "没有清晰趋势,反身性无从谈起。"}`
      ),
      ids(ctx, "momentum_12m", "momentum_3m", "above_200dma")
    ),
    arg(
      l(
        `Trigger leg: curve ${curve ?? "n/a"}%, CPI ${cpi ?? "n/a"}%. Real triggers — policy pivots, liquidity inflections — need Fed-meeting and flows data, insufficient this round. No trigger, no license for a concentrated bet.`,
        `触发器腿:曲线 ${curve ?? "n/a"}%,CPI ${cpi ?? "n/a"}%。政策转向、流动性拐点这类真正的触发器需要 Fed 会议/流量数据,本期证据不足——没有触发器,就没有集中下注的资格。`
      ),
      ids(ctx, "macro_T10Y2Y", "macro_CPIAUCSL"),
      true
    ),
    arg(
      l(
        `Asymmetry: ${pctFromHigh ?? "n/a"}% from the 1-year high. ${asymmetric ? "Trend entry with a clean stop — acceptable risk/reward, but this is trend-following, not the 10:1 setups I mean." : "The current odds structure is not asymmetric: upside runs on inertia, downside has no protection."}`,
        `非对称性:距一年高点 ${pctFromHigh ?? "n/a"}%。${asymmetric ? "顺势入场、止损明确,盈亏比可接受——但这是趋势跟随,不是我说的那种 10:1 机会。" : "当前赔率结构不是非对称机会:上行靠惯性,下行没有保护。"}`
      ),
      ids(ctx, "pct_from_high"),
      true
    ),
  ];

  const risks = [
    arg(
      l(
        "Admit mistakes fast: set the invalidation condition at entry. Below the 200DMA or 3-month momentum turning negative, the tactical position exits unconditionally — keep the opinion, not the position.",
        "错了就认:入场即设失效条件。跌破 200DMA 或 3 个月动量转负,战术仓无条件退出——观点可以留着,仓位不行。"
      ),
      ids(ctx, "above_200dma"),
      true
    ),
    arg(
      l(
        "This committee member's method is inherently high-risk: concentration + leverage belong only to trades with a clear edge and exit discipline. Not recommended by default.",
        "本委员的方法论天然高风险:集中+杠杆只属于有明确 edge 和退出纪律的交易,默认不推荐。"
      ),
      [],
      true
    ),
  ];

  return {
    persona: "soros",
    stance: stanceFromRating(rating),
    rating,
    confidence: 50,
    recommendedAction: asymmetric
      ? l(
          "A small tactical position with the trend is allowed: stop at the 200DMA; add only after the trend's self-reinforcement is confirmed by data.",
          "允许小额战术仓顺势参与:入场后止损设在 200DMA;加仓只在趋势自我强化被数据确认后。"
        )
      : l(
          "Not a tactical opportunity: no trigger, no asymmetric odds. This one is not mine — pass.",
          "不构成战术机会:没有触发器与非对称赔率,这笔不属于我,跳过。"
        ),
    summary: args[2].text,
    arguments: args,
    risks,
    challenge: l(
      "Is the opportunity asymmetric? If tomorrow proves you wrong, what exactly is your exit?",
      "机会是非对称的吗?如果明天证明你错了,你的退出计划是什么?"
    ),
    disagreements: [],
    citedEvidenceIds: collectCited([...args, ...risks]),
    dataFreshness: freshness(input),
    usesMockData: false,
  };
}
