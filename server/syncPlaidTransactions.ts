import { toAppTransaction } from "@/app/dashboard/transaction_utils";
import { autoTagTransactionsForUser } from "@/app/dashboard/transactions_sdk";
import { db } from "@/server/db";
import { plaidClient } from "@/server/plaid";
import { transactions, userTable } from "@/server/schema";
import { eq } from "drizzle-orm";

export async function syncUsersPlaidTransactions() {
  const users = await db.query.userTable.findMany({
    with: {
      plaidAccounts: true,
    },
  });
  await Promise.all(
    users.map(async (u) => {
      // Sync Plaid transactions
      console.log(`syncing user ${u.name}`);
      const account = u.plaidAccounts.at(0);
      if (!account) {
        return;
      }
      console.log(`syncing account ${account.id}`);
      let latestTransactions;
      try {
        latestTransactions = await plaidClient.transactionsSync({
          access_token: account.access_token,
          count: 500,
          //TODO: hm this is just for the one account
          cursor: u.nextTransactionCursor ?? undefined,
        });
      } catch (e) {
        console.error("Error fetching transactions for user", u.name, e);
        return;
      }

      const newTransactions = toAppTransaction(latestTransactions.data.added);

      const operationsToRun = [];
      operationsToRun.push(
        db
          .update(userTable)
          .set({ nextTransactionCursor: latestTransactions.data.next_cursor })
          .where(eq(userTable.id, u.id))
      );

      if (newTransactions.length > 0) {
        operationsToRun.push(
          db
            .insert(transactions)
            .values(
              newTransactions.map((t) => ({
                ...t,
                user_id: u.id,
                authorized_datetime: t.authorized_datetime
                  ? new Date(t.authorized_datetime)
                  : null,
                datetime: t.datetime ? new Date(t.datetime) : null,
              }))
            )
            .onConflictDoNothing()
        );
      }

      const results = await Promise.allSettled(operationsToRun);

      // Check for failed operations
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error(`Failed operations for user ${u.name}:`, failures);
        return;
      }

      const autoTagged = await autoTagTransactionsForUser(newTransactions, u);

      if (autoTagged && autoTagged.autoTagged.length > 0) {
        const taggedInfo = autoTagged.autoTagged.map((t) => {
          const transaction = newTransactions.find(
            (nt) => nt.transaction_id === t.transaction_id
          );
          return `${transaction?.name ?? "unknown"} → ${t.tagName}`;
        });
        console.log(
          `Auto-tagged ${autoTagged.autoTagged.length} transactions:`,
          taggedInfo
        );
      }

      console.log(
        `sync successful, pulled ${latestTransactions.data.added.length} new transactions`
      );
    })
  );
}
