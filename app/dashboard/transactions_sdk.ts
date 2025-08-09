"use server";

import { db } from "@/server/db";
import {
  auto_tag_merchants_new,
  tags_new,
  tagsLinkNew,
  transactions,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { and, inArray, eq, or, notInArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import * as R from "remeda";

/**developer utility, helpful when booting up a new deployment */
export async function tagAllAsFirstTag() {
  const userWithAccount = await getUserWithToken();
  if (userWithAccount === "no-plaid-account") {
    console.error(`no plaid account`);
    return {
      error: "no-plaid-account",
      message: "You need to connect your bank account to use this feature.",
    };
  }
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
  } catch (e) {
    throw e;
  }
}

export async function tryAutoTagTransactions() {
  const userWithAccount = await getUserWithToken();
  if (userWithAccount === "no-plaid-account") {
    console.error(`no plaid account`);
    return {
      error: "no-plaid-account",
      message: "You need to connect your bank account to use this feature.",
    };
  }
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
  const userWithAccount = await getUserWithToken();
  if (userWithAccount === "no-plaid-account") {
    console.error(`no plaid account`);
    return {
      error: "no-plaid-account",
      message: "You need to connect your bank account to use this feature.",
    };
  }
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
  console.log(`found some auto tags`, autoTags);
  const transactionsToAutotag = ts.reduce((acc, t) => {
    const autoTag = autoTagsByName[t.name];
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
