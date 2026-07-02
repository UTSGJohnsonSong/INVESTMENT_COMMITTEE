import { NextRequest, NextResponse } from "next/server";
import { BASKET_LIMIT, reviewBasket } from "@/lib/basket";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tickers?: string[] };
    const tickers = Array.isArray(body.tickers) ? body.tickers : [];
    if (tickers.length === 0)
      return NextResponse.json({ error: "empty basket" }, { status: 400 });
    if (tickers.length > BASKET_LIMIT)
      return NextResponse.json(
        { error: `basket limit is ${BASKET_LIMIT}` },
        { status: 400 }
      );
    const review = await reviewBasket(tickers);
    return NextResponse.json(review);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "review failed" },
      { status: 500 }
    );
  }
}
