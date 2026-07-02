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

export function marks(input: CommitteeInput): PersonaOpinion {
  const { ctx } = input;
  const hyOas = val(ctx, "macro_BAMLH0A0HYM2");
  const curve = val(ctx, "macro_T10Y2Y");
  const cpi = val(ctx, "macro_CPIAUCSL");
  const pctFromHigh = val(ctx, "pct_from_high");
  const mom12 = val(ctx, "momentum_12m");
  const pe = val(ctx, "pe_trailing");

  // Temperature of the market: credit spreads + distance from highs + momentum.
  let greed = 0; // positive = greedy, negative = fearful
  if (hyOas !== null) greed += hyOas < 3 ? 2 : hyOas < 3.5 ? 1 : hyOas > 5 ? -2 : 0;
  if (pctFromHigh !== null) greed += pctFromHigh > -3 ? 1 : pctFromHigh < -20 ? -2 : 0;
  if (mom12 !== null) greed += mom12 > 30 ? 1 : mom12 < -15 ? -1 : 0;

  const mood =
    greed >= 3
      ? { en: "greedy, verging on frothy", zh: "贪婪偏泡沫" }
      : greed >= 1
        ? { en: "leaning optimistic", zh: "偏乐观" }
        : greed <= -2
          ? { en: "fearful", zh: "恐惧" }
          : { en: "normal, mildly cautious", zh: "正常偏谨慎" };

  const extremeGreed = greed >= 3;
  const rating = clamp(50 - greed * 7 + (pctFromHigh !== null && pctFromHigh < -15 ? 8 : 0), 15, 75);

  const args = [
    arg(
      l(
        `Market thermometer: high-yield spread ${hyOas ?? "n/a"}%${hyOas !== null && hyOas < 3.5 ? " — a spread this tight means credit markets are pricing in almost no bad news" : ""}, price ${pctFromHigh ?? "n/a"}% from its 1-year high, 12-month gain ${mom12 ?? "n/a"}%. Current mood: ${mood.en}.`,
        `市场温度计:高收益债利差 ${hyOas ?? "n/a"}%${hyOas !== null && hyOas < 3.5 ? "——利差这么窄,说明信用市场几乎没有为坏消息定价" : ""},价格距一年高点 ${pctFromHigh ?? "n/a"}%,12 个月涨幅 ${mom12 ?? "n/a"}%。当前情绪读数:${mood.zh}。`
      ),
      ids(ctx, "macro_BAMLH0A0HYM2", "pct_from_high", "momentum_12m")
    ),
    arg(
      l(
        `Cycle position: yield curve (10Y−2Y) at ${curve ?? "n/a"}%${curve !== null && curve < 0 ? ", still inverted — late-cycle behavior" : ""}; CPI ${cpi ?? "n/a"}%. We are most likely in the easy-credit, warm-sentiment phase — which is precisely where the seeds of low future returns get planted.`,
        `周期位置:收益率曲线(10Y-2Y)${curve ?? "n/a"}%${curve !== null && curve < 0 ? ",倒挂仍在,周期后段特征" : ""},CPI ${cpi ?? "n/a"}%。我们大概率处在信用宽松、情绪偏暖的阶段——这正是未来低回报的种子。`
      ),
      ids(ctx, "macro_T10Y2Y", "macro_CPIAUCSL")
    ),
    arg(
      pe !== null
        ? l(
            `How much optimism is already in the price? P/E ${pe}${pe > 30 ? " — the market has paid for flawless execution; any imperfection gets punished." : " — expectations are not extreme; pricing errors cut both ways."}`,
            `价格里已经装进了多少乐观?P/E ${pe}${pe > 30 ? "——市场已经为完美执行付了钱,任何不完美都会被惩罚。" : "——预期不算极端,价格错误的空间双向存在。"}`
          )
        : l(
            "Valuation evidence missing — cannot judge how much expectation is embedded in the price.",
            "估值证据缺失,无法判断价格中的预期水位。"
          ),
      ids(ctx, "pe_trailing")
    ),
  ];

  const risks = [
    arg(
      l(
        "The classic mistake: confusing a good asset with a good entry point when sentiment is warm. Risk is highest exactly when it feels lowest.",
        "最容易犯的错:在情绪偏暖时把“好资产”和“好买点”混为一谈。风险最高的时刻,恰恰是感觉风险最低的时刻。"
      ),
      [],
      true
    ),
    arg(
      l(
        `Downside scenario: if the mood swings from "${mood.en}" back to fear, high-vol assets fall far more than fundamentals change — see the historical drawdown.`,
        `Downside scenario:若情绪从${mood.zh}回到恐惧,高波动资产的回撤会远超基本面变化——参考其历史回撤幅度。`
      ),
      ids(ctx, "max_drawdown_1y"),
      true
    ),
  ];

  return {
    persona: "marks",
    stance: stanceFromRating(rating),
    rating,
    confidence: 65,
    recommendedAction: extremeGreed
      ? l(
          "Sentiment overheated: adding here means being greedy when others are greedy. Scale in, hold cash back, wait for better prices.",
          "情绪过热:此时加仓等于在别人贪婪时更贪婪。分批、留出现金、等更好的价格。"
        )
      : l(
          "Cycle not at an extreme: participation is fine, but size the position so you can add after a further 20% drop.",
          "周期不极端:可以参与,但仓位要为“买完继续跌 20%”的情形留出加仓空间。"
        ),
    summary: args[0].text,
    arguments: args,
    risks,
    challenge: l(
      "Is all the good news already in the price? How much of what you are paying is optimism?",
      "价格是否已经反映了所有好消息?你付的价格里,乐观占了几成?"
    ),
    disagreements: [],
    citedEvidenceIds: collectCited([...args, ...risks]),
    dataFreshness: freshness(input),
    usesMockData: false,
    veto: extremeGreed
      ? {
          triggered: true,
          reason: l(
            `Market temperature = ${mood.en} (HY OAS ${hyOas}%, ${pctFromHigh}% from high)`,
            `市场温度=${mood.zh}(HY OAS ${hyOas}%,距高点 ${pctFromHigh}%)`
          ),
          effect: l("Total position cap reduced by 30%", "总仓位上限下调 30%"),
        }
      : undefined,
  };
}
