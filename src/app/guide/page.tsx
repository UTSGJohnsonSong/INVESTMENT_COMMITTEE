import { cookies } from "next/headers";
import { langFromCookie, pick } from "@/lib/i18n";
import { PERSONAS, PERSONA_ORDER } from "@/lib/committee/meta";
import { DataBadge, Panel, SourceLevelBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const lang = langFromCookie((await cookies()).get("lang")?.value);
  const zh = lang === "zh";
  const t = (en: string, zhs: string) => (zh ? zhs : en);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">
          {t("Guide & Methodology", "使用指南与方法论")}
        </h1>
        <p className="text-sm text-muted mt-1">
          {t(
            "Everything explanatory lives here, so the working pages stay clean and decision-oriented.",
            "所有解释性内容都集中在这里,让工作页面保持干净、以决策为导向。"
          )}
        </p>
      </div>

      <Panel title={t("What this tool is", "这个工具是什么")}>
        <div className="text-[13px] space-y-2 leading-relaxed">
          <p>
            {t(
              "A personal research cockpit for investment decisions — not a stock recommendation site. It fetches primary-source evidence (SEC EDGAR, FRED, delayed quotes), lets eight decision frameworks inspired by published investment philosophies debate the same evidence, and synthesizes a structured decision with vetoes, scenarios and kill criteria.",
              "一个个人投资决策研究舱——不是股票推荐网站。它抓取一手来源证据(SEC EDGAR、FRED、延迟行情),让八个基于公开投资哲学构建的决策框架对同一组证据进行辩论,最终合成带 veto、情景区间和 kill criteria 的结构化决策。"
            )}
          </p>
          <p>
            {t(
              "The soul of the system is evidence management: every claim traces to an evidence row with a source, URL and timestamp. Unsourced sentences can only be labeled as inference.",
              "系统的灵魂是证据管理:每个论断都能回溯到一条带来源、URL 和时间戳的证据。没有依据的句子只能标注为「推测」。"
            )}
          </p>
        </div>
      </Panel>

      <Panel title={t("Pages", "页面")}>
        <ul className="text-[13px] space-y-1.5">
          <li>
            <b>Dashboard</b> —{" "}
            {t(
              "search any US stock/ETF/index; live macro environment; watchlist.",
              "搜索任意美股/ETF/指数;实时宏观环境;watchlist。"
            )}
          </li>
          <li>
            <b>Asset page</b> —{" "}
            {t(
              "the full committee analysis of one ticker: decision panel, price/financials, committee debate, evidence panel.",
              "单一标的的完整委员会分析:决策面板、价格/财务、委员辩论、证据面板。"
            )}
          </li>
          <li>
            <b>Strategy Now</b> —{" "}
            {t(
              "no ticker: the committee debates current positioning and produces three risk-tiered allocation plans.",
              "不选标的:委员会讨论当下配置,输出三套风险分层的配置方案。"
            )}
          </li>
          <li>
            <b>Decision Memo</b> —{" "}
            {t("a copyable professional memo of the analysis.", "可复制的专业投资备忘录。")}
          </li>
          <li>
            <b>Portfolio Impact</b> —{" "}
            {t(
              "how adding a target asset changes portfolio weights and concentration.",
              "加入目标资产后组合权重与集中度的变化。"
            )}
          </li>
        </ul>
      </Panel>

      <Panel title={t("Source hierarchy", "来源分级")}>
        <div className="text-[13px] space-y-2">
          <p className="flex items-start gap-2">
            <SourceLevelBadge level="P0" />
            <span>
              {t(
                "Primary official sources: SEC EDGAR (10-K/10-Q/8-K, XBRL company facts, with accession numbers), FRED/Fed/BLS/BEA series (with series IDs and observation dates), company IR. These carry financial facts.",
                "一手官方来源:SEC EDGAR(10-K/10-Q/8-K、XBRL company facts,带 accession number)、FRED/美联储/BLS/BEA 序列(带 series ID 和观测日期)、公司 IR。财务事实只能来自这一级。"
              )}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <SourceLevelBadge level="P1" />
            <span>
              {t(
                "Quality data vendors: exchange/market data (delayed quotes here). Good for prices and derived quant signals.",
                "高质量数据供应商:交易所/市场数据(本系统为延迟行情)。用于价格与衍生量化信号。"
              )}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <SourceLevelBadge level="P2" />
            <span>
              {t(
                "News/analysis (Reuters, WSJ, etc.): sentiment and events only, never hard financial facts. Not yet wired in.",
                "新闻/分析(路透、华尔街日报等):只能用于情绪与事件补充,不能作为硬财务事实。尚未接入。"
              )}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <SourceLevelBadge level="P3" />
            <span>
              {t(
                "Social sources (X, Reddit, forums): sentiment signal at most. Not yet wired in.",
                "社交来源(X、Reddit、论坛):至多作为情绪信号。尚未接入。"
              )}
            </span>
          </p>
        </div>
      </Panel>

      <Panel title={t("Data badges", "数据徽章")}>
        <div className="text-[13px] space-y-2">
          {(
            [
              ["reported", t("taken directly from the source filing, unmodified.", "直接取自原始 filing,未经修改。")],
              ["derived", t("computed from reported inputs; the formula is in the citation drawer.", "由已披露数据计算得出;公式在引用抽屉中。")],
              ["delayed", t("based on delayed market data — the timestamp is shown.", "基于延迟行情——时间戳会显示。")],
              ["stale", t("the latest available period is old; a newer one likely exists.", "最新可得期间已偏旧;大概率已有更新数据。")],
              ["mixed", t("combines inputs from different periods — treat ratios with caution.", "混合了不同期间的输入——比率类指标需谨慎。")],
              ["conflict", t("sources disagree; the system shows the conflict instead of silently choosing.", "来源之间冲突;系统会显示冲突而不是悄悄选一个。")],
              ["mock", t("placeholder, not real data; excluded from decisions and always visually marked.", "占位符,不是真实数据;不参与决策,且始终有醒目标记。")],
            ] as const
          ).map(([kind, desc]) => (
            <p key={kind} className="flex items-start gap-2">
              <DataBadge kind={kind} />
              <span>{desc}</span>
            </p>
          ))}
          <p className="text-muted text-xs">
            {t(
              "A purple “inference” chip on a claim means no direct evidence backs that sentence — it is reasoning, and is counted against citation coverage.",
              "论断旁的紫色「推测」标签表示该句没有直接证据支撑——它是推理,并会计入 citation coverage 的扣分。"
            )}
          </p>
        </div>
      </Panel>

      <Panel title={t("The committee", "委员会")}>
        <div className="space-y-4">
          {PERSONA_ORDER.map((pid) => {
            const p = PERSONAS[pid];
            return (
              <div
                key={pid}
                className="border border-line rounded p-3 bg-panel2/40"
                style={{ borderLeftColor: p.color, borderLeftWidth: 3 }}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold" style={{ color: p.color }}>
                    {p.name}
                  </span>
                  <span className="text-[11px] text-muted">{pick(p.title, lang)}</span>
                </div>
                <div className="text-[13px] mt-1.5 space-y-1">
                  <p>
                    <span className="text-muted">{t("First question: ", "第一个问题:")}</span>
                    “{pick(p.firstQuestion, lang)}”
                  </p>
                  <p className="text-muted">{pick(p.philosophy, lang)}</p>
                  <p>
                    <span className="text-muted">{t("Hates: ", "厌恶:")}</span>
                    {pick(p.hates, lang)}
                  </p>
                  {p.vetoRule && (
                    <p>
                      <span className="text-bearish">{t("Veto rule: ", "否决规则:")}</span>
                      {pick(p.vetoRule, lang)}
                    </p>
                  )}
                  <p>
                    <span className="text-muted">{t("Blind spot: ", "盲区:")}</span>
                    {pick(p.blindSpot, lang)}
                  </p>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted">
            {t(
              "These are decision frameworks inspired by each investor's published philosophy — not impersonations. Every member may only use rows from the evidence table; outputs without evidence are labeled inference.",
              "这些是基于每位投资者公开哲学构建的决策框架——不是角色扮演。每位委员只能使用证据表中的行;没有证据的输出会被标注为推测。"
            )}
          </p>
        </div>
      </Panel>

      <Panel title={t("How to read the numbers", "如何解读这些数字")}>
        <ul className="text-[13px] space-y-2">
          <li>
            <b>{t("Rating", "评级")}</b> —{" "}
            {t(
              "direction and constraints are separated. The direction score is voted by the five members who judge the asset itself (Buffett, Marks, Simons, Dalio, Soros; Bogle replaces Buffett for funds). Bogle, Markowitz and Taleb are constraint members — they control vetoes, position caps and confidence, not direction. Strong Buy is blocked whenever Taleb vetoes, Buffett's quality test fails, or Marks reads the market as greedy.",
              "方向与约束分离。方向分由五位对资产本身做判断的委员投票(Buffett、Marks、Simons、Dalio、Soros;基金类由 Bogle 顶替 Buffett)。Bogle、Markowitz、Taleb 是约束型委员——他们控制 veto、仓位上限和置信度,不投方向票。只要 Taleb 否决、Buffett 质量不过关、或 Marks 判断市场贪婪,Strong Buy 一律封锁。"
            )}
          </li>
          <li>
            <b>{t("Confidence (0–100)", "置信度 (0–100)")}</b> —{" "}
            {t(
              "how much the committee trusts its own conclusion. It is penalized by vetoes, missing data, and quant signals contradicting the narrative. Low confidence means 'the evidence is thin', not 'the asset is bad'.",
              "委员会对自身结论的信任程度。会因 veto、数据缺失、量化信号与叙事相悖而扣分。低置信度的含义是「证据不足」,不是「资产不好」。"
            )}
          </li>
          <li>
            <b>{t("Allocation %", "仓位 %")}</b> —{" "}
            {t(
              "suggested share of total portfolio, capped by Taleb's hard limit and the Markowitz volatility band. It is a risk budget, not a conviction score.",
              "建议占组合总值的比例,受 Taleb 硬上限和 Markowitz 波动率区间约束。它是风险预算,不是信念打分。"
            )}
          </li>
          <li>
            <b>{t("Scenarios", "情景区间")}</b> —{" "}
            {t(
              "bull/base/bear ranges derived from realized volatility and actual drawdown history; the formula is always shown. Ranges, never point estimates — precision would be fake.",
              "乐观/基准/悲观区间由已实现波动率和真实回撤历史推出;公式始终展示。只给区间,不给点位——精确数字是伪造的确定性。"
            )}
          </li>
          <li>
            <b>Kill criteria</b> —{" "}
            {t(
              "pre-committed conditions under which the position must be re-evaluated or exited. Decide them before entry, when you are still rational.",
              "事先承诺的条件:一旦触发必须重估或退出。在入场前、你还理性的时候就定好。"
            )}
          </li>
          <li>
            <b>{t("Evidence quality / citation coverage", "证据质量 / 引用覆盖率")}</b> —{" "}
            {t(
              "share of P0 sources in the evidence set, and share of committee sentences backed by direct evidence.",
              "证据集中 P0 来源的占比,以及委员论述中有直接证据支撑的句子占比。"
            )}
          </li>
        </ul>
      </Panel>

      <Panel title={t("The three plans", "三套方案")}>
        <div className="text-[13px] space-y-2">
          <p>
            <b>Conservative</b> —{" "}
            {t(
              "capital preservation first. For money needed within 1–3 years, or when risk compensation is unattractive. The goal is avoiding forced selling and emotional breakdown, not maximizing return.",
              "保本优先。适合 1–3 年内要用的钱,或风险补偿不具吸引力的时期。目标是避免被迫卖出和情绪崩溃,不是收益最大化。"
            )}
          </p>
          <p>
            <b>Balanced</b> —{" "}
            {t(
              "the default long-term plan: broad ETF core, diversified legs, some cash. Unless evidence strongly supports being defensive or aggressive, this is the answer.",
              "默认的长期方案:宽基 ETF 核心、多资产分散、留有现金。除非证据强烈支持防守或进攻,答案就是它。"
            )}
          </p>
          <p>
            <b>Aggressive</b> —{" "}
            {t(
              "disciplined offense, not emotional chasing. Only for 10+ year capital, stable income, and proven ability to sit through 30%+ drawdowns.",
              "有纪律的进攻,不是情绪化追涨。只适合 10 年以上的资金、稳定现金流,以及被验证过能扛住 30%+ 回撤的人。"
            )}
          </p>
          <p className="text-muted">
            {t(
              "The plans share one directional view and differ only in risk budget. Evidence-driven tilts (credit spreads, trend filters, inflation) shift all three together.",
              "三套方案共享同一个方向判断,差异只在风险预算。证据驱动的调整(信用利差、趋势过滤、通胀)会同时作用于三套方案。"
            )}
          </p>
        </div>
      </Panel>

      <Panel title={t("What this system cannot do", "这个系统做不到什么")}>
        <ul className="text-[13px] space-y-1 text-muted">
          <li>· {t("It cannot predict the future — it organizes evidence about the present.", "它不能预测未来——它只是组织关于现在的证据。")}</li>
          <li>· {t("It cannot see information outside its sources: no news flow, no analyst estimates, no management quality judgment.", "它看不到来源之外的信息:没有新闻流、没有分析师预期、没有管理层质量判断。")}</li>
          <li>· {t("Its quant signals are one year of daily data — statistically weak, and labeled so.", "它的量化信号只有一年日线——统计上偏弱,且已如实标注。")}</li>
          <li>· {t("Correlation/factor analytics are placeholders until real return series are wired in.", "相关性/因子分析在接入真实收益序列前只是占位。")}</li>
          <li>· {t("It does not trade, does not use leverage, and does not replace your judgment.", "它不下单、不建议杠杆、也不能替代你的判断。")}</li>
        </ul>
      </Panel>

      <Panel title={t("Full disclaimer", "完整免责声明")}>
        <ul className="text-[12px] space-y-1 text-muted">
          <li>· {t("This is not financial advice. This tool is for research and decision support only.", "这不是财务建议。本工具仅用于研究与决策辅助。")}</li>
          <li>· {t("No returns are guaranteed; no outcome is certain.", "不保证任何收益;没有确定的结果。")}</li>
          <li>· {t("Data may be delayed, incomplete, or wrong — verify critical numbers against the original filings before acting.", "数据可能延迟、不完整或有误——行动前请对照原始 filing 核实关键数字。")}</li>
          <li>· {t("No automatic trading; no leverage is recommended by default.", "不做自动交易;默认不建议使用杠杆。")}</li>
          <li>· {t("All decisions and their consequences remain the user's responsibility.", "所有决策及其后果由使用者自行承担。")}</li>
        </ul>
      </Panel>
    </div>
  );
}
