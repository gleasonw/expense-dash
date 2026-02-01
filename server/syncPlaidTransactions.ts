import { addTransactions } from "@/app/dashboard/actions";
import { toAppTransaction } from "@/app/dashboard/transaction_utils";
import { autoTagTransactions } from "@/app/dashboard/transactions_sdk";
import { db } from "@/server/db";
import { plaidClient } from "@/server/plaid";
import { userTable } from "@/server/schema";
import { eq } from "drizzle-orm";

export async function syncUsersPlaidTransactions() {
  const users = await db.query.userTable.findMany({
    with: {
      plaidAccounts: true,
    },
  });
  Promise.all(
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
        console.error("Error fetching transactions", e);
        return "check server";
      }

      const newTransactions = toAppTransaction(latestTransactions.data.added);

      const operationsToRun = [
        db
          .update(userTable)
          .set({ nextTransactionCursor: latestTransactions.data.next_cursor })
          .where(eq(userTable.id, u.id)),
        addTransactions(newTransactions),
        autoTagTransactions(newTransactions),
      ];

      await Promise.allSettled(operationsToRun);
      console.log(
        `sync succesful, pulled ${latestTransactions.data.added.length} new transactions`
      );
    })
  );
}
