import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { analyzeTicker } from "@/lib/analyze";
import { generateMemo } from "@/lib/memo";
import { langFromCookie } from "@/lib/i18n";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

export default async function MemoPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const lang = langFromCookie((await cookies()).get("lang")?.value);
  const zh = lang === "zh";
  const r = await analyzeTicker(decodeURIComponent(ticker));
  if (!r) notFound();

  const memo = generateMemo(r, lang);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            Decision Memo · <span className="num">{r.asset.ticker}</span>
          </h1>
          <p className="text-xs text-muted">
            {zh ? "自动生成于" : "Generated"} {r.generatedAt.slice(0, 16)}Z ·{" "}
            <Link
              href={`/asset/${r.asset.ticker}`}
              className="text-blue-400 hover:underline"
            >
              {zh ? "← 返回研究页" : "← Back to research"}
            </Link>
          </p>
        </div>
        <CopyButton text={memo} lang={lang} />
      </div>
      <pre className="bg-panel border border-line rounded-lg p-5 text-[12px] leading-relaxed whitespace-pre-wrap num overflow-x-auto">
        {memo}
      </pre>
    </div>
  );
}
