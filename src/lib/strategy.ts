// Strategy round: no single ticker. The committee reads the current macro
// evidence plus trend/vol state of four reference assets (SPY equities,
// QQQ growth, TLT duration, GLD gold) and debates how to be positioned NOW.
// Output: persona takes + three allocation plans at three risk thresholds.
// Same rules as everywhere: every tilt away from the base template must cite
// evidence; vetoes constrain the aggressive plan.
import type {
  Direction,
  Evidence,
  MacroSnapshot,
  PersonaId,
} from "@/lib/types";
import { L, l } from "@/lib/i18n";
import { getMacroSnapshots } from "@/lib/sources/fred";
import { computeQuantStats, getMarketData } from "@/lib/sources/market";

export interface PersonaTake {
  persona: PersonaId;
  stance: Direction;
  text: L;
  evidenceIds: string[];
}

export interface AllocationLine {
  bucket: L;
  instrument: string;
  weight: number;
  role: L;
  note: L;
  supporters: string[]; // committee member names backing this line
  evidenceIds: string[];
}

export interface StrategyPlan {
  id: "conservative" | "balanced" | "aggressive";
  name: L;
  subtitle: L;
  suitableFor: L;
  objective: L;
  corePhilosophy: L;
  riskThreshold: L;
  allocations: AllocationLine[];
  behavior: L;
  whyDifferent: L; // why this plan differs from the other two
  adjustmentRules: L[];
  cashDeploymentRules: L[];
  moreAggressiveIf: L[];
  moreDefensiveIf: L[];
  monitoring: L[];
  killCriteria: L[];
}

export interface StrategyResult {
  generatedAt: string;
  macro: MacroSnapshot[];
  evidence: Evidence[];
  regimeSummary: L[];
  takes: PersonaTake[];
  plans: StrategyPlan[];
  constraints: L[];
  disclaimers: L[];
}

const REF_ASSETS = [
  { ticker: "SPY", label: l("US large-cap (SPY)", "美股大盘 (SPY)") },
  { ticker: "QQQ", label: l("Growth/tech (QQQ)", "成长/科技 (QQQ)") },
  { ticker: "TLT", label: l("Long-duration treasuries (TLT)", "长久期美债 (TLT)") },
  { ticker: "GLD", label: l("Gold (GLD)", "黄金 (GLD)") },
];

let cached: { result: StrategyResult; expires: number } | null = null;

