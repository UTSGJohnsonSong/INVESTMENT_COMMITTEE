// Transport layer with three jobs:
// 1. Every fetch records retrievedAt so citations carry real timestamps.
// 2. Some providers (Yahoo Finance, Stooq) block Node's TLS fingerprint while
//    allowing curl. fetchTextRobust falls back to a curl subprocess when
//    native fetch is rejected. On Vercel the native path normally succeeds.
// 3. Expired cache entries are kept as a last resort: if every transport
//    fails, we serve the stale body with its ORIGINAL retrievedAt and an
//    explicit stale flag — never a fabricated timestamp, never silence.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SEC_UA = "InvestmentCommittee/0.1 research zeksong0914@gmail.com";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CACHE_ENTRIES = 200;
/** how long a stale entry may still be served after every transport fails */
const STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  body: string;
  retrievedAt: string;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

function cacheSet(url: string, entry: CacheEntry): void {
  cache.delete(url); // re-insert to refresh Map iteration order (LRU-ish)
  cache.set(url, entry);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export interface FetchResult {
  body: string;
  retrievedAt: string;
  fromCache: boolean;
  /** true when served from an EXPIRED cache entry because all transports failed */
  stale: boolean;
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

export interface RobustOpts {
  ua?: "sec" | "browser";
  ttlMs?: number;
  /** reject bodies that pass HTTP but are junk (e.g. an HTML error page where JSON/CSV was expected) */
  validate?: (body: string) => boolean;
}

export async function fetchTextRobust(
  url: string,
  opts: RobustOpts = {}
): Promise<FetchResult> {
  const ttlMs = opts.ttlMs ?? 10 * 60 * 1000;
  const valid = (body: string) => (opts.validate ? opts.validate(body) : true);

  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) {
    return { body: hit.body, retrievedAt: hit.retrievedAt, fromCache: true, stale: false };
  }

  const ua = opts.ua === "sec" ? SEC_UA : BROWSER_UA;
  let body: string | null = null;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, Accept: "application/json,text/csv,*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const text = await res.text();
    if (!looksBlocked(res.status, text) && valid(text)) body = text;
  } catch {
    body = null;
  }

  if (body === null) {
    try {
      const text = await curlFallback(url);
      if (text && !looksBlocked(200, text) && valid(text)) body = text;
    } catch {
      body = null;
    }
  }

  if (body === null) {
    // Last resort: expired-but-recent cache, served with its honest original
    // timestamp so citations never claim freshness we don't have.
    if (hit && Date.now() - new Date(hit.retrievedAt).getTime() < STALE_MAX_AGE_MS) {
      return { body: hit.body, retrievedAt: hit.retrievedAt, fromCache: true, stale: true };
    }
    throw new Error(`fetch failed: ${url}`);
  }

  const retrievedAt = new Date().toISOString();
  cacheSet(url, { body, retrievedAt, expires: Date.now() + ttlMs });
  return { body, retrievedAt, fromCache: false, stale: false };
}

function isParseableJson(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

export async function fetchJsonRobust<T>(
  url: string,
  opts: Omit<RobustOpts, "validate"> = {}
): Promise<{ data: T; retrievedAt: string; stale: boolean }> {
  // JSON validity is part of transport validation: a 200 that isn't JSON
  // (consent page, HTML error) triggers the curl / stale-cache fallbacks.
  const { body, retrievedAt, stale } = await fetchTextRobust(url, {
    ...opts,
    validate: isParseableJson,
  });
  return { data: JSON.parse(body) as T, retrievedAt, stale };
}
