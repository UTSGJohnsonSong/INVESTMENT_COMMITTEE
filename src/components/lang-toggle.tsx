"use client";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";

export function LangToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const next = lang === "en" ? "zh" : "en";
  return (
    <button
      onClick={() => {
        document.cookie = `lang=${next};path=/;max-age=31536000`;
        router.refresh();
      }}
      className="text-xs border border-line rounded px-2 py-1 hover:border-blue-500/50 hover:text-blue-400"
      title={lang === "en" ? "切换到中文" : "Switch to English"}
    >
      {lang === "en" ? "中文" : "EN"}
    </button>
  );
}
