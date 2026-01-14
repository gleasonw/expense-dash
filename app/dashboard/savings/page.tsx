import { getMonthTargetForTag } from "@/app/dashboard/aggregates";
import {
  getBuckets,
  getMovementsWithOrphanedStatus,
} from "@/app/dashboard/buckets_sdk";
import { getSavingsTransactionsWithAllocations } from "../transactions_sdk";
import { getUserWithTokenThrows } from "@/server/session";
import { MonthBudgetOverview } from "./MonthBudgetOverview";
import { UnallocatedTransactionsSection } from "./UnallocatedTransactionsSection";
import { AutoAllocationSuggestions } from "./AutoAllocationSuggestions";
import { BucketForm } from "./BucketForm";
import { BucketCard } from "./BucketCard";

export default async function Savings() {
  await getUserWithTokenThrows();

  const currentMonth = new Date().toISOString().slice(0, 7);

  // Fetch all data in parallel
  const [buckets, savingsTarget, savingsTransactions, movementsWithOrphaned] =
    await Promise.all([
      getBuckets(),
      getMonthTargetForTag("savings"),
      getSavingsTransactionsWithAllocations(currentMonth),
      getMovementsWithOrphanedStatus(),
    ]);

  // Calculate budget overview data
  const totalSavingsBudget = savingsTransactions.reduce(
    (sum, t) => sum + Math.abs(parseFloat(t.transactionAmount)),
    0
  );

  const totalAllocated = savingsTransactions.reduce(
    (sum, t) => sum + parseFloat(t.allocatedAmount),
    0
  );

  const orphanedCount = movementsWithOrphaned.filter(
    (m) => m.isOrphaned
  ).length;

  const budgetData = {
    totalBudget: totalSavingsBudget,
    allocated: totalAllocated,
    remaining: totalSavingsBudget - totalAllocated,
    orphanedCount,
  };

  // Filter non-archived buckets
  const activeBuckets = buckets.filter((b) => !b.isArchived);

  // Group buckets by type
  const goalBuckets = activeBuckets.filter((b) => b.type === "goal");
  const ongoingBuckets = activeBuckets.filter((b) => b.type === "ongoing");

  // Map movements to buckets with orphaned status
  type MovementWithOrphaned = {
    id: number;
    bucketId: number;
    amount: string;
    note: string | null;
    transactionId: string | null;
    occurredAt: Date;
    createdAt: Date;
    isOrphaned: boolean;
  };

  const bucketMovementsMap = movementsWithOrphaned.reduce((acc, movement) => {
    if (!acc[movement.bucketId]) acc[movement.bucketId] = [];
    acc[movement.bucketId]!.push(movement);
    return acc;
  }, {} as Record<number, MovementWithOrphaned[]>);

  return (
    <div className="p-6 max-w-7xl w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Savings Dashboard
        </h1>
        <p className="text-gray-600">
          Track your savings goals and allocate your monthly savings
        </p>
      </div>

      <MonthBudgetOverview data={budgetData} month={currentMonth} />

      <UnallocatedTransactionsSection
        transactions={savingsTransactions}
        buckets={activeBuckets}
      />

      <AutoAllocationSuggestions
        currentMonth={currentMonth}
        hasOngoingBuckets={ongoingBuckets.length > 0}
      />

      <div className="mb-6">
        <BucketForm />
      </div>

      <div className="space-y-8">
        {goalBuckets.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Goal Buckets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goalBuckets.map((bucket) => (
                <BucketCard
                  key={bucket.id}
                  bucket={bucket}
                  movements={bucketMovementsMap[bucket.id] || []}
                  savingsTarget={savingsTarget?.target ?? 0}
                />
              ))}
            </div>
          </div>
        )}

        {ongoingBuckets.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Ongoing Buckets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ongoingBuckets.map((bucket) => (
                <BucketCard
                  key={bucket.id}
                  bucket={bucket}
                  movements={bucketMovementsMap[bucket.id] || []}
                  savingsTarget={savingsTarget?.target ?? 0}
                />
              ))}
            </div>
          </div>
        )}

        {activeBuckets.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600 mb-4">
              No buckets yet. Create your first savings bucket above!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
