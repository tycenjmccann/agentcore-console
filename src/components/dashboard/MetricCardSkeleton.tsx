export default function MetricCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Icon placeholder */}
          <div className="w-9 h-9 rounded-lg bg-surface-3 animate-pulse" />
          <div>
            {/* Label placeholder */}
            <div className="w-20 h-3 bg-surface-3 rounded animate-pulse" />
            {/* Value placeholder */}
            <div className="w-14 h-7 bg-surface-3 rounded animate-pulse mt-1.5" />
          </div>
        </div>
        {/* Status dot placeholder */}
        <div className="w-2.5 h-2.5 rounded-full bg-surface-3 animate-pulse" />
      </div>
      {/* Subtitle placeholder */}
      <div className="w-24 h-3 bg-surface-3 rounded animate-pulse mb-3" />
      {/* Sparkline placeholder */}
      <div className="w-full h-10 bg-surface-3 rounded animate-pulse" />
    </div>
  );
}
