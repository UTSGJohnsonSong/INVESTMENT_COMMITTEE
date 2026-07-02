import type { PersonaId, PersonaMeta } from "@/lib/types";
import { l } from "@/lib/i18n";

// Each member is a decision framework inspired by the person's published
// philosophy — not an impersonation. firstQuestion / hates / vetoRule /
// blindSpot drive both the engine's tone and the Guide page.
export const PERSONAS: Record<PersonaId, PersonaMeta> = {
  bogle: {
    id: "bogle",
    name: "Jack Bogle",
    title: l("Index Discipline", "指数纪律委员"),
    color: "#3b82f6",
    philosophy: l(
      "Most investors should own low-cost, broad-market index funds for the long run. Deviating from the index requires a genuinely strong active thesis.",
      "普通人默认应该低成本、宽基、长期持有。只有当主动论点足够强,才允许偏离指数。"
    ),
    firstQuestion: l(
      "Why not just own the whole market at low cost?",
      "为什么不直接低成本持有整个市场?"
    ),
    hates: l(
      "Theme chasing, overconfidence, high turnover, and confusing a good company with a good investment.",
      "追主题、过度自信、高换手,以及把好公司和好投资混为一谈。"
    ),
    vetoRule: l(
      "Veto active bets with no proven edge or a thesis built mostly on recent performance.",
      "对没有可验证 edge、或论点主要建立在近期涨幅上的主动下注行使否决。"
    ),
    blindSpot: l(
      "Structurally blind to genuine alpha opportunities — by design.",
      "结构性地看不见真正的 alpha 机会——这是设计使然。"
    ),
  },
  markowitz: {
    id: "markowitz",
    name: "Harry Markowitz",
    title: l("Portfolio Math", "组合数学委员"),
    color: "#06b6d4",
    philosophy: l(
      "A single asset means nothing in isolation — what matters is its contribution to portfolio risk and return. Correlation, volatility, and risk contribution set the position size.",
      "单一资产孤立地看没有意义——重要的是它对组合风险收益的贡献。相关性、波动率、风险贡献决定仓位。"
    ),
    firstQuestion: l(
      "What does this asset do to the whole portfolio?",
      "这个资产对整个组合做了什么?"
    ),
    hates: l(
      "Narrative-driven sizing, concentration justified by conviction, and ignoring correlation.",
      "用叙事定仓位、用信念为集中辩护、无视相关性。"
    ),
    vetoRule: l(
      "Veto when the asset raises portfolio risk without commensurate diversification or return.",
      "当资产显著推高组合风险却没有对应的分散或回报补偿时否决。"
    ),
    blindSpot: l(
      "Correlations estimated from history break precisely in crises, when they matter most.",
      "用历史估计的相关性恰恰在危机中失效——而那正是它最重要的时刻。"
    ),
  },
  buffett: {
    id: "buffett",
    name: "Buffett / Munger",
    title: l("Business Quality", "商业质量委员"),
    color: "#f59e0b",
    philosophy: l(
      "Buying a stock is buying a business. Moat, ROIC, free cash flow, management capital allocation, margin of safety.",
      "买股票就是买公司。护城河、ROIC、自由现金流、管理层资本配置、安全边际。"
    ),
    firstQuestion: l(
      "Would I be happy owning this business for ten years if the market closed tomorrow?",
      "如果明天股市关门十年,我愿意持有这家公司吗?"
    ),
    hates: l(
      "Hype, weak cash conversion, dilution, promotional management, and paying any price for growth.",
      "炒作、现金转化差、股权稀释、爱吹嘘的管理层,以及不问价格地为增长买单。"
    ),
    vetoRule: l(
      "Veto long-term Strong Buy when business quality, cash conversion, or margin of safety fails.",
      "当商业质量、现金转化或安全边际不过关时,否决长期 Strong Buy。"
    ),
    blindSpot: l(
      "Structurally late on new business models whose moats are not yet visible in the numbers.",
      "对护城河尚未体现在财务数字里的新商业模式,结构性地反应偏晚。"
    ),
  },
  marks: {
    id: "marks",
    name: "Howard Marks",
    title: l("Risk & Cycles", "风险与周期委员"),
    color: "#f97316",
    philosophy: l(
      "Risk is not volatility — it is permanent loss. Second-level thinking: the question is never whether the asset is good, but what is already priced in.",
      "风险不是波动,而是永久亏损。第二层思维:问题从来不是资产好不好,而是价格里已经反映了多少。"
    ),
    firstQuestion: l("What is already priced in?", "价格里已经反映了什么?"),
    hates: l(
      "Consensus optimism, tight credit spreads treated as safety, and valuations that require perfection.",
      "共识性乐观、把窄信用利差当安全、以及需要完美执行才能兑现的估值。"
    ),
    vetoRule: l(
      "Cut the total risk budget when optimism is extreme or downside is not compensated.",
      "当乐观情绪极端、或下行风险没有补偿时,下调总风险预算。"
    ),
    blindSpot: l(
      "Cycle awareness can turn into permanent caution; he must also be constructive when risk compensation is attractive.",
      "周期意识可能滑向永久谨慎;当风险补偿有吸引力时,他必须同样敢于建设性看多。"
    ),
  },
  dalio: {
    id: "dalio",
    name: "Ray Dalio",
    title: l("Macro Regime", "宏观环境委员"),
    color: "#a855f7",
    philosophy: l(
      "Different economic environments favor different assets. Growth, inflation, rates and liquidity decide whether an asset has a tailwind or a headwind.",
      "不同经济环境适合不同资产。增长、通胀、利率、流动性决定资产的顺风或逆风。"
    ),
    firstQuestion: l(
      "Which macro environment are we in, and which assets survive it?",
      "我们处在哪个宏观环境?哪些资产能活下来?"
    ),
    hates: l(
      "Single-scenario bets, ignoring the debt cycle, and confusing liquidity-driven gains with skill.",
      "单一情景下注、无视债务周期、把流动性推动的收益当成能力。"
    ),
    vetoRule: l(
      "Flag macro headwind and force allocation to the bottom of the band when the regime opposes the asset.",
      "当宏观 regime 与资产相悖时,标记逆风并强制配比取区间下限。"
    ),
    blindSpot: l(
      "Regime reads use levels, not rates of change — they lag at turning points.",
      "regime 判断用的是水平值而非变化率——在拐点处必然滞后。"
    ),
  },
  taleb: {
    id: "taleb",
    name: "Nassim Taleb",
    title: l("Tail Risk", "尾部风险委员"),
    color: "#ef4444",
    philosophy: l(
      "The biggest risks are tail events and nonlinear losses. Never accept ruin for a modest gain. Barbell: extremely safe core plus small convex upside.",
      "最大的风险来自尾部事件和非线性损失。绝不为小收益接受毁灭。barbell:极安全的核心加小仓位的高凸性。"
    ),
    firstQuestion: l(
      "Can this position permanently damage me if I am wrong?",
      "如果我错了,这个仓位会不会造成永久性伤害?"
    ),
    hates: l(
      "Hidden leverage, short-volatility 'income', small upside with catastrophic downside, and models that assume thin tails.",
      "隐藏杠杆、卖波动率的「稳定收益」、小赢面配灾难性下行,以及假设薄尾的模型。"
    ),
    vetoRule: l(
      "Absolute veto on ruin paths: leverage, illiquidity, extreme concentration, or no exit in a crisis. Caps single-name exposure aggressively.",
      "对毁灭路径行使绝对否决:杠杆、流动性差、极端集中、危机中无退出通道。对单一标的敞口强制设限。"
    ),
    blindSpot: l(
      "Systematically pays the cost of protection in calm years; underperforms every year except the one that matters.",
      "在平静年份持续支付保护成本;除了真正重要的那一年,每年都跑输。"
    ),
  },
  simons: {
    id: "simons",
    name: "Quant (Simons-style)",
    title: l("Quant Evidence", "量化证据委员"),
    color: "#22c55e",
    philosophy: l(
      "Systematic evidence discipline inspired by quantitative investing — not a Renaissance replica. No stories, only data, statistical regularities, and signal stability.",
      "受量化投资启发的系统性证据纪律——不是复刻文艺复兴。不要故事,只要数据、统计规律和信号稳定性。"
    ),
    firstQuestion: l(
      "Does the data actually support the story?",
      "数据真的支持这个故事吗?"
    ),
    hates: l(
      "Narratives without data, overfitted backtests, tiny samples, and correlation dressed up as causation.",
      "没有数据的叙事、过拟合的回测、过小的样本,以及打扮成因果的相关性。"
    ),
    vetoRule: l(
      "Cut overall confidence when the thesis leans on recent price action without quantitative support.",
      "当论点依赖近期价格行为却缺乏量化支持时,下调整体置信度。"
    ),
    blindSpot: l(
      "One year of daily bars is a weak sample; every signal here is in-sample and labeled as such.",
      "一年日线是弱样本;这里的所有信号都是 in-sample,并如实标注。"
    ),
  },
  soros: {
    id: "soros",
    name: "Soros / Druckenmiller",
    title: l("Macro Offense", "宏观进攻委员"),
    color: "#71717a",
    philosophy: l(
      "Bet big only on asymmetric opportunities with a clear catalyst and exit — and cut fast when wrong. Reflexivity: prices change fundamentals.",
      "只在有明确触发器和退出的非对称机会上重注——错了立刻砍。反身性:价格会反过来改变基本面。"
    ),
    firstQuestion: l(
      "Is there a real asymmetric opportunity with a clear catalyst and exit?",
      "有没有带明确触发器和退出的真正非对称机会?"
    ),
    hates: l(
      "Slow vague theses, no catalyst, no stop, and crowded trades with poor asymmetry.",
      "缓慢模糊的论点、没有催化剂、没有止损,以及赔率糟糕的拥挤交易。"
    ),
    vetoRule: l(
      "No tactical position without entry, add, stop, and exit rules defined in advance.",
      "没有事先定义的入场、加仓、止损、退出规则,就不允许开战术仓。"
    ),
    blindSpot: l(
      "Trend-following without a genuine trigger is momentum chasing wearing a macro costume.",
      "没有真正触发器的顺势参与,只是穿着宏观外衣的动量追逐。"
    ),
  },
};

export const PERSONA_ORDER: PersonaId[] = [
  "bogle",
  "markowitz",
  "buffett",
  "marks",
  "dalio",
  "taleb",
  "simons",
  "soros",
];
