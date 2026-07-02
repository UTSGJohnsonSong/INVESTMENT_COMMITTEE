export default function Loading() {
  return (
    <div className="py-24 text-center space-y-3">
      <div className="text-lg font-semibold animate-pulse">
        Convening the committee…
      </div>
      <p className="text-xs text-muted">
        Fetching SEC EDGAR filings & XBRL financials · FRED macro series ·
        delayed quotes
        <br />
        All evidence carries sources and timestamps — takes ~5–10s
      </p>
    </div>
  );
}
