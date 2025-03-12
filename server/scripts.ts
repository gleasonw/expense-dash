import { db } from "@/server/db";
import {
  auto_tag_merchants,
  tags,
  tagsLink,
  transactions,
  userTable,
} from "@/server/schema";
import { eq, or } from "drizzle-orm";

export async function seedTags() {
  await db
    .insert(tags)
    .values([
      { tag: "expenses" },
      { tag: "income" },
      { tag: "discretionary" },
      { tag: "savings" },
      { tag: "giving" },
      { tag: "transfer" },
    ])
    .onConflictDoNothing();
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

await applyAutoTagsToPendingTransactions(2);
process.exit(0);
