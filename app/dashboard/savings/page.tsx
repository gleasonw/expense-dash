import {
  getMonthTargetForTag,
  getSpendingByMonth,
} from "@/app/dashboard/aggregates";
import {
  BucketWithMovements,
  getBuckets,
  remainingSavingsAfterOngoing,
  totalGoalBuckets,
} from "@/app/dashboard/buckets_sdk";
import { BucketForm } from "@/app/dashboard/savings/BucketForm";
import { DeleteBucketButton } from "@/app/dashboard/savings/DeleteBucketButton";
import { MarkOngoingCompleteButton } from "@/app/dashboard/savings/MarkOngoingCompleteButton";
import { MovementForm } from "@/app/dashboard/savings/MovementForm";
import { RemoveMovementsFromBucketButton } from "@/app/dashboard/savings/RemoveMovementsFromBucketButton";
import { db } from "@/server/db";
import { getUserWithTokenThrows } from "@/server/session";
import { sql } from "drizzle-orm";

// TODO: completion status for buckets...
// - [ ] ongoing
// - [ ] goal

// TODO: [ ] let user create movement for ongoing bucket that
// reflects percentage of savings target

export default async function Savings() {
  const user = await getUserWithTokenThrows();
  if (user === "no-plaid-account") {
    return (
      <div className="p-3">
        <p>You need to connect your bank account to use this feature.</p>
      </div>
    );
  }
  const rows = await getSpendingByMonth({ afterXMonthsAgo: 1 });
  const buckets = await getBuckets();

  //TODO: hardcoded savings tag? should probably just be a default we add
  // when the user registers
  const currentMonthSavings = rows?.find(
    (row) =>
      row.month === new Date().toISOString().slice(0, 7) &&
      row.tag === "savings"
  );

  const savingsTarget = await getMonthTargetForTag("savings");
  console.log({ savingsTarget });
  return (
    <div className="p-3 flex flex-col gap-5 max-w-5xl mx-auto">
      <BucketForm />
      <div className="shadow-md p-5 border">
        <h1>
          {new Intl.DateTimeFormat("en-US", { month: "long" }).format(
            new Date()
          )}{" "}
          savings overview
        </h1>
        <div className="flex flex-wrap gap-5">
          <div>
            <h2>current month savings</h2>${currentMonthSavings?.amount}
          </div>
          <div>
            <h2>target from est income</h2>$
            {Math.round(savingsTarget?.target || 0)}
          </div>
          <div>
            <h2>diff to transfer</h2>
            {savingsTarget && currentMonthSavings
              ? `$${Math.round(
                  savingsTarget.target -
                    (parseInt(currentMonthSavings?.amount) ?? 0)
                )}`
              : 0}
          </div>
        </div>
      </div>
      <SavingsWarnings />

      <div className="flex flex-wrap gap-5">
        {buckets.map((bucket) =>
          bucket.type === "goal" ? (
            <GoalBucket key={bucket.id} bucket={bucket} />
          ) : (
            <OngoingBucket key={bucket.id} bucket={bucket} />
          )
        )}
      </div>
    </div>
  );
}

async function SavingsWarnings() {
  const warnings = [];
  const user = await getUserWithTokenThrows();

  if (user === "no-plaid-account") {
    return (
      <div className="text-red-500">
        You need to connect your bank account to see savings warnings.
      </div>
    );
  }

  // TODO: parallelize
  const savingsTarget = await getMonthTargetForTag("savings");
  const remaining = await remainingSavingsAfterOngoing();
  // for simplicity, let's assume that createdAt reflects the month the
  // movement is expected to occur
  const totalMovements = await db.execute(
    sql`
    SELECT SUM(CAST(amount as NUMERIC)) as total
    FROM bucket_movements
    WHERE user_id = ${user.user.id}
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `
  );

  if (remaining === "greater_than_100_allocated") {
    warnings.push(
      <div key="greater-than-100" className="text-red-500">
        You have allocated more than 100% of your savings target to ongoing
        buckets.
      </div>
    );
  }

  const totalMovementsAmount = (totalMovements.rows[0]?.total as number) || 0;
  if (savingsTarget?.target && totalMovementsAmount > savingsTarget.target) {
    warnings.push(
      <div key="movements-exceed-target" className="text-red-500">
        {`Your declared movements ($${Math.round(
          totalMovementsAmount
        )}) exceed your savings target ($${Math.round(savingsTarget.target)}).`}
      </div>
    );
  }

  if (warnings.length === 0) {
    return null;
  }

  return <div className="flex flex-col gap-2">{warnings}</div>;
}

async function GoalBucket({ bucket }: { bucket: BucketWithMovements }) {
  const totalAllocated = Math.round(
    bucket.movements.reduce(
      (acc, movement) => acc + (parseInt(movement.amount) || 0),
      0
    )
  );
  const remainingSavings = await remainingSavingsAfterOngoing();
  const count = await totalGoalBuckets();
  const completed =
    totalAllocated >= (parseInt(bucket.targetAmount ?? "0") || 0);
  return (
    <div
      className={`p-3 border rounded relative ${
        completed ? "bg-green-100" : null
      }`}
    >
      <h2>{bucket.name}</h2>
      <div>
        {totalAllocated} / {bucket.targetAmount}
      </div>
      <div>
        {remainingSavings === "greater_than_100_allocated" ? (
          <div>No savings left to allocate</div>
        ) : (
          <div> Month Suggested: ${Math.round(remainingSavings / count)}</div>
        )}
      </div>
      <MovementForm bucketId={bucket.id} />
      <RemoveMovementsFromBucketButton bucketId={bucket.id} />
      <DeleteBucketButton bucketId={bucket.id} />
    </div>
  );
}

async function OngoingBucket({ bucket }: { bucket: BucketWithMovements }) {
  const savingsTarget = await getMonthTargetForTag("savings");
  const expectedMonthly = Math.round(
    (savingsTarget?.target ?? 0) * parseFloat(bucket.targetPercentage ?? "0")
  );
  const sumMovements = Math.round(
    bucket.movements.reduce(
      (acc, movement) => acc + (parseInt(movement.amount) || 0),
      0
    )
  );
  const completed = sumMovements === expectedMonthly;

  return (
    <div
      className={`p-3 border rounded relative ${
        completed ? "bg-green-100" : null
      }`}
    >
      <h2>{bucket.name}</h2>
      {bucket.targetPercentage && (
        <p>{parseFloat(bucket.targetPercentage) * 100}%</p>
      )}
      <div>Expected monthly: ${expectedMonthly}</div>
      {completed ? (
        <RemoveMovementsFromBucketButton bucketId={bucket.id} />
      ) : (
        <MarkOngoingCompleteButton
          bucketId={bucket.id}
          amount={expectedMonthly.toString()}
        />
      )}
      <DeleteBucketButton bucketId={bucket.id} />
    </div>
  );
}
