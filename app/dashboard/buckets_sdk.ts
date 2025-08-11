import { getMonthTargetForTag } from "@/app/dashboard/aggregates";
import { db } from "@/server/db";
import { buckets } from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { and, count, eq, ne } from "drizzle-orm";

export async function getBuckets() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return [];
  }
  const buckets = await db.query.buckets.findMany({
    where: (buckets, { eq }) => eq(buckets.userId, user.user.id),
    with: {
      movements: true,
    },
  });
  console.log("Buckets fetched:", buckets);
  return buckets;
}

export async function totalGoalBuckets() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return 0;
  }
  const total = await db
    .select({ count: count().as("total") })
    .from(buckets)
    .where(
      and(
        eq(buckets.type, "goal"),
        eq(buckets.userId, user.user.id),
        ne(buckets.isArchived, true)
      )
    );
  return total[0]?.count ?? 0;
}

export async function remainingSavingsAfterOngoing() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return 0;
  }
  const savingsTarget = await getMonthTargetForTag("savings");
  const buckets = await getBuckets();
  const percentAllocated = buckets.reduce((acc, bucket) => {
    if (bucket.isArchived || bucket.type !== "ongoing") {
      return acc;
    }
    const bucketTarget = parseFloat(bucket.targetPercentage ?? "0");
    return acc + (bucketTarget || 0);
  }, 0);
  if (percentAllocated >= 1) {
    return "greater_than_100_allocated";
  }
  return (savingsTarget?.target ?? 0) * (1 - percentAllocated);
}

export type BucketWithMovements = Awaited<
  ReturnType<typeof getBuckets>
>[number];
