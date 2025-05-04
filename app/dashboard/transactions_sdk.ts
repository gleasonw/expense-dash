"use server";

import { db } from "@/server/db";
import {
  auto_tag_merchants_new,
  tagsLinkNew,
  transactions,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import {
  and,
  inArray,
  eq,
  or,
  notInArray,
  InferSelectModel,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Transaction } from "plaid";
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
  console.log({ autoTags });

  const autoTagsByName = R.indexBy(autoTags, (at) => at.name);
  const transactionsToAutotag = ts.reduce((acc, t) => {
    const autoTag = autoTagsByName[t.name];
    if (!autoTag) {
      return acc;
    }
    acc.push({ transaction_id: t.transaction_id, tag_id: autoTag.tag_id });
    return acc;
  }, [] as { transaction_id: string; tag_id: string }[]);
  console.log({ transactionsToAutotag });
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