export async function buildStrategy(): Promise<StrategyResult> {
  if (cached && cached.expires > Date.now()) return cached.result;

  const [macro, ...markets] = await Promise.all([
    getMacroSnapshots().catch(() => [] as MacroSnapshot[]),
    ...REF_ASSETS.map((a) => getMarketData(a.ticker).catch(() => null)),
  ]);

  // ---- Evidence assembly (own id space, prefixed S) ----
  let n = 0;
  const evidence: Evidence[] = [];
  const byKey = new Map<string, Evidence>();
  const push = (key: string, e: Omit<Evidence, "id">) => {
    const row: Evidence = { ...e, id: `S${++n}` };
    evidence.push(row);
    byKey.set(key, row);
    return row;
  };

  for (const m of macro) {
    let direction: Direction = "neutral";
    if (m.seriesId === "T10Y2Y") direction = m.value < 0 ? "bearish" : "neutral";
    if (m.seriesId === "CPIAUCSL")
      direction = m.value > 3.2 ? "bearish" : m.value < 2.5 ? "bullish" : "neutral";
    if (m.seriesId === "BAMLH0A0HYM2")
      direction = m.value > 5 ? "bearish" : m.value < 3.2 ? "bullish" : "neutral";
    if (m.seriesId === "UNRATE") direction = m.value > 4.5 ? "bearish" : "neutral";
    push(`macro_${m.seriesId}`, {
      statement: l(
        `${m.label}: ${m.value}${m.unit} (observation ${m.observationDate})`,
        `${m.label}:${m.value}${m.unit}(观测日 ${m.observationDate})`
      ),
      direction,
      tags: ["macro"],
      citation: {
        sourceName: `FRED ${m.seriesId}`,
        sourceUrl: m.url,
        sourceLevel: "P0",
        sourceType: "fred_series",
        publishedAt: m.observationDate,
        retrievedAt: m.retrievedAt,
        seriesId: m.seriesId,
        excerpt: m.derived ?? `${m.seriesId} = ${m.value} on ${m.observationDate}`,
      },
      metricName: `macro_${m.seriesId}`,
      metricValue: m.value,
      metricUnit: m.unit,
      confidence: 92,
      isMock: false,
    });
  }

  const refStats: Record<string, ReturnType<typeof computeQuantStats> | null> = {};
  REF_ASSETS.forEach((a, i) => {
    const mkt = markets[i];
    if (!mkt) {
      refStats[a.ticker] = null;
      return;
    }
    const q = computeQuantStats(mkt);
    refStats[a.ticker] = q;
    push(`ref_${a.ticker}`, {
      statement: l(
        `${a.label.en}: 12m ${q.momentum12m ?? "n/a"}%, 3m ${q.momentum3m ?? "n/a"}%, ${q.above200dma === null ? "200DMA n/a" : q.above200dma ? "above 200DMA" : "below 200DMA"}, annualized vol ${q.realizedVol ?? "n/a"}% (delayed ${q.lastPriceTime.slice(0, 10)})`,
        `${a.label.zh}:12m ${q.momentum12m ?? "n/a"}%,3m ${q.momentum3m ?? "n/a"}%,${q.above200dma === null ? "200DMA n/a" : q.above200dma ? "站上 200DMA" : "跌破 200DMA"},年化波动 ${q.realizedVol ?? "n/a"}%(延迟 ${q.lastPriceTime.slice(0, 10)})`
      ),
      direction:
        q.momentum12m !== null && q.momentum12m > 5 && q.above200dma
          ? "bullish"
          : q.momentum12m !== null && q.momentum12m < -5
            ? "bearish"
            : "neutral",
      tags: ["market", "quant"],
      citation: {
        sourceName: "Yahoo Finance chart API (delayed)",
        sourceUrl: `https://finance.yahoo.com/quote/${a.ticker}`,
        sourceLevel: "P1",
        sourceType: "market_quote",
        publishedAt: q.lastPriceTime,
        retrievedAt: mkt.retrievedAt,
        excerpt: `computed from ${mkt.history.length} daily closes`,
      },
      metricName: `ref_${a.ticker}`,
      metricValue: q.momentum12m ?? 0,
      confidence: 78,
      isMock: false,
    });
  });

  const v = (k: string) => byKey.get(k)?.metricValue ?? null;
  const eid = (...keys: string[]) =>
    keys.map((k) => byKey.get(k)?.id).filter((x): x is string => !!x);

  const cpi = v("macro_CPIAUCSL");
  const dff = v("macro_DFF");
  const curve = v("macro_T10Y2Y");
  const hy = v("macro_BAMLH0A0HYM2");
  const unrate = v("macro_UNRATE");
  const realRate = cpi !== null && dff !== null ? Math.round((dff - cpi) * 100) / 100 : null;
  const spy = refStats["SPY"];
  const spyTrendUp = spy?.above200dma === true;
  const complacent = hy !== null && hy < 3.2;
  const inflationHot = cpi !== null && cpi > 3.2;
  const curveInverted = curve !== null && curve < 0;

  // ---- Regime summary ----
  const regimeSummary: L[] = [];
  if (cpi !== null)
    regimeSummary.push(
      inflationHot
        ? l(
            `Inflation at ${cpi}%, above target — purchasing power is leaking; cash is not a zero-risk asset`,
            `通胀 ${cpi}% 高于目标——实际购买力在流失,现金不是零风险资产`
          )
        : l(`Inflation at ${cpi}%, within the manageable range`, `通胀 ${cpi}%,可控区间`)
    );
  if (realRate !== null)
    regimeSummary.push(
      realRate < 0.5
        ? l(
            `Real policy rate ≈ ${realRate}%, monetary conditions lean easy — a tailwind for risk assets, a penalty on cash`,
            `实际政策利率约 ${realRate}%,货币条件偏宽松——对风险资产是顺风,对现金是惩罚`
          )
        : l(
            `Real policy rate ≈ ${realRate}%, monetary conditions lean tight`,
            `实际政策利率约 ${realRate}%,货币条件偏紧`
          )
    );
  if (hy !== null)
    regimeSummary.push(
      complacent
        ? l(
            `High-yield spread at ${hy}% is extremely tight — credit markets are pricing in no bad news. That is a sentiment gauge, not a safety gauge`,
            `高收益利差 ${hy}% 极窄——信用市场没有为任何坏消息定价,这是情绪指标,不是安全指标`
          )
        : l(`High-yield spread at ${hy}%`, `高收益利差 ${hy}%`)
    );
  if (spy)
    regimeSummary.push(
      spyTrendUp
        ? l("US equity trend intact (SPY above its 200DMA)", "美股趋势完好(SPY 站上 200DMA)")
        : l("US equity trend weakening (SPY below its 200DMA)", "美股趋势转弱(SPY 跌破 200DMA)")
    );

  // ---- Persona takes ----
  const takes: PersonaTake[] = [
    {
      persona: "dalio",
      stance: realRate !== null && realRate < 0.5 && !curveInverted ? "bullish" : "neutral",
      text: l(
        `Regime: ${inflationHot ? "inflation elevated" : "inflation contained"} × ${unrate !== null && unrate > 4.8 ? "growth weakening" : "growth resilient"}, real rate ${realRate ?? "n/a"}%. ${inflationHot ? "In this environment cash and nominal bonds are both being eroded; real assets (gold) and equities with pricing power are the hedges." : "The environment is friendly to a balanced book."} The three plans should differ only in risk budget, not in directional view.`,
        `Regime:${inflationHot ? "通胀偏高" : "通胀可控"} × ${unrate !== null && unrate > 4.8 ? "增长走弱" : "增长有韧性"},实际利率 ${realRate ?? "n/a"}%。${inflationHot ? "这种环境下现金和名义债券都在被通胀侵蚀,实物资产(黄金)和股票里有定价权的部分是对冲。" : "环境对均衡组合友好。"}三套方案的差异应该只是风险预算,不是方向判断。`
      ),
      evidenceIds: eid("macro_CPIAUCSL", "macro_DFF", "macro_UNRATE", "macro_T10Y2Y"),
    },
    {
      persona: "marks",
      stance: complacent ? "bearish" : "neutral",
      text: complacent
        ? l(
            `The credit spread at ${hy}% is the reading I care about most — the market is pricing in essentially no bad news. Not a crash call, but a signal that future returns have been prepaid: raising the risk budget here is being greedy when others are greedy. All three plans should hold more cash than in normal times.`,
            `信用利差 ${hy}% 是我最在意的读数——市场几乎没有为坏消息定价。这不是崩盘预测,而是「未来回报被预支」的信号:此时提高风险预算,等于在别人贪婪时更贪婪。三套方案都应该比正常时期多留现金。`
          )
        : l(
            "Credit and sentiment readings are not extreme; allocate as in a normal cycle.",
            "信用与情绪读数不极端,按正常周期配置即可。"
          ),
      evidenceIds: eid("macro_BAMLH0A0HYM2", "ref_SPY"),
    },
    {
      persona: "bogle",
      stance: "bullish",
      text: l(
        "Whichever plan you pick, implement the equity leg with low-cost broad index ETFs (VT/VTI/SPY) — never a basket of hand-picked stocks. What decides your wealth in ten years is not this month's tactics but cost, diversification, and whether you can hold on. Pick a plan, then stop fiddling.",
        "无论哪套方案,股票腿都用低成本宽基指数 ETF 实现(VT/VTI/SPY),不要用个股拼凑。真正决定你十年后财富的不是这个月的战术,而是成本、分散、和你能不能拿住。选一套方案,然后停止折腾。"
      ),
      evidenceIds: eid("ref_SPY"),
    },
    {
      persona: "markowitz",
      stance: "neutral",
      text: l(
        "The three plans are three points on the same efficient frontier. The correlation structure across equities, long bonds, gold and cash is what keeps portfolio volatility far below any single asset — note the current trend state of TLT and GLD (see evidence): they are diversifiers, not return engines.",
        "三套方案的本质是同一条有效前沿上的三个点。股票、长债、黄金、现金四类资产的相关性结构决定了组合波动远低于单一资产——注意 TLT 与 GLD 当前的趋势状态(见证据),它们是分散器,不是收益引擎。"
      ),
      evidenceIds: eid("ref_TLT", "ref_GLD"),
    },
    {
      persona: "buffett",
      stance: complacent ? "neutral" : "bullish",
      text: l(
        `Be fearful when others are greedy — ${complacent ? "credit markets look plainly greedy right now, so I would not be fully invested; but I would not go to cash either: timing is unknowable, compounding is not" : "sentiment is not extreme"}. Within the equity leg I favor pricing power and high ROIC (via a quality tilt or direct holdings) over paying up for stories.`,
        `别人贪婪时恐惧——现在${complacent ? "信用市场明显偏贪婪,所以我不会满仓,但也不清仓:时机不可测,好资产的复利可测" : "情绪不极端"}。股票腿里我偏好有定价权、高 ROIC 的公司(通过质量因子或直接持有),而不是为故事付溢价。`
      ),
      evidenceIds: eid("macro_BAMLH0A0HYM2"),
    },
    {
      persona: "taleb",
      stance: "bearish",
      text: l(
        "I impose only hard constraints on all three plans: cash + short bonds never below 10%; no leverage; no selling options for \"steady income\". The aggressive plan's 80% equity means you must survive -40% without selling — if you can't, you did not pick the aggressive plan, you pre-ordered a panic sale. Barbell: extremely safe plus small high-convexity, never the marketed middle.",
        "我对三套方案只有硬约束:任何方案现金+短债不得低于 10%;禁止杠杆;禁止卖期权收「稳定收益」。激进方案的 80% 股票意味着你要能承受 -40% 而不卖——如果做不到,你选的不是激进方案,是未来的恐慌性卖出。barbell:要么极安全,要么小仓位高凸性,中间的「稳健高收益」是营销话术。"
      ),
      evidenceIds: eid("ref_SPY", "ref_QQQ"),
    },
    {
      persona: "simons",
      stance: spyTrendUp ? "bullish" : "bearish",
      text: l(
        `Signals speak: ${REF_ASSETS.map((a) => {
          const q = refStats[a.ticker];
          return q
            ? `${a.ticker} ${q.above200dma ? "trend↑" : "trend↓"} (12m ${q.momentum12m ?? "n/a"}%)`
            : `${a.ticker} n/a`;
        }).join(", ")}. Trend filter rule: when the equity leg breaks its 200DMA, move the tactical part (not everything) to cash — one of the few rules with statistical support.`,
        `信号说话:${REF_ASSETS.map((a) => {
          const q = refStats[a.ticker];
          return q
            ? `${a.ticker} ${q.above200dma ? "趋势↑" : "趋势↓"}(12m ${q.momentum12m ?? "n/a"}%)`
            : `${a.ticker} n/a`;
        }).join(",")}。趋势过滤规则:股票腿跌破 200DMA 时,把战术部分(不是全部)转入现金——这是有统计支持的少数几个规则之一。`
      ),
      evidenceIds: eid("ref_SPY", "ref_QQQ", "ref_TLT", "ref_GLD"),
    },
    {
      persona: "soros",
      stance: "neutral",
      text: l(
        "There is no asymmetric setup of the kind I want right now (policy inflection, currency dislocation, forced sellers). When there is no opportunity, the best position is patience: balanced allocation plus cash as dry powder. When the real opportunity arrives you will need that cash — and it will not feel like an opportunity, it will feel like a disaster.",
        "当前没有我要的那种非对称机会(政策拐点、汇率错位、被迫抛售)。没有机会时,最好的仓位是耐心:平衡配置+现金 dry powder。真正的机会出现时,你会需要这笔现金——而且那时你不会觉得它是机会,会觉得它是灾难。"
      ),
      evidenceIds: eid("macro_T10Y2Y", "macro_DFF"),
    },
  ];

  // ---- Three plans: base templates + evidence-driven tilts ----
  // Tilt rules (each cites evidence):
  //   complacent credit  -> equity -5 → cash (Marks veto, all plans)
  //   inflation hot      -> gold +5 ← long bonds (Dalio)
  //   SPY below 200DMA   -> equity -10 → cash (Simons trend filter)
  const tiltNotes: L[] = [];
  const eqTilt = (complacent ? -5 : 0) + (!spyTrendUp && spy ? -10 : 0);
  const goldFromBonds = inflationHot ? 5 : 0;
  if (complacent)
    tiltNotes.push(
      l("Marks: credit spread too tight → equity -5% to cash", "Marks:信用利差过窄 → 股票 -5% 转现金")
    );
  if (inflationHot)
    tiltNotes.push(
      l("Dalio: inflation elevated → long bonds -5% to gold", "Dalio:通胀偏高 → 长债 -5% 转黄金")
    );
  if (!spyTrendUp && spy)
    tiltNotes.push(
      l("Simons: SPY below 200DMA → equity another -10% to cash", "Simons:SPY 跌破 200DMA → 股票再 -10% 转现金")
    );

  interface PlanSpec {
    id: StrategyPlan["id"];
    name: L;
    subtitle: L;
    suitableFor: L;
    objective: L;
    corePhilosophy: L;
    riskThreshold: L;
    eq: number;
    growth: number;
    bonds: number;
    gold: number;
    behavior: L;
    whyDifferent: L;
    moreAggressiveIf: L[];
    moreDefensiveIf: L[];
  }

  const mkPlan = (p: PlanSpec): StrategyPlan => {
    const eqAdj = Math.max(p.eq + eqTilt, 10);
    const bondsAdj = Math.max(p.bonds - goldFromBonds, 0);
    const goldAdj = p.gold + goldFromBonds;
    const cash = Math.max(100 - eqAdj - p.growth - bondsAdj - goldAdj, 10);
    const alloc: AllocationLine[] = [
      {
        bucket: l("Global/US broad equity", "全球/美股宽基"),
        instrument: "VT / VTI / SPY",
        weight: eqAdj,
        role: l("Return engine", "收益引擎"),
        note: l(
          `Base ${p.eq}%${eqTilt !== 0 ? `, evidence tilt ${eqTilt}%` : ""}`,
          `基准 ${p.eq}%${eqTilt !== 0 ? `,证据调整 ${eqTilt}%` : ""}`
        ),
        supporters: ["Jack Bogle", "Buffett / Munger"],
        evidenceIds: eid("ref_SPY", "macro_BAMLH0A0HYM2"),
      },
      ...(p.growth > 0
        ? [
            {
              bucket: l("Growth satellite", "成长卫星"),
              instrument: "QQQ",
              weight: p.growth,
              role: l("Offense, trend-gated", "进攻腿,受趋势约束"),
              note: l(
                "Aggressive plan only; cut this leg unconditionally below the 200DMA",
                "仅进攻方案;跌破 200DMA 无条件清掉此腿"
              ),
              supporters: ["Quant (Simons-style)", "Soros / Druckenmiller"],
              evidenceIds: eid("ref_QQQ"),
            },
          ]
        : []),
      {
        bucket: l("Long-duration treasuries", "长久期美债"),
        instrument: "TLT / IEF",
        weight: bondsAdj,
        role: l("Recession hedge", "衰退对冲"),
        note: inflationHot
          ? l(`Inflation elevated; base ${p.bonds}% trimmed`, `通胀偏高,基准 ${p.bonds}% 下调`)
          : l("Works when growth breaks", "增长断裂时起作用"),
        supporters: ["Ray Dalio", "Harry Markowitz"],
        evidenceIds: eid("ref_TLT", "macro_CPIAUCSL"),
      },
      {
        bucket: l("Gold", "黄金"),
        instrument: "GLD / physical",
        weight: goldAdj,
        role: l("Inflation / debasement hedge", "通胀/货币贬值对冲"),
        note: inflationHot
          ? l("Inflation hedge, evidence bonus +5%", "通胀对冲,证据加成 +5%")
          : l("Tail hedge", "尾部对冲"),
        supporters: ["Ray Dalio", "Nassim Taleb"],
        evidenceIds: eid("ref_GLD", "macro_CPIAUCSL"),
      },
      {
        bucket: l("Cash / short bonds", "现金/短债"),
        instrument: "BIL / MMF / HISA",
        weight: Math.round(cash * 10) / 10,
        role: l("Survival floor + dry powder", "生存底线 + 弹药"),
        note: l(
          "Taleb floor 10%; doubles as Soros's dry powder",
          "Taleb 下限 10%;也是 Soros 的 dry powder"
        ),
        supporters: ["Nassim Taleb", "Soros / Druckenmiller", "Howard Marks"],
        evidenceIds: eid("macro_DFF"),
      },
    ];
    return {
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      suitableFor: p.suitableFor,
      objective: p.objective,
      corePhilosophy: p.corePhilosophy,
      riskThreshold: p.riskThreshold,
      allocations: alloc,
      behavior: p.behavior,
      whyDifferent: p.whyDifferent,
      moreAggressiveIf: p.moreAggressiveIf,
      moreDefensiveIf: p.moreDefensiveIf,
      adjustmentRules: [
        l(
          "Rebalance on bands, not on dates: when any leg drifts >5 percentage points from target, rebalance back — mechanically, without a view.",
          "按区间而非日期再平衡:任何一条腿偏离目标超过 5 个百分点即机械回调,不带观点。"
        ),
        l(
          "Market up big: do nothing until a band is breached; then trim the winner into cash/bonds. Never chase by raising the equity target.",
          "大涨时:未触发区间就什么都不做;触发后把盈利腿削回现金/债券。绝不通过上调股票目标来追涨。"
        ),
        l(
          "Market down big: rebalance into equities only at band triggers, in tranches — this is the only sanctioned form of buying the dip.",
          "大跌时:只在触发区间时分批向股票再平衡——这是唯一被许可的抄底形式。"
        ),
        l(
          "Macro regime change (per Dalio's read): shift one risk tier, do not improvise a new allocation.",
          "宏观 regime 变化(以 Dalio 的判断为准):整体移动一档风险层级,不要临场发明新配比。"
        ),
      ],
      cashDeploymentRules: [
        l(
          "New cash enters via 3–6 monthly tranches into the underweight legs, never all at once.",
          "新资金分 3–6 个月、按月投入低配的腿,绝不一次性入场。"
        ),
        l(
          "The cash floor (10%) is never deployed on dips — it is survival money, not opportunity money. Opportunity money is anything above the floor.",
          "现金底线(10%)永远不用于抄底——它是生存资金,不是机会资金。机会资金只包括底线以上的部分。"
        ),
      ],
      monitoring: [
        l(
          "Weekly: SPY vs 200DMA (trend filter), high-yield spread level.",
          "每周:SPY 与 200DMA 的关系(趋势过滤)、高收益利差水平。"
        ),
        l(
          "Monthly: CPI print, FOMC path, portfolio drift vs bands.",
          "每月:CPI 数据、FOMC 路径、组合相对区间的漂移。"
        ),
        l(
          "Quarterly: re-run this strategy page; check whether any tilt or veto changed.",
          "每季:重跑本策略页,检查证据调整或 veto 是否变化。"
        ),
      ],
      killCriteria: [
        l(
          "SPY below 200DMA with 3-month momentum negative → cut the equity leg to the next plan down",
          "SPY 跌破 200DMA 且 3 个月动量转负 → 股票腿降至下一档方案的水平"
        ),
        l(
          "High-yield spread through 5% → move the whole book down one risk tier",
          "高收益利差突破 5% → 全组合降一档风险"
        ),
        l(
          "CPI re-accelerates (>4.5%) → zero the long-bond leg, gold cap +5%",
          "CPI 重新加速 (>4.5%) → 长债腿清零,黄金上限 +5%"
        ),
      ],
    };
  };

  const plans: StrategyPlan[] = [
    mkPlan({
      id: "conservative",
      name: l("Conservative", "保守"),
      subtitle: l(
        "Survive first. No drawdown in any single year that costs you sleep.",
        "先活下来。任何一年都不出现让你失眠的回撤。"
      ),
      suitableFor: l(
        "Money needed within 1–3 years; a first portfolio; periods when risk compensation is unattractive.",
        "1–3 年内要用的钱;第一次建立的组合;风险补偿不具吸引力的时期。"
      ),
      objective: l(
        "Beat cash + inflation modestly while making forced selling essentially impossible.",
        "小幅跑赢现金+通胀,同时让被迫卖出几乎不可能发生。"
      ),
      corePhilosophy: l(
        "Capital preservation first. Returns are optional; survival is not. The plan's enemy is not low returns — it is the panic sale at the bottom.",
        "保本第一。收益是可选项,活着不是。这套方案的敌人不是低收益,而是底部的恐慌性卖出。"
      ),
      riskThreshold: l("Max drawdown tolerance ≈ -10%", "最大回撤容忍 ≈ -10%"),
      eq: 30, growth: 0, bonds: 20, gold: 10,
      behavior: l(
        "Expect: returns modestly above cash+inflation; single-digit losses in extreme years.",
        "预期:回报略高于现金+通胀,极端年份亏损个位数。"
      ),
      whyDifferent: l(
        "vs Balanced: 20 points less equity and double the cash — it trades most of the upside for the near-certainty of staying invested. vs Aggressive: it refuses the growth satellite entirely.",
        "对比平衡:股票少 20 个百分点、现金翻倍——用大部分上行空间换取「拿得住」的确定性。对比进攻:完全拒绝成长卫星腿。"
      ),
      moreAggressiveIf: [
        l("Time horizon extends beyond 5 years", "资金期限延长到 5 年以上"),
        l("Credit spreads widen past 5% (risk finally compensated)", "信用利差突破 5%(风险终于有补偿)"),
        l("A 20%+ market drawdown resets valuations", "市场回撤 20%+ 重置估值"),
      ],
      moreDefensiveIf: [
        l("The money's use date moves within 12 months", "用钱日期进入 12 个月内"),
        l("You lost sleep during the last 5% dip", "上一次 5% 回调就已让你失眠"),
      ],
    }),
    mkPlan({
      id: "balanced",
      name: l("Balanced", "平衡"),
      subtitle: l(
        "The standard answer. One leg is always working, whatever the macro does.",
        "标准答案。任何宏观环境里都有一条腿在工作。"
      ),
      suitableFor: l(
        "5+ year capital with medium drawdown tolerance — the default for long-term wealth building.",
        "5 年以上、中等回撤承受力的资金——长期财富积累的默认选择。"
      ),
      objective: l(
        "Compound near equity-like returns with materially less pain, and stay invested through full cycles.",
        "以显著更小的痛苦获得接近股票的复利,并完整穿越周期。"
      ),
      corePhilosophy: l(
        "All-weather: growth, recession, inflation and deflation each have an asset that works. Win by weights and rebalancing, not by forecasts. Broad ETF core, no hero trades.",
        "全天候:增长、衰退、通胀、通缩各有一条在工作的腿。靠配比和再平衡赢,不靠预测。宽基 ETF 核心,没有英雄交易。"
      ),
      riskThreshold: l("Max drawdown tolerance ≈ -20%", "最大回撤容忍 ≈ -20%"),
      eq: 50, growth: 0, bonds: 20, gold: 10,
      behavior: l(
        "Expect: long-run returns near a stock/bond balanced book; 15–20% drawdowns in 2008/2022-grade environments.",
        "预期:长期年化接近股债平衡组合,2008/2022 级别环境回撤 15-20%。"
      ),
      whyDifferent: l(
        "This is the reference point the other two deviate from. Conservative pays for safety with return; Aggressive pays for return with path pain. Balanced pays neither premium — which is exactly why it is the default.",
        "它是另外两套方案偏离的基准点。保守用收益买安全;进攻用路径痛苦买收益。平衡两种溢价都不付——这正是它作为默认答案的原因。"
      ),
      moreAggressiveIf: [
        l("Horizon extends to 10+ years with stable income", "期限延长到 10 年以上且现金流稳定"),
        l("Valuations reset 20%+ while trend stabilizes", "估值回撤 20%+ 且趋势企稳"),
        l("You have already sat through one full bear market without selling", "你已经完整扛过一次熊市而没有卖出"),
      ],
      moreDefensiveIf: [
        l("Horizon shortens below 5 years", "期限缩短到 5 年以内"),
        l("Credit spreads compress further while optimism rises (worse risk compensation)", "信用利差进一步压缩且乐观升温(风险补偿更差)"),
        l("Income stability deteriorates", "收入稳定性恶化"),
      ],
    }),
    mkPlan({
      id: "aggressive",
      name: l("Aggressive", "进攻"),
      subtitle: l(
        "Disciplined offense, not emotional chasing.",
        "有纪律的进攻,不是情绪化追涨。"
      ),
      suitableFor: l(
        "10+ year capital, stable income, and demonstrated ability to sit through 30%+ drawdowns. Most people overestimate this ability.",
        "10 年以上的资金、稳定收入,以及被验证过能扛住 30%+ 回撤的能力。大多数人高估自己。"
      ),
      objective: l(
        "Maximize long-run compounding by accepting the most painful path — with trend and risk controls as the discipline, not conviction.",
        "接受最痛苦的路径以最大化长期复利——纪律来自趋势与风险控制,不是信念。"
      ),
      corePhilosophy: l(
        "Higher equity and growth exposure is only earned when evidence, trend and risk controls all support it. The growth satellite is trend-gated: it exists at the market's permission, not yours.",
        "更高的股票和成长敞口必须由证据、趋势和风险控制共同批准。成长卫星腿受趋势门控:它的存在取决于市场的许可,不是你的意愿。"
      ),
      riskThreshold: l("Max drawdown tolerance ≈ -35% or deeper", "最大回撤容忍 ≈ -35% 或更深"),
      eq: 60, growth: 15, bonds: 5, gold: 5,
      behavior: l(
        "Expect: highest long-run return, most painful path; 30–40% bear-market drawdowns are routine, not accidents.",
        "预期:长期年化最高,但路径最痛苦;熊市回撤 30-40% 是常态而非意外。"
      ),
      whyDifferent: l(
        "vs Balanced: +25 points of equity exposure including a 15% trend-gated QQQ satellite, and the hedging legs cut to the bone. The extra return is paid for entirely in drawdown depth — there is no free lunch hidden here.",
        "对比平衡:股票敞口多 25 个百分点,含 15% 受趋势门控的 QQQ 卫星,对冲腿压到最低。多出来的收益全部用回撤深度支付——这里没有藏着免费午餐。"
      ),
      moreAggressiveIf: [
        l("Nothing. This is the ceiling — beyond it is leverage, which Taleb vetoes unconditionally.", "没有。这已是上限——再往上就是杠杆,Taleb 无条件否决。"),
      ],
      moreDefensiveIf: [
        l("The QQQ satellite breaks its 200DMA (mandatory, not optional)", "QQQ 卫星跌破 200DMA(强制,非可选)"),
        l("Income stability weakens or horizon shortens", "收入稳定性下降或期限缩短"),
        l("You notice yourself checking prices daily — that is the tell", "你发现自己开始每天看盘——这就是信号"),
      ],
    }),
  ];

  const result: StrategyResult = {
    generatedAt: new Date().toISOString(),
    macro,
    evidence,
    regimeSummary,
    takes,
    plans,
    constraints: [
      l(
        "Taleb hard constraints: cash + short bonds ≥ 10% in every plan; no leverage; no naked option selling.",
        "Taleb 硬约束:任何方案现金+短债 ≥ 10%;禁止杠杆;禁止裸卖期权。"
      ),
      ...(complacent
        ? [
            l(
              "Marks veto active: credit spread too tight — the equity leg of every plan has been cut by 5%.",
              "Marks veto 生效:信用利差过窄,所有方案的股票腿已下调 5%。"
            ),
          ]
        : []),
      ...tiltNotes,
      l(
        "The percentages are an asset-allocation framework, not buy/sell instructions for any specific security.",
        "以上百分比是资产配置框架,不是对任何具体证券的买卖指令。"
      ),
    ],
    disclaimers: [
      l(
        "This is not financial advice. This tool is for research and decision support only.",
        "这不是财务建议。本工具仅用于研究与决策辅助。"
      ),
      l(
        "Drawdown tolerances are historical references, not guarantees; real drawdowns can exceed any historical value.",
        "回撤容忍度为历史情景参考,不是保证;真实回撤可以超过任何历史值。"
      ),
    ],
  };

  cached = { result, expires: Date.now() + 10 * 60 * 1000 };
  return result;
}
