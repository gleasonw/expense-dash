"server only";
"use server";

import { db } from "@/server/db";
import { getUserWithToken } from "@/server/session";
import {
  auto_tag_merchants,
  auto_tag_merchants_new,
  tagAllocations,
  tags_new,
  tagsLink,
  tagsLinkNew,
  transactions,
  User,
} from "@/server/schema";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { Transaction } from "plaid";

export async function removeTagFromTransaction({
  transactionId,
  tagId,
}: {
  transactionId: string;
  tagId: string;
}) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return;
  }
  await db
    .delete(tagsLinkNew)
    .where(
      and(
        eq(tagsLinkNew.transaction_id, transactionId),
        eq(tagsLinkNew.tag_id, tagId)
      )
    );
  revalidatePath("/dashboard");
}

export async function createTag(formData: FormData) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return;
  }
  const tag = formData.get("tag") as string;
  await db.insert(tags_new).values({
    tag,
    label: tag,
    color: "blue",
    userId: user.user.id,
  });
  revalidatePath("/dashboard");
}

export async function setTagAllocation(formData: FormData) {
  "use server";
  const allocations = Array.from(formData.entries())
    .map(([tag, allocation]) => ({
      tag,
      allocation,
    }))
    .filter((a) => !isNaN(parseFloat(a.allocation as string)));
  console.log({ allocations });
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return;
  }
  console.log({ user, allocations });

  await db
    .insert(tagAllocations)
    .values(
      allocations.map((a) => ({
        tag: a.tag,
        allocation: a.allocation as string,
        user_id: user.user.id,
      }))
    )
    .onConflictDoUpdate({
      target: [tagAllocations.user_id, tagAllocations.tag],
      set: { allocation: sql`excluded.allocation` },
    });
  revalidatePath("/dashboard");
}

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

export async function addTagToTransaction_v2({
  transactionId,
  tagId,
  autoTag,
}: {
  transactionId: string;
  tagId: string;
  autoTag: boolean;
}) {
  console.log("adding tag to transaction", {
    transactionId,
    tagId,
    autoTag,
  });
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    // gotta figure out a way to do middleware or something and pass user as context, like trpc
    throw new Error("no plaid account");
  }
  const [fullTag, fullTransaction] = await Promise.all([
    db.query.tags_new.findFirst({
      where: and(eq(tags_new.userId, user.user.id), eq(tags_new.id, tagId)),
    }),
    db.query.transactions.findFirst({
      where: and(
        eq(transactions.user_id, user.user.id),
        eq(transactions.transaction_id, transactionId)
      ),
    }),
  ]);

  if (!fullTag) {
    throw new Error("tag not found");
  }
  if (!fullTransaction) {
    throw new Error("transaction not found");
  }

  console.log("adding tag", fullTag, "to transaction", fullTransaction);
  await db
    .insert(tagsLinkNew)
    .values({ transaction_id: transactionId, tag_id: tagId });
  if (autoTag) {
    await db.insert(auto_tag_merchants_new).values({
      name: fullTransaction.name,
      merchant_name: fullTransaction.merchant_name,
      tag_id: fullTag.id,
      user_id: user.user.id,
      transaction_id: transactionId,
    });
  }
  revalidatePath("/dashboard");
}
