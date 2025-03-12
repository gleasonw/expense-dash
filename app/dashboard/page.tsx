import { addTransactions } from "@/app/dashboard/actions";
import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { SpendingChart } from "@/app/dashboard/SpendingChart";
import { SpendingTable } from "@/app/dashboard/SpendingTable";
import { SpendingTargets } from "@/app/dashboard/SpendingTargets";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import {
  userTable,
  transactions,
  auto_tag_merchants,
  tagsLink,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { desc, eq, sql, and, inArray } from "drizzle-orm";
import * as R from "remeda";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  console.log("rendering page");
  const userWithAccount = await getUserWithToken();
  if (userWithAccount === "no-plaid-account") {
    return redirect("/link");
  }
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

  const autoTags = await db
    .select()
    .from(auto_tag_merchants)
    .where(
      and(
        inArray(
          auto_tag_merchants.name,
          latestTransactions.data.added.map((t) => t.name)
        ),
        eq(auto_tag_merchants.user_id, userWithAccount.user.id)
      )
    );

  const autoTagsByName = R.indexBy(autoTags, (at) => at.name);

  const transactionsToAutotag = latestTransactions.data.added.reduce(
    (acc, t) => {
      const autoTag = autoTagsByName[t.name];
      if (!autoTag) {
        return acc;
      }
      acc.push({ transaction_id: t.transaction_id, tag: autoTag.tag });
      return acc;
    },
    [] as { transaction_id: string; tag: string }[]
  );

  const operationsToRun = [
    db
      .update(userTable)
      .set({ nextTransactionCursor: latestTransactions.data.next_cursor })
      .where(eq(userTable.id, userWithAccount.user.id)),
    addTransactions(latestTransactions.data.added),
  ];

  if (transactionsToAutotag.length > 0) {
    operationsToRun.push(
      db.insert(tagsLink).values(
        transactionsToAutotag.map((t) => ({
          transaction_id: t.transaction_id,
          tag: t.tag,
        }))
      )
    );
  }

  await Promise.allSettled(operationsToRun);

  const discretionarySpendingByMonth = await db.execute(
    sql`
      SELECT
          DATE_TRUNC('month', t.date) AS month,
          SUM(CAST(t.amount AS NUMERIC)) AS amount,
          tl.tag,
          CASE
              WHEN DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE)
              THEN TRUE
              ELSE FALSE
          END AS is_current_month
      FROM
          transactions t
      JOIN
          tags_link tl ON t.transaction_id = tl.transaction_id
      WHERE
          t.user_id = ${userWithAccount.user.id}
          AND tl.tag not in ('income', 'transfer', 'expenses')
      GROUP BY
          DATE_TRUNC('month', t.date), tl.tag
      ORDER BY
          month;
    `
  );

  const ts = await db.query.transactions.findMany({
    with: { tagsLinks: { with: { tag: true } } },
    where: eq(transactions.user_id, userWithAccount.user.id),
    orderBy: [desc(transactions.date)],
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <SpendingCategorizer
          transactionsWithoutTag={ts.filter((t) => t.tagsLinks.length === 0)}
        />
        <div className="flex gap-3 flex-wrap">
          <div className="flex flex-col gap-10 max-w-[800px] mx-auto">
            <Income discretionaryByMonth={discretionarySpendingByMonth.rows} />
            <SpendingChart
              discretionaryByMonth={discretionarySpendingByMonth.rows}
            />
          </div>
          <div className="max-w-[800px]">
            <SpendingTable rows={ts} />
          </div>
        </div>
      </div>
    </div>
  );
}

async function Income({
  discretionaryByMonth,
}: {
  discretionaryByMonth: {
    month: string;
    amount: string;
    tag: string;
    is_current_month: boolean;
  }[];
}) {
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
        AND tl.tag in ('income', 'expenses')
    GROUP BY
        DATE_TRUNC('month', t.date), tl.tag
    ORDER BY
        month;
`
  )) as { rows: { month: string; amount: string; tag: string }[] };

  const currentMonthSpending = discretionaryByMonth.filter(
    (t) => t.is_current_month
  );

  return (
    <div className="text-2xl p-5">
      <SpendingTargets
        estimatedIncomeAndExpenses={estimatedIncomeAndExpenses.rows}
        currentMonthSpending={currentMonthSpending}
      />
    </div>
  );
}
