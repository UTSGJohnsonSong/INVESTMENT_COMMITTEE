"use client";
// Auto-wires the Markowitz persona's real-correlation path: on first load,
// if the URL has no ?holdings= yet, read the user's basket from localStorage
// and append it as a query param. No extra UI — the existing "+ Add to
// basket" button IS the portfolio input.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readCart } from "./cart";

export function AutoHoldingsParam({
  ticker,
  hasHoldingsParam,
}: {
  ticker: string;
  hasHoldingsParam: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (hasHoldingsParam) return;
    const holdings = readCart()
      .map((i) => i.ticker.toUpperCase())
      .filter((t) => t !== ticker.toUpperCase());
    if (holdings.length === 0) return;
    const qs = new URLSearchParams(window.location.search);
    qs.set("holdings", holdings.join(","));
    router.replace(`?${qs.toString()}`, { scroll: false });
  }, [hasHoldingsParam, ticker, router]);
  return null;
}
