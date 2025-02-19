import { TransactionDashboard } from "@/app/dashboard/TransactionDashboard";
import { plaidClient } from "@/plaid";
import { db, userTable } from "@/server/db";
import { getUserWithToken } from "@/server/session";
import { eq } from "drizzle-orm";

function getYMD(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function Dashboard() {
  const userWithAccount = await getUserWithToken();
  let transactions;
  try {
    transactions = await plaidClient.transactionsSync({
      access_token: userWithAccount.plaidAccount.access_token,
      count: 500,
      cursor: userWithAccount.user.nextTransactionCursor ?? "",
    });
  } catch (e) {
    console.log(e.response.data);
    console.log(e.message);
    return "check server";
  }

  await db
    .update(userTable)
    .set({ nextTransactionCursor: transactions.data.next_cursor })
    .where(eq(userTable.id, userWithAccount.user.id));

  console.log(transactions.data.added.length, " transactions synced to client");

  return (
    <div className="flex flex-col gap-4">
      <TransactionDashboard transactions={transactions.data.added} />
    </div>
  );
}
