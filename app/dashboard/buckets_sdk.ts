import { getMonthTargetForTag } from "@/app/dashboard/aggregates";
import { db } from "@/server/db";
import { bucketMovements, buckets } from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { and, count, eq, ne, sql } from "drizzle-orm";

export async function getBuckets() {
  const user = await getUserWithTokenThrows();
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
  const user = await getUserWithTokenThrows();
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
  await getUserWithTokenThrows();
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

export async function getMovementsWithOrphanedStatus() {
  const user = await getUserWithTokenThrows();

  // Get all movements with their transaction links
  const movements = await db
    .select({
      id: bucketMovements.id,
      bucketId: bucketMovements.bucketId,
      amount: bucketMovements.amount,
      note: bucketMovements.note,
      transactionId: bucketMovements.transactionId,
      occurredAt: bucketMovements.occurredAt,
      createdAt: bucketMovements.createdAt,
      // Check if transaction exists and has savings tag
      isOrphaned: sql<boolean>`
        CASE
          WHEN bucket_movements.transaction_id IS NULL THEN false
          WHEN NOT EXISTS (
            SELECT 1
            FROM transactions t
            INNER JOIN tags_link_new tl ON t.transaction_id = tl.transaction_id
            INNER JOIN tags_v2 tn ON tl.tag_id = tn.id
            WHERE t.transaction_id = bucket_movements.transaction_id
            AND tn.tag = 'savings'
          ) THEN true
          ELSE false
        END
      `.as("is_orphaned"),
    })
    .from(bucketMovements)
    .where(eq(bucketMovements.userId, user.user.id));

  return movements;
}
