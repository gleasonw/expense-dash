import {
  addTransactions,
  createTag,
  setTagAllocation,
} from "@/app/dashboard/actions";
import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { SpendingChart } from "@/app/dashboard/SpendingChart";
import { SpendingTable } from "@/app/dashboard/SpendingTable";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import * as style from "@/app/dashboard/dashboard.module.css";
import {
  userTable,
  transactions,
  tagAllocations,
  tags_new,
  tagsLinkNew,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { eq, sql, and, desc } from "drizzle-orm";
import * as R from "remeda";
import { redirect } from "next/navigation";
import { Label } from "@/app/components/Label";
import { SpendChecker } from "@/app/dashboard/SpendChecker";
import Link from "next/link";
import {
  autoTagTransactions,
  tryAutoTagTransactions,
} from "@/app/dashboard/transactions_sdk";
import {
  formatCurrency,
  toAppTransaction,
} from "@/app/dashboard/transaction_utils";
import { Suspense } from "react";

// TODO
// override dates, so you can put a charge towards next month's budget
// monthly spending by category table view (choose tags)
// why is the sorting so strange? why would adding a tag change sorting?

// bind data more directly to components... don't pass it down just to avoid duplicate queries...
// that should be solved by the db layer

// TODO: dan abramov suggestion: to get optimistic updates, have a top-level provider,
// have components subscribe to optimistic updates...

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userWithAccount = await getUserWithToken();
  const params = await searchParams;
  const filterByTag = params.tag as string | undefined;
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
    console.error("Error fetching transactions", e);
    return "check server";
  }

  const newTransactions = toAppTransaction(latestTransactions.data.added);

  const operationsToRun = [
    db
      .update(userTable)
      .set({ nextTransactionCursor: latestTransactions.data.next_cursor })
      .where(eq(userTable.id, userWithAccount.user.id)),
    addTransactions(newTransactions),
    autoTagTransactions(newTransactions),
  ];

  await Promise.allSettled(operationsToRun);

  // todo: make these fetches concurrent
  const spendingByMonth = (await db.execute(
    sql`
      SELECT
          DATE_TRUNC('month', t.date) AS month,
          SUM(CAST(t.amount AS NUMERIC)) AS amount,
          tv.tag,
          CASE
              WHEN DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE)
              THEN TRUE
              ELSE FALSE
          END AS is_current_month
      FROM
          transactions t
      JOIN
          tags_link_new tl ON t.transaction_id = tl.transaction_id
      JOIN
          tags_v2 tv ON tl.tag_id = tv.id
      WHERE
          t.user_id = ${userWithAccount.user.id}
          AND tv.tag not in ('income', 'transfer')
      GROUP BY
          DATE_TRUNC('month', t.date), tv.id
      ORDER BY
          month;
    `
  )) as {
    rows: {
      month: string;
      amount: string;
      tag: string;
      is_current_month: boolean;
    }[];
  };

  const ts = await db
    .select()
    .from(transactions)
    .leftJoin(
      tagsLinkNew,
      eq(transactions.transaction_id, tagsLinkNew.transaction_id)
    )
    .leftJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
    .where(
      filterByTag
        ? and(
            eq(transactions.user_id, userWithAccount.user.id),
            eq(tags_new.tag, filterByTag)
          )
        : eq(transactions.user_id, userWithAccount.user.id)
    )
    .orderBy(desc(transactions.date));

  const tsMerged = Object.values(
    R.groupBy(ts, (t) => t.transactions.transaction_id)
  ).map((tagsForTransaction) => {
    const baseTransaction = tagsForTransaction[0].transactions;
    const tags = tagsForTransaction
      .map((t) => t.tags_v2)
      .filter((t) => t !== null);
    return {
      ...baseTransaction,
      tags,
    };
  });

  const incomeQuery = (await db.execute(
    sql`
    SELECT
      DATE_TRUNC('month', t.date) AS month,
      SUM(CAST(t.amount AS NUMERIC)) AS amount,
      tv.tag
    FROM
        transactions t
    JOIN
        tags_link_new tl ON t.transaction_id = tl.transaction_id
    JOIN
        tags_v2 tv ON tl.tag_id = tv.id
    WHERE
        t.user_id = ${userWithAccount.user.id}
        AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND tv.tag = 'income'
    GROUP BY
        DATE_TRUNC('month', t.date), tv.tag
    ORDER BY
        month;
`
  )) as { rows: { month: string; amount: string; tag: string }[] };
  const estIncomeForPeriod = Math.round(
    parseInt(incomeQuery.rows?.[0]?.amount ?? "", 10) * -1
  );

  return (
    <div className="flex flex-col gap-4 items-center w-full h-full">
      <div className="border shadow-lg w-full p-3 flex items-center justify-center flex-wrap">
        <SpendingCategorizer
          transactionsWithoutTag={tsMerged.filter((t) => t.tags.length === 0)}
        />
        <button className="border" onClick={tryAutoTagTransactions}>
          Autotag transactions
        </button>
      </div>
      <TargetForTagPicker />
      {/**@ts-expect-error css modules are a pain with ts */}
      <div className={style.chart}>
        <SpendingChart discretionaryByMonth={spendingByMonth.rows} />
      </div>

      <div className="flex">
        <div className="flex flex-col gap-10 p-3">
          <div className="bg-gray-100 rounded-lg pg-3 max-w-[600px]">
            <Income taggedSpendingByPeriod={spendingByMonth.rows} />
            <Expenses estimatedIncomeForPeriod={estIncomeForPeriod} />
          </div>
          <Suspense>
            <NetSpendingByMonth />
          </Suspense>
          <HowMuchDidISpendOnTag />
        </div>

        <div className="w-full">
          <TagMaker />
          <TransactionFilters />
          <SpendingTable rows={tsMerged} />
        </div>
      </div>
    </div>
  );
}

