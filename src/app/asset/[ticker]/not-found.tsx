import Link from "next/link";
import { cookies } from "next/headers";
import { langFromCookie } from "@/lib/i18n";
import { SearchBox } from "@/components/search-box";

export default async function NotFound() {
  const lang = langFromCookie((await cookies()).get("lang")?.value);
  const zh = lang === "zh";
  return (
    <div className="py-24 text-center space-y-4">
      <h1 className="text-xl font-bold">
        {zh ? "无法解析这个标的" : "Could not resolve this symbol"}
      </h1>
      <p className="text-sm text-muted">
        {zh
          ? "没有找到对应的市场数据或 SEC 档案。支持任意美股 ticker、美股 ETF 与主要指数(AAPL、NVDA、SPY、SP500、NASDAQ、DOW)。加密货币、港股/A 股暂不在 MVP 范围内。"
          : "No market data or SEC file found. Any US stock ticker, US ETF, or major index works (AAPL, NVDA, SPY, SP500, NASDAQ, DOW). Crypto and non-US listings are out of MVP scope."}
      </p>
      <div className="flex justify-center">
        <SearchBox lang={lang} />
      </div>
      <Link href="/" className="text-xs text-blue-400 hover:underline">
        {zh ? "← 返回 Dashboard" : "← Back to Dashboard"}
      </Link>
    </div>
  );
}
