"use client";

type MonthBudgetData = {
  totalBudget: number;
  allocated: number;
  remaining: number;
  orphanedCount: number;
};

export function MonthBudgetOverview({
  data,
  month,
}: {
  data: MonthBudgetData;
  month: string;
}) {
  const percentAllocated =
    data.totalBudget > 0
      ? ((data.allocated / data.totalBudget) * 100).toFixed(1)
      : "0";

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <h2 className="text-xl font-semibold mb-4">
        {new Date(month + "-01").toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}{" "}
        Savings Budget
      </h2>

      <div className="grid grid-cols-3 gap-6">
        <div>
          <p className="text-sm text-gray-600 mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-gray-900">
            ${data.totalBudget.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            From savings transactions
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-1">Allocated</p>
          <p className="text-2xl font-bold text-blue-600">
            ${data.allocated.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {percentAllocated}% of budget
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-1">Remaining</p>
          <p
            className={`text-2xl font-bold ${
              data.remaining < 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            ${data.remaining.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Available to allocate</p>
        </div>
      </div>

      {data.orphanedCount > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ {data.orphanedCount} orphaned movement
            {data.orphanedCount > 1 ? "s" : ""} detected (linked to transactions
            no longer tagged as savings)
          </p>
        </div>
      )}
    </div>
  );
}
