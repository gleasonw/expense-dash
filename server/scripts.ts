import { db } from "@/server/db";
import {
  auto_tag_merchants,
  tags,
  tagsLink,
  transactions,
  userTable,
  tags_new,
  tagsLinkNew,
} from "@/server/schema";
import { eq, or } from "drizzle-orm";

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

await seedTags();
process.exit(0);
