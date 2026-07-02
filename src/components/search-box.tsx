"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Lang } from "@/lib/i18n";

export function SearchBox({
  large = false,
  lang = "en",
}: {
  large?: boolean;
  lang?: Lang;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const zh = lang === "zh";

  const go = () => {
    const t = value.trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    router.push(`/asset/${encodeURIComponent(t)}`);
  };

  return (
    <div className={`flex gap-2 ${large ? "max-w-xl" : "max-w-sm"} w-full`}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder={
          zh
            ? "任意美股/ETF/指数:AAPL / NVDA / SPY / SP500 / NASDAQ"
            : "Any US stock/ETF/index: AAPL / NVDA / SPY / SP500 / NASDAQ"
        }
        className={`num flex-1 bg-panel2 border border-line rounded px-3 outline-none focus:border-blue-500/60 placeholder:text-muted/60 ${
          large ? "h-11 text-base" : "h-9 text-sm"
        }`}
      />
      <button
        onClick={go}
        disabled={loading}
        className={`px-4 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium ${
          large ? "h-11" : "h-9"
        }`}
      >
        {loading
          ? zh
            ? "召集委员会…"
            : "Convening…"
          : zh
            ? "分析"
            : "Analyze"}
      </button>
    </div>
  );
}
