"use client";
import { useState } from "react";
import type { Lang } from "@/lib/i18n";

export function CopyButton({ text, lang = "en" }: { text: string; lang?: Lang }) {
  const [copied, setCopied] = useState(false);
  const zh = lang === "zh";
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs border border-blue-500/40 bg-blue-500/10 text-blue-400 rounded px-3 py-1.5 hover:bg-blue-500/20"
    >
      {copied ? (zh ? "已复制 ✓" : "Copied ✓") : zh ? "复制全文 Memo" : "Copy full memo"}
    </button>
  );
}
