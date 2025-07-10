"use server";

import { db } from "@/server/db";
import {
  auto_tag_merchants_new,
  tags_new,
  tagsLinkNew,
  transactions,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { and, inArray, eq, or, notInArray, sql, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import * as R from "remeda";

export async function tryAutoTagTransactions() {
  const userWithAccount = await getUserWithToken();
  if (userWithAccount === "no-plaid-account") {
    return {
      error: "no-plaid-account",
      message: "You need to connect your bank account to use this feature.",
    };
  }
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

  await autoTagTransactions(transactionsWithNoTag);
}

export async function autoTagTransactions(
  ts: {
    name: string;
    merchant_name?: string | null | undefined;
    transaction_id: string;
  }[]
) {
  const userWithAccount = await getUserWithToken();
  if (userWithAccount === "no-plaid-account") {
    return {
      error: "no-plaid-account",
      message: "You need to connect your bank account to use this feature.",
    };
  }
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
  const transactionsToAutotag = ts.reduce((acc, t) => {
    const autoTag = autoTagsByName[t.name];
    if (!autoTag) {
      return acc;
    }
    acc.push({ transaction_id: t.transaction_id, tag_id: autoTag.tag_id });
    return acc;
  }, [] as { transaction_id: string; tag_id: string }[]);
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
  async (filters?: { tag?: string }) => {
    const userWithAccount = await getUserWithToken();
    if (userWithAccount === "no-plaid-account") {
      return [];
    }
    const ts = await db
      .select()
      .from(transactions)
      .leftJoin(
        tagsLinkNew,
        eq(transactions.transaction_id, tagsLinkNew.transaction_id)
      )
      .leftJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
      .where(
        filters?.tag
          ? and(
              eq(transactions.user_id, userWithAccount.user.id),
              eq(tags_new.tag, filters.tag)
            )
          : eq(transactions.user_id, userWithAccount.user.id)
      )
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
