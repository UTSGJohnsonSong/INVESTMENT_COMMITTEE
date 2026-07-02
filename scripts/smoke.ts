import { analyzeTicker } from "../src/lib/analyze";

(async () => {
  const r = await analyzeTicker("AAPL");
  if (!r) { console.log("NULL result"); return; }
  console.log("asset:", r.asset);
  console.log("quant:", r.quant?.lastPrice, "mom12", r.quant?.momentum12m, "vol", r.quant?.realizedVol);
  console.log("macro:", r.macro.map(m=>`${m.seriesId}=${m.value}`).join(" "));
  console.log("financials:\n  " + r.financials.map(f=>`${f.name}=${f.value}${f.unit==='%'?'%':''} (${f.period}${f.yoyChange!==null?`, ${f.yoyChange}% yoy`:''})`).join("\n  "));
  console.log("evidence count:", r.evidence.length);
  console.log("filings:", r.filings.slice(0,3).map(f=>`${f.form} ${f.filingDate}`).join(", "));
  console.log("opinions:", r.opinions.map(o=>`${o.persona}:${o.rating}(${o.stance})${o.veto?.triggered?' VETO':''}`).join(" "));
  console.log("decision:", r.decision.overallRating, "conf", r.decision.confidence, "alloc", JSON.stringify(r.decision.allocation), "quality", r.decision.evidenceQuality, "coverage", r.decision.citationCoverage + "%");
  console.log("vetoes:", r.decision.vetoesApplied.map(v=>`${v.persona}: ${v.effect}`).join(" | ") || "none");
  console.log("warnings:", r.dataWarnings);
})();
