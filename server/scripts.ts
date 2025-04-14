import { db } from "@/server/db";
import {
  auto_tag_merchants,
  tags,
  tagsLink,
  transactions,
  userTable,
  tags_new,
  tagsLinkNew,
  auto_tag_merchants_new,
} from "@/server/schema";
import { eq, or, and } from "drizzle-orm";

export async function migrateAutoTagMerchants() {
  const autoTagsWithNewIds = await db
    .select()
    .from(auto_tag_merchants)
    .leftJoin(
      tags_new,
      and(
        eq(auto_tag_merchants.tag, tags_new.tag),
        eq(auto_tag_merchants.user_id, tags_new.userId)
      )
    );

  const autoTagsToInsert = autoTagsWithNewIds.filter(
    (at) => at.tags_v2 !== null
  );
  await db.insert(auto_tag_merchants_new).values(
    autoTagsToInsert.map((at) => ({
      name: at.auto_tag_merchants.name,
      merchant_name: at.auto_tag_merchants.merchant_name,
      tag_id: at.tags_v2!.id,
      user_id: at.auto_tag_merchants.user_id,
      transaction_id: at.auto_tag_merchants.transaction_id,
    }))
  );
}

export async function seedTags() {
  await db.insert(tags_new).values([
    { tag: "expenses", userId: 2, label: "Expenses", color: "#FF0000" },
    { tag: "income", userId: 2, label: "Income", color: "#00FF00" },
    {
      tag: "discretionary",
      userId: 2,
      label: "Discretionary",
      color: "#0000FF",
    },
    { tag: "savings", userId: 2, label: "Savings", color: "#FFFF00" },
    { tag: "giving", userId: 2, label: "Giving", color: "#FF00FF" },
    { tag: "transfer", userId: 2, label: "Transfer", color: "#00FFFF" },
  ]);
  const taggedTransactions = await db
    .select()
    .from(tagsLink)
    .leftJoin(tags_new, eq(tagsLink.tag, tags_new.tag));
  const transactionsToSeed = taggedTransactions.filter(
    (t) => t.tags_v2 !== null
  );
  const res = await db
    .insert(tagsLinkNew)
    .values(
      transactionsToSeed.map((t) => ({
        transaction_id: t.tags_link.transaction_id,
        tag_id: t.tags_v2!.id,
      }))
    )
    .returning();
  console.log(`seeded ${res.length} values`);
}

export async function clearCursor() {
  await db.update(userTable).set({ nextTransactionCursor: null });
}

export async function giveAllDefaultDiscretionaryTag() {
  const transactions = await db.query.transactions.findMany({
    with: { tagsLinks: true },
  });
  const transactionsWithoutTags = transactions.filter(
    (t) => t.tagsLinks.length === 0
  );
  await db.insert(tagsLink).values(
    transactionsWithoutTags.map((t) => ({
      transaction_id: t.transaction_id,
      tag: "discretionary",
    }))
  );
}

export async function applyAutoTagsToPendingTransactions(userId: number) {
  const tagLinksToAdd = await db
    .select()
    .from(transactions)
    .innerJoin(
      auto_tag_merchants,
      or(
        eq(transactions.name, auto_tag_merchants.name),
        eq(transactions.merchant_name, auto_tag_merchants.merchant_name)
      )
    );
  await db.insert(tagsLink).values(
    tagLinksToAdd.map((t) => ({
      transaction_id: t.transactions.transaction_id,
      tag: t.auto_tag_merchants.tag,
    }))
  );
}

await migrateAutoTagMerchants();
process.exit(0);
