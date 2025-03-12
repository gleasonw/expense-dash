"server only";
"use server";

import { db } from "@/server/db";
import { getUserWithToken } from "@/server/session";
import {
  auto_tag_merchants,
  tagsLink,
  transactions,
  User,
} from "@/server/schema";
import { Transaction } from "plaid";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

export async function addTransactions(
  ts: (Transaction & { amount: string })[]
) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return;
  }
  return db
    .insert(transactions)
    .values(
      ts.map((t) => ({
        ...t,
        user_id: user.user.id,
        authorized_datetime: t.authorized_datetime
          ? new Date(t.authorized_datetime)
          : null,
        datetime: t.datetime ? new Date(t.datetime) : null,
      }))
    )
    .onConflictDoNothing();
}

export async function addTagToTransaction({
  transaction,
  tag,
  autoTag,
}: {
  transaction: Transaction;
  tag: string;
  autoTag: boolean;
}) {
  const user = await getUserWithToken();

  const transactionId = transaction.transaction_id;

  console.log("adding tag", tag, "to transaction", transactionId);
  // just allow one tag for now
  await db.delete(tagsLink).where(eq(tagsLink.transaction_id, transactionId));
  if (tag !== "") {
    await db.insert(tagsLink).values({ transaction_id: transactionId, tag });
    if (autoTag) {
      await db.insert(auto_tag_merchants).values({
        // not normalized but eh
        name: transaction.name,
        merchant_name: transaction.merchant_name,
        tag,
        user_id: user.user.id,
        transaction_id: transactionId,
      });
    }
  }
  revalidatePath("/dashboard");
}
