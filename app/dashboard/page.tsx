import { TransactionDashboard } from "@/app/dashboard/TransactionDashboard";
import { plaidClient } from "@/plaid";
import { getUserWithToken } from "@/server/session";

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
    transactions = await plaidClient.transactionsGet({
      access_token: userWithAccount.plaidAccount.access_token,
      start_date: "2023-01-01",
      end_date: getYMD(),
      options: {
        count: 1001,
      },
    });
  } catch (e) {
    console.log(e.response.data);
    console.log(e.message);
    return "check server";
  }

  return (
    <div className="flex flex-col gap-4">
      <TransactionDashboard transactions={transactions.data.transactions} />
    </div>
  );
}
