import { addTransactions } from "@/app/dashboard/actions";
import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { SpendingChart } from "@/app/dashboard/SpendingChart";
import {
  SpendingTable,
  TransactionDashboard,
} from "@/app/dashboard/SpendingTable";
import { SpendingTargets } from "@/app/dashboard/SpendingTargets";
import { plaidClient } from "@/plaid";
import { db } from "@/server/db";
import { userTable, transactions } from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { asc, desc, eq, sql } from "drizzle-orm";

function getYMD(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function Dashboard() {
  const userWithAccount = await getUserWithToken();
  let latestTransactions;
  try {
    latestTransactions = await plaidClient.transactionsSync({
      access_token: userWithAccount.plaidAccount.access_token,
      count: 500,
      cursor: userWithAccount.user.nextTransactionCursor ?? undefined,
    });
  } catch (e) {
    console.log(e.response.data);
    console.log(e.message);
    return "check server";
  }

  await Promise.allSettled([
    db
      .update(userTable)
      .set({ nextTransactionCursor: latestTransactions.data.next_cursor })
      .where(eq(userTable.id, userWithAccount.user.id)),
    addTransactions(latestTransactions.data.added),
  ]);

  const discretionarySpendingByMonth = await db.execute(
    sql`
      SELECT
          DATE_TRUNC('month', t.date) AS month,
          SUM(CAST(t.amount AS NUMERIC)) AS total_discretionary_spending,
          tl.tag
      FROM
          transactions t
      JOIN
          tags_link tl ON t.transaction_id = tl.transaction_id
      WHERE
          t.user_id = ${userWithAccount.user.id}
          AND tl.tag in ('discretionary', 'expenses')
      GROUP BY
          DATE_TRUNC('month', t.date), tl.tag
      ORDER BY
          month;
    `
  );

  console.log(discretionarySpendingByMonth);

  const ts = await db.query.transactions.findMany({
    with: { tagsLinks: { with: { tag: true } } },
    where: eq(transactions.user_id, userWithAccount.user.id),
    orderBy: desc(transactions.date),
  });

  console.log(ts.length, " transactions found");

  console.log(
    latestTransactions.data.added.length,
    " transactions synced to client"
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <SpendingCategorizer
          transactionsWithoutTag={ts.filter((t) => t.tagsLinks.length === 0)}
        />
        <div className="grid grid-cols-2">
          <Income />
          <div className="w-[600px] mx-auto">
            <SpendingChart
              discretionaryByMonth={discretionarySpendingByMonth.rows}
            />
          </div>
        </div>
        <SpendingTable rows={ts} />
      </div>
    </div>
  );
}

async function Income() {
  const user = await getUserWithToken();
  const estimatedIncomeAndExpenses = (await db.execute(
    sql`
    SELECT
      DATE_TRUNC('month', t.date) AS month,
      SUM(CAST(t.amount AS NUMERIC)) AS amount,
      tl.tag
    FROM
        transactions t
    JOIN
        tags_link tl ON t.transaction_id = tl.transaction_id
    WHERE
        t.user_id = ${user.user.id}
        AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    GROUP BY
        DATE_TRUNC('month', t.date), tl.tag
    ORDER BY
        month;
`
  )) as { rows: { month: string; amount: string; tag: string }[] };
  console.log(estimatedIncomeAndExpenses);
  return (
    <div className="text-2xl p-5">
      <SpendingTargets
        estimatedIncomeAndExpenses={estimatedIncomeAndExpenses.rows}
      />
    </div>
  );
}
