"use server";

import { db } from "@/server/db";
import {
  bucketMovements,
  buckets,
  PostBucket,
  PostMovement,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function removeMovementsFromBucket(bucketId: number) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return {
      error: "no-plaid-account",
      message: "You need to connect your bank account to use this feature.",
    };
  }
  console.log("Removing movements from bucket", { bucketId, user: user.user });
  await db
    .delete(bucketMovements)
    .where(
      and(
        eq(bucketMovements.bucketId, bucketId),
        eq(bucketMovements.userId, user.user.id)
      )
    );

  revalidatePath("/dashboard/savings");
}

export async function deleteBucket(bucketId: number) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return {
      error: "no-plaid-account",
      message: "You need to connect your bank account to use this feature.",
    };
  }
  console.log("Deleting bucket", { bucketId, user: user.user });
  await db
    .delete(buckets)
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, user.user.id)));
  revalidatePath("/dashboard/savings");
  return {
    success: true,
    message: "Bucket deleted successfully",
  };
}

export async function createBucket(bucket: Omit<PostBucket, "userId">) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return {
      error: "no-plaid-account",
      message: "You need to connect your bank account to use this feature.",
    };
  }
  console.log("Creating bucket", { bucket, user: user.user });
  await db.insert(buckets).values({
    ...bucket,
    userId: user.user.id,
  });
  revalidatePath("/dashboard/savings");
  return {
    success: true,
    message: "Bucket created successfully",
  };
}

export async function createMovement(movement: Omit<PostMovement, "userId">) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return {
      error: "no-plaid-account",
      message: "You need to connect your bank account to use this feature.",
    };
  }
  console.log("Creating movement", { movement, user: user.user });
  await db.insert(bucketMovements).values({
    ...movement,
    userId: user.user.id,
  });
  revalidatePath("/dashboard/savings");
  return {
    success: true,
    message: "Movement created successfully",
  };
}
