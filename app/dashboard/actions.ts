"server only";
"use server";

import { db } from "@/server/db";
import { getUserWithTokenThrows } from "@/server/session";
import {
  auto_tag_merchants_new,
  tagAllocationsNew,
  tags_new,
  tagsLinkNew,
  transactions,
} from "@/server/schema";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { Transaction } from "plaid";
import { tagIdAndTransactionIdFromId } from "@/app/dashboard/transaction_utils";

export async function removeTagFromTransaction({
  transactionId,
  tagId,
}: {
  transactionId: string;
  tagId: string;
}) {
  await getUserWithTokenThrows();
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
  const user = await getUserWithTokenThrows();
  const tag = formData.get("tag") as string;
  await db.insert(tags_new).values({
    tag,
    label: tag,
    color: "blue",
    userId: user.user.id,
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tags");
}

export async function deleteTag({ tagId }: { tagId: string }) {
  const user = await getUserWithTokenThrows();

  await db.transaction(async (tx) => {
    const tag = await tx.query.tags_new.findFirst({
      where: and(eq(tags_new.id, tagId), eq(tags_new.userId, user.user.id)),
    });

    if (!tag) {
      return;
    }

    await tx.delete(tagsLinkNew).where(eq(tagsLinkNew.tag_id, tagId));

    await tx
      .delete(tagAllocationsNew)
      .where(
        and(
          eq(tagAllocationsNew.tag_id, tagId),
          eq(tagAllocationsNew.user_id, user.user.id)
        )
      );

    await tx
      .delete(tags_new)
      .where(and(eq(tags_new.id, tagId), eq(tags_new.userId, user.user.id)));
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tags");
}

export async function createAutoTag(formData: FormData) {
  const user = await getUserWithTokenThrows();
  const name = (formData.get("name") as string | null)?.trim();
  const merchantName = (formData.get("merchantName") as string | null)?.trim();
  const tagId = formData.get("tagId") as string | null;

  if (!name || !tagId) {
    return;
  }

  const tag = await db.query.tags_new.findFirst({
    where: and(eq(tags_new.id, tagId), eq(tags_new.userId, user.user.id)),
  });

  if (!tag) {
    return;
  }

  await db.insert(auto_tag_merchants_new).values({
    name,
    merchant_name: merchantName || null,
    tag_id: tagId,
    user_id: user.user.id,
  });
  revalidatePath("/dashboard/tags");
}

export async function deleteAutoTag({ autoTagId }: { autoTagId: number }) {
  const user = await getUserWithTokenThrows();

  await db
    .delete(auto_tag_merchants_new)
    .where(
      and(
        eq(auto_tag_merchants_new.id, autoTagId),
        eq(auto_tag_merchants_new.user_id, user.user.id)
      )
    );

  revalidatePath("/dashboard/tags");
}

export async function updateTransactionDate(
  transactionId: string,
  date: string
) {
  const user = await getUserWithTokenThrows();
  console.log("updating transaction date", {
    transactionId,
    date,
  });
  await db
    .update(transactions)
    .set({ date: new Date(date).toISOString() })
    .where(
      and(
        eq(transactions.transaction_id, transactionId),
        eq(transactions.user_id, user.user.id)
      )
    );
  revalidatePath("/dashboard");
}

export async function setTagAllocation(formData: FormData) {
  const allocations = Array.from(formData.entries())
    .map(([tagId, allocation]) => ({
      tagId,
      allocation,
    }))
    .filter((a) => !isNaN(parseFloat(a.allocation as string)));
  console.log({ allocations });
  const user = await getUserWithTokenThrows();
  console.log({ user, allocations });

  await db
    .insert(tagAllocationsNew)
    .values(
      allocations.map((a) => ({
        tag_id: a.tagId,
        allocation: a.allocation as string,
        user_id: user.user.id,
      }))
    )
    .onConflictDoUpdate({
      target: [tagAllocationsNew.user_id, tagAllocationsNew.tag_id],
      set: { allocation: sql`excluded.allocation` },
    });
  revalidatePath("/dashboard");
}

export async function addTransactions(
  ts: (Transaction & { amount: string })[]
) {
  const user = await getUserWithTokenThrows();
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

export type TransactionTagId = string & { __tagId: never };

export type FormTagTransactionState = Record<
  TransactionTagId,
  { autoTag: boolean }
>;

export async function addTagsToTransactions(
  tags: FormTagTransactionState
): Promise<void> {
  await getUserWithTokenThrows();

  const tagsToPush = Object.entries(tags).map(([id, { autoTag }]) => {
    const { transactionId, tagId } = tagIdAndTransactionIdFromId(
      id as TransactionTagId
    );
    return {
      transaction_id: transactionId,
      tag_id: tagId,
      autoTag,
    };
  });

  console.log(tagsToPush);

  await db.insert(tagsLinkNew).values(tagsToPush);
  revalidatePath("/dashboard");
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
  const user = await getUserWithTokenThrows();
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
