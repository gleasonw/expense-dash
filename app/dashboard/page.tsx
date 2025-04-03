import { addTransactions, setTagAllocation } from "@/app/dashboard/actions";
import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { SpendingChart } from "@/app/dashboard/SpendingChart";
import { SpendingTable } from "@/app/dashboard/SpendingTable";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import {
  userTable,
  transactions,
  auto_tag_merchants,
  tagsLink,
  tags,
  tagAllocations,
  tags_new,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { desc, eq, sql, and, inArray } from "drizzle-orm";
import * as R from "remeda";
import { redirect } from "next/navigation";
import { Label } from "@/app/components/Label";

// TODO
// override dates, so you can put a charge towards next month's budget
// tag creation/ multiple tags per transaction
// monthly spending by category table view (choose tags)

export default async function Dashboard() {
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
          AND tl.tag not in ('income', 'transfer')
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

  const incomeQuery = (await db.execute(
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
        t.user_id = ${userWithAccount.user.id}
        AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND tl.tag = 'income'
    GROUP BY
        DATE_TRUNC('month', t.date), tl.tag
    ORDER BY
        month;
`
  )) as { rows: { month: string; amount: string; tag: string }[] };
  const estIncomeForPeriod = Math.round(
    parseInt(incomeQuery.rows?.[0]?.amount ?? "", 10) * -1
  );

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="border shadow-lg w-full p-3 flex items-center justify-center flex-wrap">
        <SpendingCategorizer
          transactionsWithoutTag={ts.filter((t) => t.tagsLinks.length === 0)}
        />
      </div>
      <TagMaker />
      <div className="flex w-full flex-wrap justify-center gap-10">
        <div className="flex flex-col gap-10 p-3 w-[900px]">
          <TargetForTagPicker />
          <div className="bg-gray-100 rounded-lg pg-3">
            <div>Todo: picker for monthly/quarterly</div>
            <Income
              taggedSpendingByPeriod={discretionarySpendingByMonth.rows}
            />
            <NetSpending estimatedIncomeForPeriod={estIncomeForPeriod} />
            <Expenses estimatedIncomeForPeriod={estIncomeForPeriod} />
          </div>
          <SpendingChart
            discretionaryByMonth={discretionarySpendingByMonth.rows}
          />
        </div>
        <div className="max-w-[800px]">
          <SpendingTable rows={ts} />
        </div>
      </div>
    </div>
  );
}

async function TagMaker() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }
  const existingTags = await db.query.tags_new.findMany({
    where: eq(tags_new.userId, user.user.id),
  });

  return (
    <div>
      <div className="flex flex-col">
        {existingTags.map((et) => (
          <div key={et.id}>{et.label}</div>
        ))}
      </div>
      <form></form>
    </div>
  );
}

async function NetSpending({
  estimatedIncomeForPeriod,
}: {
  estimatedIncomeForPeriod: number;
}) {
  const user = await getUserWithToken();

  const spendingQuery = await db.execute(
    sql`
    SELECT
      DATE_TRUNC('month', t.date) AS month,
      SUM(CAST(t.amount AS NUMERIC)) AS amount
    FROM
      transactions t
      JOIN tags_link tl ON t.transaction_id = tl.transaction_id
    WHERE
      t.user_id = ${user.user.id}
      AND tl.tag IN ('expenses', 'savings', 'discretionary', 'giving')
      AND t.date >= DATE_TRUNC('month', CURRENT_DATE)
      AND t.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    GROUP BY
      DATE_TRUNC('month', t.date);
    `
  );
  const spendingForMonth = spendingQuery.rows?.[0]?.amount;
  const spendingForMonthInt = parseInt(spendingForMonth ?? "", 10);
  return (
    <div>
      Actual net spending (non estimated expenses): {spendingForMonthInt}; total
      remaining: {estimatedIncomeForPeriod - spendingForMonthInt}
    </div>
  );
}

async function Expenses({
  estimatedIncomeForPeriod,
}: {
  estimatedIncomeForPeriod: number;
}) {
  const user = await getUserWithToken();
  const expenseQuery = await db.execute(
    sql`
    SELECT
      DATE_TRUNC('month', t.date) AS month,
      SUM(CAST(t.amount AS NUMERIC)) AS amount
    FROM
      transactions t
      JOIN tags_link tl ON t.transaction_id = tl.transaction_id
    WHERE
      t.user_id = ${user.user.id}
      AND tl.tag IN ('expenses')
      AND t.date >= DATE_TRUNC('month', CURRENT_DATE)
      AND t.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    GROUP BY
      DATE_TRUNC('month', t.date);
    `
  );
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
      target: {targetSpending}, actual: {expensesForPeriod}, diff:{" "}
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
  // todo: dedupe
  const allTags = await db.query.tags.findMany({ with: { allocation: true } });
  const tagsTracked = allTags.filter((t) => toTrack.includes(t.tag));
  console.log(tagsTracked);
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
  const trackedSpendingByKind = R.pick(currentPeriodSpendingByTag, toTrack);
  const trackedSpending = Object.values(trackedSpendingByKind).reduce(
    (acc, v) => {
      const currentSpending = parseInt(v.amount ?? "0");
      if (isNaN(currentSpending)) {
        return acc;
      }
      return acc + currentSpending;
    },
    0
  );
  const unspent = estIncome - estExpenses - trackedSpending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-5">
        <div className="flex gap-10 w-full">
          <Label text="Income">
            <span>${estIncome}</span>
          </Label>
          <Label text="Expenses">-${estExpenses}</Label>
          <Label text="To allocate">
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
        <Label text={"Unspent"}>
          <span className=" ">${Math.round(unspent)}</span>
        </Label>
      </div>
    </div>
  );
}
