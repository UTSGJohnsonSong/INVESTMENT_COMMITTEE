import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { langFromCookie } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import { NavBasketLink } from "@/components/cart";
import "./globals.css";

export const metadata: Metadata = {
  title: "Investment Committee",
  description:
    "Evidence-first investment decision support. Every claim cited, every source timestamped.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = langFromCookie((await cookies()).get("lang")?.value);
  const zh = lang === "zh";

  return (
    <html lang={zh ? "zh-CN" : "en"} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-panel sticky top-0 z-40">
          <div className="mx-auto max-w-7xl px-4 h-12 flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-wide text-sm">
              <span className="text-blue-400">■</span> INVESTMENT COMMITTEE
              {zh && (
                <span className="text-muted font-normal ml-2 hidden sm:inline">
                  投资思想委员会
                </span>
              )}
            </Link>
            <nav className="flex items-center gap-4 text-xs text-muted ml-auto">
              <Link href="/" className="hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/screener" className="hover:text-foreground">
                {zh ? "扫描器" : "Screener"}
              </Link>
              <Link href="/strategy" className="hover:text-foreground">
                {zh ? "当下策略" : "Strategy Now"}
              </Link>
              <NavBasketLink lang={lang} />
              <Link href="/portfolio" className="hover:text-foreground">
                Portfolio Impact
              </Link>
              <Link href="/guide" className="hover:text-foreground">
                Guide
              </Link>
              <span className="hidden md:inline text-[10px] border border-line rounded px-1.5 py-0.5">
                DATA: SEC EDGAR · FRED · delayed quotes
              </span>
              <LangToggle lang={lang} />
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-line py-4 text-center text-[11px] text-muted">
          {zh
            ? "This is not financial advice. 本工具仅用于研究与决策辅助,不构成投资建议。"
            : "This is not financial advice. This tool is for research and decision support only."}
        </footer>
      </body>
    </html>
  );
}