async function NetSpendingByMonth() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }
  const netSpend = (await db.execute(`
     WITH monthly_income AS (
      -- Calculate total income per month
      SELECT
        DATE_TRUNC('month', t.date) AS month,
        SUM(CAST(t.amount AS NUMERIC)) * -1 AS total_income
      FROM
        transactions t
      JOIN tags_link_new tl ON t.transaction_id = tl.transaction_id
      JOIN tags_v2 tv ON tl.tag_id = tv.id
      WHERE
        t.user_id = ${user.user.id}
        AND tv.tag = 'income' -- Only include transactions tagged as 'income'
      GROUP BY
        DATE_TRUNC('month', t.date)
    ), monthly_spending AS (
      -- Calculate total spending per month (your original query logic)
      SELECT
        DATE_TRUNC('month', t.date) AS month,
        SUM(CAST(t.amount AS NUMERIC)) AS total_spending
      FROM
        transactions t
      WHERE
        t.user_id = ${user.user.id}
        AND t.transaction_id IN (
          SELECT DISTINCT tl.transaction_id
          FROM tags_link_new tl
          JOIN tags_v2 tv ON tl.tag_id = tv.id
          WHERE tv.tag NOT IN ('income', 'transfer') -- Exclude income & transfers
        )
      GROUP BY
        DATE_TRUNC('month', t.date)
    )
    -- Combine income and spending, calculate net
    SELECT
      COALESCE(mi.month, ms.month) AS month, -- Use COALESCE in case a month has only income or only spending
      COALESCE(mi.total_income, 0) AS total_income,
      COALESCE(ms.total_spending, 0) AS total_spending,
      (COALESCE(mi.total_income, 0) - COALESCE(ms.total_spending, 0)) AS net_amount
    FROM
      monthly_income mi
    FULL OUTER JOIN -- Use FULL OUTER JOIN to include months with only income or only spending
      monthly_spending ms ON mi.month = ms.month
    ORDER BY
      month ASC;
`)) as {
    rows: {
      month: string;
      total_income: string;
      total_spending: string;
      net_amount: string;
    }[];
  };
  return (
    <div className="flex flex-wrap gap-5">
      {netSpend?.rows
        ?.toSorted(
          (a, b) => new Date(b.month).getTime() - new Date(a.month).getTime()
        )
        .map((r) => {
          // Parse amounts once for clarity and safety
          const income = parseInt(r.total_income, 10) || 0;
          const spending = parseInt(r.total_spending, 10) || 0;
          const net = parseInt(r.net_amount, 10) || 0;

          // Determine the color class based on the net amount
          const netColorClass =
            net > 0
              ? "text-green-600" // Surplus
              : net < 0
              ? "text-red-600" // Deficit
              : "text-black"; // Zero or default

          return (
            <div
              key={r.month} // Assuming r.month is unique and stable (like '2023-10-01T00:00:00.000Z')
              className="flex w-48 flex-col gap-2 rounded border bg-white p-4 shadow-lg" // Added width, rounded corners, adjusted gap/padding
            >
              {/* Format the month nicely */}
              <span className="mb-2 text-center font-semibold text-gray-700">
                {new Date(r.month).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}
              </span>
              <Label text={"Income"} className="text-md">
                {" "}
                {/* Adjusted size */}
                <span className="text-right font-medium">
                  {formatCurrency(income)}
                </span>
              </Label>
              <Label text={"Spending"} className="text-md">
                <span className="text-right font-medium">
                  {formatCurrency(spending)}
                </span>
              </Label>
              <hr className="my-1" /> {/* Optional separator */}
              <Label text={"Net"} className="text-md font-semibold">
                {" "}
                {/* Make Net label bold */}
                {/* Apply the conditional color class */}
                <span className={`text-right font-bold ${netColorClass}`}>
                  {formatCurrency(net)}
                </span>
              </Label>
            </div>
          );
        })}
    </div>
  );
}

