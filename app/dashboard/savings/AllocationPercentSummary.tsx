"use client";

type BucketPercentSummary = {
  id: number;
  autoAllocationPercent: string | null;
};

export function AllocationPercentSummary({
  buckets,
  className,
}: {
  buckets: BucketPercentSummary[];
  className?: string;
}) {
  const total = buckets.reduce((sum, bucket) => {
    const parsed = parseFloat(bucket.autoAllocationPercent ?? "0");
    if (Number.isNaN(parsed) || parsed <= 0) {
      return sum;
    }
    return sum + parsed;
  }, 0);

  const totalPercent = total * 100;
  const remainingPercent = (1 - total) * 100;
  const progressPercent = Math.max(0, Math.min(totalPercent, 100));
  const hasOverflow = total > 1;

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">Auto-allocation</span>
        <span className="text-xs font-medium text-gray-600">
          {totalPercent.toFixed(1)}% allocated
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div
          className={`h-1.5 rounded-full ${hasOverflow ? "bg-amber-500" : "bg-blue-500"}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p
        className={`mt-1 text-xs ${hasOverflow ? "text-amber-700" : "text-gray-500"}`}
      >
        {hasOverflow
          ? `${(totalPercent - 100).toFixed(1)}% over-allocated`
          : `${Math.max(remainingPercent, 0).toFixed(1)}% remaining`}
      </p>
    </div>
  );
}
