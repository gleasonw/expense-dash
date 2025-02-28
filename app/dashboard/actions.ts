"server only";
"use server";

import { db } from "@/server/db";
import { getUserWithToken } from "@/server/session";
import { tagsLink, transactions, User } from "@/server/schema";
import { Transaction } from "plaid";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

export async function addTransactions(ts: Transaction[]) {
  const user = await getUserWithToken();
  return db
    .insert(transactions)
    .values(ts.map((t) => ({ ...t, user_id: user.user.id })))
    .onConflictDoNothing();
}

export async function addTagToTransaction(transactionId: string, tag: string) {
  const user = await getUserWithToken();
  console.log("adding tag", tag, "to transaction", transactionId);
  // just allow one tag for now
  await db.delete(tagsLink).where(eq(tagsLink.transaction_id, transactionId));
  if (tag !== "") {
    await db.insert(tagsLink).values({ transaction_id: transactionId, tag });
  }
  revalidatePath("/dashboard");
}
