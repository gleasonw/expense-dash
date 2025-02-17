import { plaidClient } from "@/plaid";
import { getUserWithToken } from "@/server/session";

export default async function Dashboard() {
  const userWithAccount = await getUserWithToken();

  const transactions = await plaidClient.transactionsGet({
    access_token: userWithAccount.plaidAccount.access_token,
    start_date: "2024-01-01",
    end_date: "2025-01-01",
    options: {
      count: 50,
    },
  });

  console.log(transactions.data);

  return (
    <div className="flex flex-col gap-4">
      {transactions.data.transactions.map((t) => (
        <div key={t.transaction_id}>
          <div className="flex gap-2 items-center w-full">
            <div>{t.name}</div>
            <div>{t.amount}</div>
          </div>
          <div className="p-5 flex flex-col gap-3">
            <div>{t.personal_finance_category?.confidence_level}</div>
            <div>{t.personal_finance_category?.detailed}</div>
            <div>{t.personal_finance_category?.primary}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
