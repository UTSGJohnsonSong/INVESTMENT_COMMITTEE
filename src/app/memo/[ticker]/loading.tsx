export default function Loading() {
  return (
    <div className="py-24 text-center text-sm text-muted animate-pulse">
      Generating the decision memo… (reusing the latest committee analysis, or
      fetching live data)
    </div>
  );
}
