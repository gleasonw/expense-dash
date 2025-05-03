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
import {
  userTable,
  transactions,
  tagAllocations,
  tags_new,
  tagsLinkNew,
  auto_tag_merchants_new,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { eq, sql, and, inArray } from "drizzle-orm";
import * as R from "remeda";
import { redirect } from "next/navigation";
import { Label } from "@/app/components/Label";
import { SpendChecker } from "@/app/dashboard/SpendChecker";
import Link from "next/link";
import { Transaction } from "plaid";
import { AppTransaction } from "@/app/dashboard/types";

// TODO
// override dates, so you can put a charge towards next month's budget
// monthly spending by category table view (choose tags)
// why is the sorting so strange? why would adding a tag change sorting?

/**annoying drizzle parsing numbers to strings for postgres precision reasons */
function toAppTransaction(transactions: Transaction[]): AppTransaction[] {
  return transactions.map((t) => ({
    ...t,
    amount: t.amount.toString(),
  })) as AppTransaction[];
}

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

  const autoTags = await db
    .select()
    .from(auto_tag_merchants_new)
    .where(
      and(
        inArray(
          auto_tag_merchants_new.name,
          newTransactions.map((t) => t.name)
        ),
        eq(auto_tag_merchants_new.user_id, userWithAccount.user.id)
      )
    );

  const autoTagsByName = R.indexBy(autoTags, (at) => at.name);

  const transactionsToAutotag = latestTransactions.data.added.reduce(
    (acc, t) => {
      const autoTag = autoTagsByName[t.name];
      if (!autoTag) {
        return acc;
      }
      acc.push({ transaction_id: t.transaction_id, tag_id: autoTag.tag_id });
      return acc;
    },
    [] as { transaction_id: string; tag_id: string }[]
  );

  const operationsToRun = [
    db
      .update(userTable)
      .set({ nextTransactionCursor: latestTransactions.data.next_cursor })
      .where(eq(userTable.id, userWithAccount.user.id)),
    addTransactions(newTransactions),
  ];

  if (transactionsToAutotag.length > 0) {
    operationsToRun.push(
      db.insert(tagsLinkNew).values(
        transactionsToAutotag.map((t) => ({
          transaction_id: t.transaction_id,
          tag_id: t.tag_id,
        }))
      )
    );
  }

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
    .orderBy(sql`${transactions.datetime} DESC nulls last`);

  const tsMerged = Object.values(
    R.groupBy(ts, (t) => t.transactions.transaction_id)
  )
    .map((tagsForTransaction) => {
      const baseTransaction = tagsForTransaction[0].transactions;
      const tags = tagsForTransaction
        .map((t) => t.tags_v2)
        .filter((t) => t !== null);
      return {
        ...baseTransaction,
        tags,
      };
    })
    .sort((a, b) => {
      const dateA = new Date(a.datetime ?? a.authorized_date ?? "");
      const dateB = new Date(b.datetime ?? b.authorized_date ?? "");
      if (dateA < dateB) {
        return 1;
      } else if (dateA > dateB) {
        return -1;
      } else {
        return 0;
      }
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
    <div className="flex flex-col gap-4 items-center">
      <div className="border shadow-lg w-full p-3 flex items-center justify-center flex-wrap">
        <SpendingCategorizer
          transactionsWithoutTag={tsMerged.filter((t) => t.tags.length === 0)}
        />
      </div>
      <div className="grid lg:grid-cols-2 gap-20">
        <div className="flex flex-col gap-10 p-3 w-[900px]">
          <TargetForTagPicker />
          <div className="bg-gray-100 rounded-lg pg-3">
            <div>Todo: picker for monthly/quarterly</div>
            <Income taggedSpendingByPeriod={spendingByMonth.rows} />
            <NetSpending estimatedIncomeForPeriod={estIncomeForPeriod} />
            <Expenses estimatedIncomeForPeriod={estIncomeForPeriod} />
          </div>
          <SpendingChart discretionaryByMonth={spendingByMonth.rows} />
          <HowMuchDidISpendOnTag />
        </div>

        <div className="max-w-[1000px]">
          <TagMaker />
          <TransactionFilters />
          <SpendingTable rows={tsMerged} />
        </div>
      </div>
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

async function NetSpending({
  estimatedIncomeForPeriod,
}: {
  estimatedIncomeForPeriod: number;
}) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }

  const spendingQuery = (await db.execute(
    sql`
      SELECT
        DATE_TRUNC('month', t.date) AS month,
        SUM(CAST(t.amount AS NUMERIC)) AS amount
      FROM
        transactions t
      WHERE
        t.user_id = ${user.user.id}
        AND t.date >= DATE_TRUNC('month', CURRENT_DATE)
        AND t.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND t.transaction_id IN (
          SELECT DISTINCT tl.transaction_id
          FROM tags_link_new tl
          JOIN tags_v2 tv ON tl.tag_id = tv.id
          WHERE tv.tag NOT IN ('income', 'transfer')
        )
      GROUP BY
        DATE_TRUNC('month', t.date);
    `
  )) as {
    rows: { month: string; amount: string }[];
  };
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
          <Label text="Est. Income">
            <span>${estIncome}</span>
          </Label>
          <Label text="Est. Expenses">-${estExpenses}</Label>
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
