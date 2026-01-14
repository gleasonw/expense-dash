"use server";

import { db } from "@/server/db";
import {
  bucketMovements,
  buckets,
  PostBucket,
  PostMovement,
} from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getBuckets } from "./buckets_sdk";
import { getSavingsTransactionsWithAllocations } from "./transactions_sdk";

export async function removeMovementsFromBucket(bucketId: number) {
  const user = await getUserWithTokenThrows();
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
  const user = await getUserWithTokenThrows();
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
  const user = await getUserWithTokenThrows();
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
  const user = await getUserWithTokenThrows();
  console.log("Creating movement", { movement, user: user.user });

  // If movement has no occurredAt but has transactionId, fetch transaction date
  let occurredAt = movement.occurredAt;
  if (!occurredAt && movement.transactionId) {
    const transaction = await db.query.transactions.findFirst({
      where: (transactions, { eq }) =>
        eq(transactions.transaction_id, movement.transactionId!),
    });
    if (transaction) {
      occurredAt = new Date(transaction.date);
    }
  }

  await db.insert(bucketMovements).values({
    ...movement,
    occurredAt,
    userId: user.user.id,
  });
  revalidatePath("/dashboard/savings");
  return {
    success: true,
    message: "Movement created successfully",
  };
}

export async function deleteMovement(movementId: number) {
  const user = await getUserWithTokenThrows();
  console.log("Deleting movement", { movementId, user: user.user });
  await db
    .delete(bucketMovements)
    .where(
      and(
        eq(bucketMovements.id, movementId),
        eq(bucketMovements.userId, user.user.id)
      )
    );
  revalidatePath("/dashboard/savings");
  return {
    success: true,
    message: "Movement deleted successfully",
  };
}

export async function updateBucket(
  bucketId: number,
  updates: Partial<Omit<PostBucket, "userId">>
) {
  const user = await getUserWithTokenThrows();
  console.log("Updating bucket", { bucketId, updates, user: user.user });
  await db
    .update(buckets)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, user.user.id)));
  revalidatePath("/dashboard/savings");
  return {
    success: true,
    message: "Bucket updated successfully",
  };
}

export async function generateSuggestedAllocations(month: string) {
  await getUserWithTokenThrows();

  // Get ongoing buckets
  const allBuckets = await getBuckets();
  const ongoingBuckets = allBuckets.filter(
    (b) => b.type === "ongoing" && !b.isArchived
  );

  // Get unallocated savings transactions
  const savingsTransactions = await getSavingsTransactionsWithAllocations(
    month
  );
  const unallocatedTransactions = savingsTransactions.filter(
    (t) => parseFloat(t.unallocatedAmount) > 0
  );

  // Generate suggestions: for each unallocated transaction, allocate by percentage
  const suggestions: Array<{
    transactionId: string;
    transactionName: string;
    bucketId: number;
    bucketName: string;
    amount: string;
    transactionDate: string;
  }> = [];

  for (const transaction of unallocatedTransactions) {
    const unallocated = parseFloat(transaction.unallocatedAmount);

    for (const bucket of ongoingBuckets) {
      const percentage = parseFloat(bucket.targetPercentage ?? "0");
      const suggestedAmount = (unallocated * percentage).toFixed(2);

      if (parseFloat(suggestedAmount) > 0) {
        suggestions.push({
          transactionId: transaction.transactionId,
          transactionName: transaction.transactionName,
          bucketId: bucket.id,
          bucketName: bucket.name,
          amount: suggestedAmount,
          transactionDate: transaction.transactionDate,
        });
      }
    }
  }

  return suggestions;
}

export async function applySuggestedAllocations(
  suggestions: Array<{
    transactionId: string;
    bucketId: number;
    amount: string;
    transactionDate: string;
  }>
) {
  const user = await getUserWithTokenThrows();

  // Create all movements in batch
  const movements = suggestions.map((s) => ({
    bucketId: s.bucketId,
    amount: s.amount,
    transactionId: s.transactionId,
    occurredAt: new Date(s.transactionDate),
    userId: user.user.id,
    note: "Auto-allocated",
  }));

  if (movements.length > 0) {
    await db.insert(bucketMovements).values(movements);
    revalidatePath("/dashboard/savings");
  }

  return {
    success: true,
    message: `${movements.length} movements created`,
  };
}

export async function validateMonthlyMovements(
  month: string,
  additionalMovement?: { amount: string; transactionId?: string }
) {
  await getUserWithTokenThrows();

  // Get total savings budget for the month
  const savingsTransactions = await getSavingsTransactionsWithAllocations(
    month
  );
  const totalSavingsBudget = savingsTransactions.reduce(
    (sum, t) => sum + Math.abs(parseFloat(t.transactionAmount)),
    0
  );

  // Get currently allocated amount
  const currentlyAllocated = savingsTransactions.reduce(
    (sum, t) => sum + parseFloat(t.allocatedAmount),
    0
  );

  // Add the additional movement if provided
  const potentialTotal = additionalMovement
    ? currentlyAllocated + parseFloat(additionalMovement.amount)
    : currentlyAllocated;

  const isValid = potentialTotal <= totalSavingsBudget;
  const remaining = totalSavingsBudget - potentialTotal;

  return {
    isValid,
    totalSavingsBudget,
    currentlyAllocated,
    remaining: remaining.toFixed(2),
    exceedsBy: isValid
      ? "0.00"
      : (potentialTotal - totalSavingsBudget).toFixed(2),
  };
}
