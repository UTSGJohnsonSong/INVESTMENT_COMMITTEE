import type { PersonaOpinion } from "@/lib/types";
import { L, l } from "@/lib/i18n";
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

export function taleb(input: CommitteeInput): PersonaOpinion {
  const { ctx, isEtf } = input;
  const vol = val(ctx, "realized_vol");
  const mdd = val(ctx, "max_drawdown_1y");
  const de = val(ctx, "debt_to_equity");
  const fcf = val(ctx, "free_cash_flow");
  const pe = val(ctx, "pe_trailing");

  // Fragility screen. Any single condition can trigger the veto.
  const fragilities: L[] = [];
  if (vol !== null && vol > 60)
    fragilities.push(
      l(`${vol}% annualized volatility is blow-up-grade`, `年化波动 ${vol}% 属于爆仓级波动`)
    );
  if (mdd !== null && mdd < -45)
    fragilities.push(
      l(
        `a ${mdd}% drawdown within one year is a live sample of permanent loss`,
        `一年内回撤 ${mdd}%,永久性亏损的现实样本`
      )
    );
  if (de !== null && de > 2.5 && fcf !== null && fcf < 0)
    fragilities.push(
      l(
        `high leverage (D/E ${de}) + negative FCF: a financing-dependent fragile structure`,
        `高杠杆 (D/E ${de}) + 负自由现金流:融资依赖型脆弱结构`
      )
    );
  const vetoTriggered = fragilities.length > 0;

  let fragScore = 0;
  if (vol !== null) fragScore += vol > 45 ? 2 : vol > 30 ? 1 : 0;
  if (mdd !== null) fragScore += mdd < -35 ? 2 : mdd < -25 ? 1 : 0;
  if (de !== null) fragScore += de > 2 ? 2 : de > 1.2 ? 1 : 0;
  if (pe !== null && pe > 35) fragScore += 1;

  const positionCap = vetoTriggered ? 2 : fragScore >= 4 ? 3 : fragScore >= 2 ? 5 : 8;
  const rating = clamp(55 - fragScore * 6 - (vetoTriggered ? 15 : 0), 10, 60);

  const fcfWord = fcf !== null ? (fcf > 0 ? { en: "positive", zh: "正" } : { en: "negative", zh: "负" }) : { en: "n/a", zh: "n/a" };
  const args = [
    arg(
      l(
        `Fragility scan: volatility ${vol ?? "n/a"}%, max drawdown ${mdd ?? "n/a"}%, D/E ${de ?? "n/a"}, FCF ${fcfWord.en}. Fragility score ${fragScore}/7.`,
        `脆弱性扫描:波动 ${vol ?? "n/a"}%、最大回撤 ${mdd ?? "n/a"}%、D/E ${de ?? "n/a"}、FCF ${fcfWord.zh}。脆弱度 ${fragScore}/7。`
      ),
      ids(ctx, "realized_vol", "max_drawdown_1y", "debt_to_equity", "free_cash_flow")
    ),
    arg(
      isEtf
        ? l(
            "Worst case: a broad ETF going to zero requires systemic collapse, but 30–50% drawdowns are historical routine — size the position as if one WILL happen.",
            "Worst-case:宽基 ETF 归零需要系统性崩溃,但 30–50% 回撤是历史常态,必须按“会发生”来配置。"
          )
        : l(
            "Worst case: a single company has paths to zero — regulation, litigation, technological displacement, accounting fraud. None of these live inside historical volatility.",
            "Worst-case:单一公司存在归零路径——监管、诉讼、技术替代、财务造假,这些都不在历史波动率里。"
          ),
      ids(ctx, "max_drawdown_1y"),
      true
    ),
    arg(
      l(
        `Asymmetry principle: ask how much you lose before asking how much you make. ${pe !== null && pe > 30 ? `At P/E ${pe} the downside is nonlinear: multiple compression and earnings downgrades arrive together.` : "At this valuation the downside is mostly fundamental."}`,
        `不对称原则:先问亏多少,再问赚多少。${pe !== null && pe > 30 ? `当前估值下(P/E ${pe})下行是非线性的:估值收缩 × 盈利下修会同时发生。` : "当前估值下下行主要来自基本面本身。"}`
      ),
      ids(ctx, "pe_trailing"),
      true
    ),
  ];

  const risks = [
    arg(
      l(
        `Position cap ${positionCap}%: this is a veto line, not a suggestion. No argument may breach it — including the best argument.`,
        `仓位上限 ${positionCap}%:这是一票否决线,不是建议。任何论点都不能突破它——包括最好的论点。`
      ),
      [],
      true
    ),
    arg(
      l(
        "Hidden short volatility: if the position is big enough to force you to sell in a crash, you are short volatility without knowing it.",
        "隐藏的 short volatility:如果这个仓位大到让你在暴跌时被迫卖出,你实际上在做空波动率而不自知。"
      ),
      [],
      true
    ),
    arg(
      l(
        "Barbell alternative: 90% extremely safe assets + 10% high-convexity positions beats 100% medium risk.",
        "barbell 替代方案:90% 极安全资产 + 10% 高凸性仓位,好过 100% 中等风险。"
      ),
      [],
      true
    ),
  ];

  const fragListEn = fragilities.map((f) => f.en).join("; ");
  const fragListZh = fragilities.map((f) => f.zh).join(";");

  return {
    persona: "taleb",
    stance: stanceFromRating(rating),
    rating,
    confidence: 68,
    recommendedAction: vetoTriggered
      ? l(
          `VETO triggered: ${fragListEn}. Hard position cap ${positionCap}%, cash buffer mandatory.`,
          `一票否决触发:${fragListZh}。仓位硬上限 ${positionCap}%,且必须有现金缓冲。`
        )
      : l(
          `No veto, but a hard position cap of ${positionCap}%; any use of leverage or short-option "income" strategies flips this to an immediate veto.`,
          `不否决,但仓位硬上限 ${positionCap}%;若使用杠杆或期权卖方策略,直接否决。`
        ),
    summary: args[0].text,
    arguments: args,
    risks,
    challenge: l(
      "When the worst case happens, are you still alive? Will this position force you to sell at exactly the wrong moment?",
      "最坏情况发生时,你还活着吗?这个仓位会不会让你在错误的时刻被迫平仓?"
    ),
    disagreements: [],
    citedEvidenceIds: collectCited([...args, ...risks]),
    dataFreshness: freshness(input),
    usesMockData: false,
    veto: vetoTriggered
      ? {
          triggered: true,
          reason: l(fragListEn, fragListZh),
          effect: l(
            `Total position hard-capped at ${positionCap}%`,
            `总仓位硬上限降至 ${positionCap}%`
          ),
        }
      : undefined,
  };
}
