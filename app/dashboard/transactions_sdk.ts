"use server";

import { db } from "@/server/db";
import {
  auto_tag_merchants_new,
  bucketMovements,
  tags_new,
  tagsLinkNew,
  transactions,
} from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import {
  and,
  inArray,
  eq,
  or,
  notInArray,
  desc,
  sql,
  gte,
  lt,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import * as R from "remeda";
import * as dateUtils from "@/app/utils/dates";
import { getFilterConditions } from "@/app/utils/transactions_querys";

/**developer utility, helpful when booting up a new deployment */
export async function tagAllAsFirstTag() {
  const userWithAccount = await getUserWithTokenThrows();
  try {
    const transactionsWithNoTag = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.user_id, userWithAccount.user.id),
          notInArray(
            transactions.transaction_id,
            db
              .select({ transaction_id: tagsLinkNew.transaction_id })
              .from(tagsLinkNew)
          )
        )
      );

    const firstTag = await db
      .select()
      .from(tags_new)
      .where(eq(tags_new.userId, userWithAccount.user.id))
      .limit(1);

    const tag = firstTag[0];

    if (!tag) {
      console.error("No tags found for user, cannot auto tag transactions");
      return;
    }

    const tagLinksToUpsert = transactionsWithNoTag.map((t) => ({
      transaction_id: t.transaction_id,
      tag_id: tag.id,
    }));
    await db.insert(tagsLinkNew).values(tagLinksToUpsert).onConflictDoNothing();
    revalidatePath("/dashboard");
  } catch (e) {
    throw e;
  }
}

export async function tryAutoTagTransactions() {
  const userWithAccount = await getUserWithTokenThrows();
  try {
    const transactionsWithNoTag = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.user_id, userWithAccount.user.id),
          notInArray(
            transactions.transaction_id,
            //todo: should I add user id to tagsLinkNew?
            db
              .select({ transaction_id: tagsLinkNew.transaction_id })
              .from(tagsLinkNew)
          )
        )
      );

    console.log(`trying auto tag`, transactionsWithNoTag.length);

    await autoTagTransactions(transactionsWithNoTag);
  } catch (e) {
    throw e;
  }
}

export async function autoTagTransactions(
  ts: {
    name: string;
    merchant_name?: string | null | undefined;
    transaction_id: string;
  }[]
) {
  console.log(`attemping auto tag`, ts.length);
  const userWithAccount = await getUserWithTokenThrows();
  console.log(
    "here are some names",
    ts.map((t) => t.name)
  );
  console.log(
    "here are some more names",
    ts.map((t) => t.merchant_name)
  );
  const autoTags = await db
    .select()
    .from(auto_tag_merchants_new)
    .where(
      and(
        or(
          inArray(
            auto_tag_merchants_new.name,
            ts.map((t) => t.name)
          ),
          inArray(
            auto_tag_merchants_new.merchant_name,
            ts.map((t) => t.merchant_name ?? "")
          )
        ),
        eq(auto_tag_merchants_new.user_id, userWithAccount.user.id)
      )
    );

  const autoTagsByName = R.indexBy(autoTags, (at) => at.name);
  const autoTagsByMerchantName = R.indexBy(
    autoTags,
    (at) => at.merchant_name ?? ""
  );
  console.log(`found some auto tags`, autoTags);
  const transactionsToAutotag = ts.reduce((acc, t) => {
    const autoTag =
      autoTagsByName[t.name] ??
      (t.merchant_name ? autoTagsByMerchantName[t.merchant_name] : undefined);
    if (!autoTag) {
      return acc;
    }
    acc.push({ transaction_id: t.transaction_id, tag_id: autoTag.tag_id });
    return acc;
  }, [] as { transaction_id: string; tag_id: string }[]);

  if (transactionsToAutotag.length === 0) {
    console.log("no transactions to auto tag");
    return;
  }
  const autoTagged = await db
    .insert(tagsLinkNew)
    .values(
      transactionsToAutotag.map((t) => ({
        transaction_id: t.transaction_id,
        tag_id: t.tag_id,
      }))
    )
    .returning();
  revalidatePath("/dashboard");
  console.log({ autoTagged });
}

export const getTransactionsWithTags = cache(
  async (filters?: { tag?: string; monthUTC?: dateUtils.YyyyMm }) => {
    await getUserWithTokenThrows();
    const filterConditions = getFilterConditions(filters);
    if (filters?.tag) {
      filterConditions.push(eq(tags_new.tag, filters.tag));
    }
    const ts = await db
      .select()
      .from(transactions)
      .leftJoin(
        tagsLinkNew,
        eq(transactions.transaction_id, tagsLinkNew.transaction_id)
      )
      .leftJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
      .where(and(...filterConditions))
      .orderBy(desc(transactions.date), transactions.merchant_name);

    return Object.values(
      R.groupBy(ts, (t) => t.transactions.transaction_id)
    ).map((tagsForTransaction) => {
      const baseTransaction = tagsForTransaction[0].transactions;
      const tags = tagsForTransaction
        .map((t) => t.tags_v2)
        .filter((t) => t !== null);
      return {
        ...baseTransaction,
        tags,
      };
    });
  }
);

export async function getSavingsTransactionsWithAllocations(month: string) {
  const user = await getUserWithTokenThrows();

  // month should be in format "YYYY-MM"
  const startOfMonth = month + "-01";
  const nextMonth = new Date(month + "-01");
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const endOfMonth = nextMonth.toISOString().slice(0, 10);

  // Get all savings transactions for the month with their allocated amounts
  const results = await db
    .select({
      transactionId: transactions.transaction_id,
      transactionName: transactions.name,
      merchantName: transactions.merchant_name,
      transactionDate: transactions.date,
      transactionAmount: transactions.amount,
      allocatedAmount: sql<string>`COALESCE(SUM(CAST(${bucketMovements.amount} AS NUMERIC)), 0)`,
    })
    .from(transactions)
    .innerJoin(
      tagsLinkNew,
      eq(transactions.transaction_id, tagsLinkNew.transaction_id)
    )
    .innerJoin(
      tags_new,
      and(eq(tagsLinkNew.tag_id, tags_new.id), eq(tags_new.tag, "savings"))
    )
    .leftJoin(
      bucketMovements,
      eq(transactions.transaction_id, bucketMovements.transactionId)
    )
    .where(
      and(
        eq(transactions.user_id, user.user.id),
        gte(transactions.date, startOfMonth),
        lt(transactions.date, endOfMonth)
      )
    )
    .groupBy(
      transactions.transaction_id,
      transactions.name,
      transactions.merchant_name,
      transactions.date,
      transactions.amount
    )
    .orderBy(desc(transactions.date));

  return results.map((r) => ({
    ...r,
    // Calculate unallocated (transaction amounts are negative for savings/income)
    unallocatedAmount: (
      Math.abs(parseFloat(r.transactionAmount)) - parseFloat(r.allocatedAmount)
    ).toFixed(2),
  }));
}
