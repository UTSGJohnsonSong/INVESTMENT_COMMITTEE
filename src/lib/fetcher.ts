// Transport layer with two jobs:
// 1. Every fetch records retrievedAt so citations carry real timestamps.
// 2. Some providers (Yahoo Finance) block Node's TLS fingerprint while
//    allowing curl. fetchTextRobust falls back to a curl subprocess when
//    native fetch is rejected. On Vercel the native path normally succeeds.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SEC_UA = "InvestmentCommittee/0.1 research zeksong0914@gmail.com";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface CacheEntry {
  body: string;
  retrievedAt: string;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

export interface FetchResult {
  body: string;
  retrievedAt: string;
  fromCache: boolean;
}

function looksBlocked(status: number, body: string): boolean {
  if (status >= 400) return true;
  const head = body.slice(0, 200).toLowerCase();
  return head.includes("<!doctype html") && head.includes("yahoo");
}

async function curlFallback(url: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "curl",
    ["-s", "--max-time", "20", "-A", BROWSER_UA, "-H", "Accept: application/json,text/csv,*/*", url],
    { maxBuffer: 32 * 1024 * 1024 }
  );
  return stdout;
}

export async function fetchTextRobust(
  url: string,
  opts: { ua?: "sec" | "browser"; ttlMs?: number } = {}
): Promise<FetchResult> {
  const ttlMs = opts.ttlMs ?? 10 * 60 * 1000;
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) {
    return { body: hit.body, retrievedAt: hit.retrievedAt, fromCache: true };
  }

  const ua = opts.ua === "sec" ? SEC_UA : BROWSER_UA;
  let body: string | null = null;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, Accept: "application/json,text/csv,*/*" },
      cache: "no-store",
    });
    const text = await res.text();
    if (!looksBlocked(res.status, text)) body = text;
  } catch {
    body = null;
  }

  if (body === null) {
    try {
      const text = await curlFallback(url);
      if (text && !looksBlocked(200, text)) body = text;
    } catch {
      body = null;
    }
  }

  if (body === null) throw new Error(`fetch failed: ${url}`);

  const retrievedAt = new Date().toISOString();
  cache.set(url, { body, retrievedAt, expires: Date.now() + ttlMs });
  return { body, retrievedAt, fromCache: false };
}

export async function fetchJsonRobust<T>(
  url: string,
  opts: { ua?: "sec" | "browser"; ttlMs?: number } = {}
): Promise<{ data: T; retrievedAt: string }> {
  const { body, retrievedAt } = await fetchTextRobust(url, opts);
  return { data: JSON.parse(body) as T, retrievedAt };
}
