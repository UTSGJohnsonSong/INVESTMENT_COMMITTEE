"use client";
// "What changed since last analysis" — compares this run against a snapshot
// stored in localStorage from the previous visit to the same ticker.
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";

interface Snapshot {
  date: string;
  price: number | null;
  rating: string;
  confidence: number;
  vetoCount: number;
  latestFiling: string | null;
  stances: Record<string, string>;
}

export function WhatChanged({
  ticker,
  current,
  lang,
}: {
  ticker: string;
  current: Snapshot;
  lang: Lang;
}) {
  const [prev, setPrev] = useState<Snapshot | null>(null);
  const zh = lang === "zh";
  const key = `ic-snapshot-${ticker}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw) as Snapshot;
        // only report changes across sessions, not refreshes within minutes
        if (Date.now() - new Date(p.date).getTime() > 30 * 60 * 1000) setPrev(p);
      }
      localStorage.setItem(key, JSON.stringify(current));
    } catch {
      /* localStorage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!prev) return null;

  const changes: string[] = [];
  if (prev.price !== null && current.price !== null && prev.price !== 0) {
    const chg = Math.round(((current.price - prev.price) / prev.price) * 1000) / 10;
    if (Math.abs(chg) >= 0.5)
      changes.push(
        zh
          ? `价格 ${prev.price} → ${current.price}(${chg >= 0 ? "+" : ""}${chg}%)`
          : `Price ${prev.price} → ${current.price} (${chg >= 0 ? "+" : ""}${chg}%)`
      );
  }
  if (prev.rating !== current.rating)
    changes.push(
      zh
        ? `评级 ${prev.rating} → ${current.rating}`
        : `Rating ${prev.rating} → ${current.rating}`
    );
  if (Math.abs(prev.confidence - current.confidence) >= 3)
    changes.push(
      zh
        ? `置信度 ${prev.confidence} → ${current.confidence}`
        : `Confidence ${prev.confidence} → ${current.confidence}`
    );
  if (prev.vetoCount !== current.vetoCount)
    changes.push(
      zh
        ? `触发的 veto 数 ${prev.vetoCount} → ${current.vetoCount}`
        : `Vetoes triggered ${prev.vetoCount} → ${current.vetoCount}`
    );
  if (prev.latestFiling !== current.latestFiling && current.latestFiling)
    changes.push(
      zh
        ? `新 filing:${current.latestFiling}`
        : `New filing: ${current.latestFiling}`
    );
  for (const [p, s] of Object.entries(current.stances)) {
    if (prev.stances[p] && prev.stances[p] !== s)
      changes.push(
        zh ? `${p}:${prev.stances[p]} → ${s}` : `${p}: ${prev.stances[p]} → ${s}`
      );
  }

  if (changes.length === 0) return null;

  return (
    <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1.5">
        {zh
          ? `自上次分析以来的变化(${prev.date.slice(0, 10)})`
          : `What changed since last analysis (${prev.date.slice(0, 10)})`}
      </div>
      <ul className="text-[12px] space-y-0.5">
        {changes.map((c, i) => (
          <li key={i}>· {c}</li>
        ))}
      </ul>
    </div>
  );
}
