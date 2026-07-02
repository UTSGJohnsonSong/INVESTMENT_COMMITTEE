import { NextRequest, NextResponse } from "next/server";
import { BATCH_SIZE, screenBatch } from "@/lib/screener";

export const dynamic = "force-dynamic";
// Each batch runs the full committee pipeline for ~8 names; allow time for
// cold fetches (SEC companyfacts can be several MB per company).
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(
    BATCH_SIZE,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? String(BATCH_SIZE), 10) || BATCH_SIZE)
  );
  try {
    const { total, rows, skipped } = await screenBatch(offset, limit);
    return NextResponse.json({
      offset,
      limit,
      total,
      rows,
      skipped,
      done: offset + limit >= total,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "screen failed" },
      { status: 500 }
    );
  }
}
