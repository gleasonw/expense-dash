"use server";

import { db } from "@/server/db";
import {
  auto_tag_merchants_new,
  bucketMovements,
  tags_new,
  tagsLinkNew,
  transactions,
  User,
} from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import {
  and,
  asc,
  eq,
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

export type TransactionWithAutoTagMatchCount = {
  transaction_id: string;
  name: string;
  merchant_name?: string | null;
  autoTagMatchCount: number;
};

function normalizeAutoTagValue(value?: string | null) {
  return value?.trim().toLowerCase();
}

function getMatchingAutoTagsForTransaction(
  autoTags: {
    id: number;
    name: string;
    merchant_name: string | null;
    tag_id: string;
  }[],
  transaction: {
    name: string;
    merchant_name?: string | null | undefined;
  }
) {
  const normalizedName = normalizeAutoTagValue(transaction.name);
  const normalizedMerchantName = normalizeAutoTagValue(transaction.merchant_name);

  return autoTags.filter((autoTag) => {
    const ruleName = normalizeAutoTagValue(autoTag.name);
    const ruleMerchantName = normalizeAutoTagValue(autoTag.merchant_name);
    if (!ruleName) {
      return false;
    }

    const nameMatches = normalizedName === ruleName;
    const merchantMatches = !!ruleMerchantName
      ? normalizedMerchantName === ruleMerchantName
      : true;
    return nameMatches && merchantMatches;
  });
}

function getPreferredAutoTag(
  matches: {
    id: number;
    name: string;
    merchant_name: string | null;
    tag_id: string;
  }[]
) {
  if (matches.length === 0) {
    return undefined;
  }

  return matches
    .slice()
    .sort((a, b) => {
      const specificityDiff =
        Number(!!b.merchant_name) - Number(!!a.merchant_name);
      if (specificityDiff !== 0) {
        return specificityDiff;
      }
      return a.id - b.id;
    })[0];
}

export async function getAutoTagMatchCountsForTransactions(
  transactionsToInspect: {
    transaction_id: string;
    name: string;
    merchant_name?: string | null;
  }[],
  user: User
) {
  if (transactionsToInspect.length === 0) {
    return {};
  }

  const candidateAutoTags = await db
    .select()
    .from(auto_tag_merchants_new)
    .where(eq(auto_tag_merchants_new.user_id, user.id));

  return transactionsToInspect.reduce(
    (acc, transaction) => {
      const matches = getMatchingAutoTagsForTransaction(
        candidateAutoTags,
        transaction
      );
      acc[transaction.transaction_id] = matches.length;
      return acc;
    },
    {} as Record<string, number>
  );
}

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

export async function autoTagTransactionsForUser(
  ts: {
    name: string;
    merchant_name?: string | null | undefined;
    transaction_id: string;
  }[],
  user: User
) {
  if (ts.length === 0) {
    return;
  }

  const autoTags = await db
    .select()
    .from(auto_tag_merchants_new)
    .where(eq(auto_tag_merchants_new.user_id, user.id));

  const transactionsToAutotag = ts.reduce((acc, t) => {
    const matches = getMatchingAutoTagsForTransaction(autoTags, t);
    const autoTag = getPreferredAutoTag(matches);
    if (!autoTag) {
      return acc;
    }
    acc.push({
      transaction_id: t.transaction_id,
      tag_id: autoTag.tag_id,
      tagName: autoTag.name,
    });
    return acc;
  }, [] as { transaction_id: string; tag_id: string; tagName: string }[]);

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
  return {
    //todo: wonky
    autoTagged: transactionsToAutotag.filter((t) =>
      autoTagged.some((at) => at.transaction_id === t.transaction_id)
    ),
  };
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
  const res = await autoTagTransactionsForUser(ts, userWithAccount.user);
  revalidatePath("/dashboard");
  return res;
}

export const getTransactionsWithTags = cache(
  async (filters?: {
    tag?: string;
    monthUTC?: dateUtils.YyyyMm;
    amountSort?: "asc" | "desc";
  }) => {
    const user = await getUserWithTokenThrows();
    const filterConditions = getFilterConditions(filters);
    if (filters?.tag) {
      filterConditions.push(eq(tags_new.tag, filters.tag));
    }
    const amountOrderBy =
      filters?.amountSort === "asc"
        ? asc(sql`CAST(${transactions.amount} AS NUMERIC)`)
        : filters?.amountSort === "desc"
          ? desc(sql`CAST(${transactions.amount} AS NUMERIC)`)
          : undefined;

    const ts = await db
      .select()
      .from(transactions)
      .leftJoin(
        tagsLinkNew,
        eq(transactions.transaction_id, tagsLinkNew.transaction_id)
      )
      .leftJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
      .where(and(...filterConditions))
      .orderBy(
        ...(amountOrderBy
          ? [amountOrderBy, desc(transactions.date), transactions.merchant_name]
          : [desc(transactions.date), transactions.merchant_name])
      );

    const mergedTransactions = Object.values(
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

    const autoTagMatchCounts = await getAutoTagMatchCountsForTransactions(
      mergedTransactions.map((transaction) => ({
        transaction_id: transaction.transaction_id,
        name: transaction.name,
        merchant_name: transaction.merchant_name,
      })),
      user.user
    );

    return mergedTransactions.map((transaction) => ({
      ...transaction,
      autoTagMatchCount: autoTagMatchCounts[transaction.transaction_id] ?? 0,
    }));
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

export async function getHistoricalSavingsMonthlyStats(
  month: string,
  lookbackMonths = 6
) {
  const user = await getUserWithTokenThrows();

  const monthUTC = dateUtils.normYyyyMm(month);
  const safeLookback = Math.max(lookbackMonths, 1);
  const historyStart = dateUtils.addMonths(monthUTC, -safeLookback);
  const monthStartExpr = sql`date_trunc('month', ${transactions.date}::date)`;

  const results = await db
    .select({
      month: sql<string>`to_char(${monthStartExpr}, 'YYYY-MM')`,
      total: sql<string>`COALESCE(SUM(ABS(CAST(${transactions.amount} AS NUMERIC))), 0)`,
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
    .where(
      and(
        eq(transactions.user_id, user.user.id),
        gte(transactions.date, historyStart),
        lt(transactions.date, monthUTC)
      )
    )
    .groupBy(monthStartExpr)
    .orderBy(desc(monthStartExpr));

  const monthlyTotals = results.map((row) => ({
    month: row.month,
    total: parseFloat(row.total),
  }));

  const averageMonthlySavings =
    monthlyTotals.length === 0
      ? 0
      : monthlyTotals.reduce((sum, row) => sum + row.total, 0) /
        monthlyTotals.length;

  return {
    averageMonthlySavings,
    monthsWithSavings: monthlyTotals.length,
    monthlyTotals,
  };
}
