"use client";
// Basket (shopping cart) plumbing: localStorage-backed, shared via a custom
// event so the nav badge and buttons stay in sync without a provider.
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";

export interface CartItem {
  ticker: string;
  name?: string;
}

const KEY = "ic-basket";
const EVT = "ic-basket-changed";

export function readCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVT));
}

export function addToCart(item: CartItem) {
  const items = readCart();
  if (!items.some((i) => i.ticker === item.ticker)) {
    items.push(item);
    writeCart(items);
  }
}

export function removeFromCart(ticker: string) {
  writeCart(readCart().filter((i) => i.ticker !== ticker));
}

export function useCart(): CartItem[] {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    setItems(readCart());
    const h = () => setItems(readCart());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return items;
}

export function CartButton({
  ticker,
  name,
  lang = "en",
}: {
  ticker: string;
  name?: string;
  lang?: Lang;
}) {
  const items = useCart();
  const inCart = items.some((i) => i.ticker === ticker);
  const zh = lang === "zh";
  return (
    <button
      onClick={() =>
        inCart ? removeFromCart(ticker) : addToCart({ ticker, name })
      }
      className={`text-xs rounded px-3 py-1.5 border ${
        inCart
          ? "border-green-500/40 bg-green-500/10 text-bullish hover:bg-green-500/20"
          : "border-line text-muted hover:text-foreground hover:border-blue-500/40"
      }`}
    >
      {inCart ? (zh ? "✓ 已在篮子" : "✓ In basket") : zh ? "+ 加入篮子" : "+ Add to basket"}
    </button>
  );
}

/** Small "+" for dense lists (screener cards). Stops link navigation. */
export function CartMiniButton({ ticker, name }: { ticker: string; name?: string }) {
  const items = useCart();
  const inCart = items.some((i) => i.ticker === ticker);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (inCart) removeFromCart(ticker);
        else addToCart({ ticker, name });
      }}
      title={inCart ? "Remove from basket" : "Add to basket"}
      className={`num text-[11px] leading-none w-5 h-5 rounded border shrink-0 ${
        inCart
          ? "border-green-500/40 bg-green-500/15 text-bullish"
          : "border-line text-muted hover:text-blue-400 hover:border-blue-500/40"
      }`}
    >
      {inCart ? "✓" : "+"}
    </button>
  );
}

export function NavBasketLink({ lang }: { lang: Lang }) {
  const items = useCart();
  return (
    <Link href="/basket" className="hover:text-foreground relative">
      {lang === "zh" ? "购物篮" : "Basket"}
      {items.length > 0 && (
        <span className="num ml-1 inline-flex items-center justify-center text-[9px] min-w-4 h-4 px-0.5 rounded-full bg-blue-600 text-white">
          {items.length}
        </span>
      )}
    </Link>
  );
}
