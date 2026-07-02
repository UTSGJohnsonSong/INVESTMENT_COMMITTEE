export default function Loading() {
  return (
    <div className="py-24 text-center space-y-3">
      <div className="text-lg font-semibold animate-pulse">
        The committee is debating current strategy…
      </div>
      <p className="text-xs text-muted">
        Fetching FRED macro series + SPY/QQQ/TLT/GLD trend data, ~5s
      </p>
    </div>
  );
}