async function TransactionFilters() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }
  const userTags = await db.query.tags_new.findMany({
    where: eq(tags_new.userId, user.user.id),
  });
  return (
    <div className="flex flex-wrap gap-2">
      {userTags.map((t) => (
        <Link href={`?tag=${t.tag}`} key={t.tag}>
          <div className="p-2 border hover:bg-gray-200">{t.tag}</div>
        </Link>
      ))}
      <Link href={`/dashboard`}>
        <div className="p-2 border hover:bg-gray-200">All</div>
      </Link>
    </div>
  );
}

async function HowMuchDidISpendOnTag() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }
  const spendingByTagLastMonth = (await db.execute(
    sql`
    SELECT
        DATE_TRUNC('month', t.date) AS month,
        SUM(CAST(t.amount AS NUMERIC)) AS amount,
        tv.tag,
        tv.id as tag_id
    FROM
        transactions t
    JOIN
        tags_link_new tln ON t.transaction_id = tln.transaction_id
    JOIN
        tags_v2 tv ON tln.tag_id = tv.id
    WHERE
        t.user_id = ${user.user.id}
        AND tv.tag not in ('income', 'transfer')
        AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    GROUP BY
        DATE_TRUNC('month', t.date), tv.tag, tv.id
    ORDER BY
        month;
    `
  )) as {
    rows: { month: string; amount: string; tag: string; tag_id: string }[];
  };

  return (
    <>
      <SpendChecker spending={spendingByTagLastMonth.rows} />
    </>
  );
}

async function TagMaker() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }

  return (
    <div>
      <h1 className="text-lg">Tags</h1>
      <form action={createTag}>
        <input
          name="tag"
          type="text"
          className="border rounded-md shadow-sm"
          placeholder="tag"
        />

        <button type="submit" className="p-2 border hover:bg-gray-200">
          Create
        </button>
      </form>

      <form></form>
    </div>
  );
}

async function Expenses({
  estimatedIncomeForPeriod,
}: {
  estimatedIncomeForPeriod: number;
}) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }
  const expenseQuery = (await db.execute(
    sql`
    SELECT
      DATE_TRUNC('month', t.date) AS month,
      SUM(CAST(t.amount AS NUMERIC)) AS amount
    FROM
      transactions t
      JOIN tags_link_new tl ON t.transaction_id = tl.transaction_id
      JOIN tags_v2 tv ON tl.tag_id = tv.id
    WHERE
      t.user_id = ${user.user.id}
      AND tv.tag IN ('expenses')
      AND t.date >= DATE_TRUNC('month', CURRENT_DATE)
      AND t.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    GROUP BY
      DATE_TRUNC('month', t.date);
    `
  )) as {
    rows: { month: string; amount: string }[];
  };
  const expensesForPeriod = parseInt(expenseQuery.rows?.[0]?.amount ?? "", 10);
  const expenseAllocation = await db.query.tagAllocations.findFirst({
    where: eq(tagAllocations.tag, "expenses"),
    with: { tag: true },
  });
  if (!expenseAllocation) {
    return <div>No allocation</div>;
  }
  const targetSpending = Math.round(
    estimatedIncomeForPeriod * (parseInt(expenseAllocation.allocation) / 100)
  );
  return (
    <div>
      target expenses: {targetSpending}, actual: {expensesForPeriod}, diff:{" "}
      {targetSpending - expensesForPeriod}
    </div>
  );
}

