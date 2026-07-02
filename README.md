# Investment Committee · 投资思想委员会

基于实时一手信息、严格引用、多投资大师思想互相辩论的投资决策辅助系统。

**不是股票推荐网站。** 它的灵魂是证据管理:每个结论可回溯到一条带来源、URL、时间戳的证据;没有依据的句子只能标为「推测」。

## 运行

```bash
npm install
npm run dev   # http://localhost:3000
```

无需任何 API key——所有数据源都是免 key 的官方/公开端点,运行时现场抓取。

## 数据源 (source hierarchy)

| Level | 来源 | 用途 |
|-------|------|------|
| P0 | SEC EDGAR (company_tickers / submissions / XBRL companyfacts) | 财务事实,带 accession number + form type + filed date |
| P0 | FRED `fredgraph.csv` 公开端点 | DGS10/DGS2/T10Y2Y/DFF/CPI/UNRATE/HY OAS,带 series_id + observation date |
| P1 | Yahoo Finance chart API (延迟行情) | 价格、动量、波动率、回撤;页面标注 delayed |

本地开发注意:Yahoo 会对 Node 的 TLS 指纹返回 403,`src/lib/fetcher.ts` 自动降级到 curl 子进程。部署到 Vercel 后原生 fetch 通常直接可用。

## 架构:单向数据流

```
sources → Evidence[] (带引用) → 8 个 persona 纯函数 → synthesis (veto 机制) → FinalDecision
```

- `src/lib/sources/` — SEC / FRED / 市场数据抓取
- `src/lib/metrics.ts` — 从 XBRL 提取 revenue/EPS/FCF/margins,每个数字带 citation
- `src/lib/evidence.ts` — 组装证据表,委员只能消费这张表
- `src/lib/committee/` — 8 位委员 (Bogle/Markowitz/Buffett/Marks/Dalio/Taleb/Simons/Soros),确定性规则引擎,零幻觉;接口设计支持将来替换为 LLM(LLM 同样只允许看证据表)
- `src/lib/committee/synthesis.ts` — 合议 + veto (Taleb 尾部风险否决、Marks 情绪过热降仓、Bogle ETF 替代、Simons 数据不支持降 confidence、Buffett 质量差禁 Strong Buy)
- `src/db/schema.ts` — Drizzle Postgres schema (7 张表),接 Neon 时 `npx drizzle-kit push`;MVP 运行时用内存缓存,不依赖 DB

## 页面

- `/` — Dashboard:搜索 + 实时宏观环境 + watchlist
- `/asset/[ticker]` — 研究页:价格图、财务快照、filings、委员会辩论卡、Final Decision Panel、Evidence Panel(可筛选,citation 点击展开 drawer)
- `/memo/[ticker]` — 可复制的专业投资备忘录,引用按 P0→P3 排序
- `/portfolio` — 组合影响(简化版;相关性/因子模块明确标 MOCK)

## 明确标记为 MOCK 的部分

- Markowitz 相关性假设 (0.8/0.95)
- Simons 历史回测与因子暴露
- Portfolio 页相关性矩阵/行业敞口

原则:mock 不显示假数字,只显示占位说明。

## 冒烟测试

```bash
npx tsx scripts/smoke.ts   # 用 AAPL 跑全链路,打印证据/委员评分/合议结果
```

---

This is not financial advice. This tool is for research and decision support only.
