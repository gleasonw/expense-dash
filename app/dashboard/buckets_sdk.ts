import { db } from "@/server/db";
import { getUserWithToken } from "@/server/session";

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

export type BucketWithMovements = Awaited<
  ReturnType<typeof getBuckets>
>[number];