async function TargetForTagPicker() {
  const allTags = await db.query.tags.findMany({ with: { allocation: true } });
  const tags = allTags.filter(
    (t) => t.tag !== "income" && t.tag !== "transfer"
  );
  const sumAllocations = tags.reduce((acc, t) => {
    return acc + parseInt(t.allocation?.allocation ?? "0", 10);
  }, 0);
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex items-center gap-3 flex-wrap"
        action={setTagAllocation}
      >
        {tags.map((t) => (
          <Label text={t.tag} key={t.tag}>
            <div className="flex gap-2">
              <input
                name={t.tag}
                type="number"
                className="w-14 inset-4 border"
                defaultValue={t.allocation?.allocation ?? ""}
              />
              <span>%</span>
            </div>
          </Label>
        ))}
        <div>used: {sumAllocations}%</div>
        <button className="p-2 border hover:bg-gray-200" type="submit">
          Save
        </button>
      </form>
    </div>
  );
}

const toTrack = ["discretionary", "savings", "giving"] as const;

const labelForKind: Record<TargetKind, string> = {
  discretionary: "Discretionary",
  giving: "Giving",
  savings: "Savings",
};

type TargetKind = (typeof toTrack)[number];

async function Income({
  taggedSpendingByPeriod,
}: {
  taggedSpendingByPeriod: {
    month: string;
    amount: string;
    tag: string;
    is_current_month: boolean;
  }[];
}) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }
  // todo: dedupe, migrate to new custom tag model
  const allTags = await db.query.tags.findMany({ with: { allocation: true } });
  const tagsTracked = allTags.filter((t) =>
    toTrack.includes(t.tag as TargetKind)
  );
  const targets = tagsTracked.reduce((acc, t) => {
    if (isNaN(parseInt(t.allocation.allocation))) {
      return acc;
    }
    acc[t.tag as TargetKind] = parseInt(t.allocation.allocation, 10);
    return acc;
  }, {} as Record<TargetKind, number>);

  const estimatedIncomeAndExpenses = (await db.execute(
    sql`
    SELECT
      DATE_TRUNC('month', t.date) AS month,
      SUM(CAST(t.amount AS NUMERIC)) AS amount,
      tv.tag
    FROM
        transactions t
    JOIN
        tags_link_new tl ON t.transaction_id = tl.transaction_id
    JOIN tags_v2 tv ON tl.tag_id = tv.id
        WHERE
        t.user_id = ${user.user.id}
        AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND tv.tag in ('income', 'expenses')
    GROUP BY
        DATE_TRUNC('month', t.date), tv.tag
    ORDER BY
        month;
`
  )) as { rows: { month: string; amount: string; tag: string }[] };

  const currentPeriodSpending = taggedSpendingByPeriod.filter(
    (t) => t.is_current_month
  );

  const { income, expenses } = R.groupBy(
    estimatedIncomeAndExpenses.rows,
    (r) => r.tag
  );

  const currentPeriodSpendingByTag = R.indexBy(
    currentPeriodSpending,
    (s) => s.tag
  );

  const estIncome = parseInt(income?.[0].amount ?? "0", 10) * -1;
  const estExpenses = parseInt(expenses?.[0].amount ?? "0", 10);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-5">
        <div className="flex gap-10 w-full flex-wrap">
          <Label text="Est. Income">
            <span>${estIncome}</span>
          </Label>
          <Label text="Est. Expenses">-${estExpenses}</Label>
          <Label text="Non defense discretionary">
            <span>${estIncome - estExpenses}</span>
          </Label>
        </div>
        <div className="flex gap-5">
          <div className="flex gap-10 flex-wrap">
            {toTrack.map((kind) => {
              const targetSpending = (targets[kind] / 100) * estIncome;
              const currentSpending = parseInt(
                currentPeriodSpendingByTag[kind]?.amount ?? "0"
              );
              return (
                <div
                  className="flex border shadow-lg p-3 gap-5 flex-col bg-white"
                  key={kind}
                >
                  <Label text={labelForKind[kind]} className="text-lg">
                    (${Math.round(targetSpending)}) -
                    {isNaN(currentSpending) ? "$0" : `$${currentSpending}`}
                  </Label>
                  <Label text="To spend" className="text-3xl">
                    {isNaN(currentSpending) ? (
                      <span className="text-right">
                        ${targetSpending.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-right">
                        ${Math.round(targetSpending - currentSpending)}
                      </span>
                    )}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
