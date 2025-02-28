import { db } from "@/server/db";
import { tags, tagsLink, userTable } from "@/server/schema";

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

await seedTags();
process.exit(0);
