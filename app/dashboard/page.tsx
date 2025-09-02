import {
  addTransactions,
  createTag,
  setTagAllocation,
} from "@/app/dashboard/actions";
import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { SpendingTable } from "@/app/dashboard/SpendingTable";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import { userTable, tags_new, Tag, TagAllocation } from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { eq, sql } from "drizzle-orm";
import * as style from "@/app/dashboard/dashboard.module.css";
import * as R from "remeda";
import { redirect } from "next/navigation";
import { Label } from "@/app/components/Label";
import Link from "next/link";
import {
  autoTagTransactions,
  getTransactionsWithTags,
  tagAllAsFirstTag,
  tryAutoTagTransactions,
} from "@/app/dashboard/transactions_sdk";
import {
  formatCurrency,
  toAppTransaction,
} from "@/app/dashboard/transaction_utils";
import { Suspense } from "react";
import {
  getNetSpendingByMonth,
  spendingForMonth,
} from "@/app/dashboard/aggregates";
import { SpendingChart } from "@/app/dashboard/SpendingChart";
import { IS_LOCAL_HOST } from "@/env";
import * as dateUtils from "@/app/utils/dates";

// TODO
// - filter transactions table by month (default this month, also allow all, or specific months, or ranges)
// - break down transactions table into accounts (tabs probably make the most sense here)
// - migrate savings page away from old spending query

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userWithAccount = await getUserWithToken();
  const params = await searchParams;
  const filterByTag = params.tag as string | undefined;
  // should be postgres-readable, eg. 2022-01-01
  const mParam = (await searchParams).monthUTC;
  const mParamString = typeof mParam === "string" ? mParam : undefined;
  const monthUTC = dateUtils.normYyyyMm(mParamString);
  console.log({ monthUTC });

  // const pastXMonths = params.pastXMonths as string | undefined;
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

  const [tsMerged, spending] = await Promise.all([
    getTransactionsWithTags({ tag: filterByTag, monthUTC }),
    spendingForMonth({
      monthUTC,
      //TODO: make these configurable, save view
      excludeTags: ["income", "transfer"],
    }),
  ]);

  return (
    <div className="flex flex-col gap-4 items-center w-full h-full">
      <div className="border shadow-lg w-full p-3 flex items-center justify-center flex-wrap">
        <SpendingCategorizer
          transactionsWithoutTag={tsMerged.filter((t) => t.tags.length === 0)}
        />
        <button className="border" onClick={tryAutoTagTransactions}>
          Autotag transactions
        </button>
        {IS_LOCAL_HOST && (
          <button onClick={tagAllAsFirstTag}>tag all as first tag</button>
        )}
      </div>

      <div className="flex flex-col max-w-full overflow-hidden gap-10">
        <div>
          <SpendingTargets
            taggedSpendingByPeriod={
              spending?.map((s) => ({
                ...s,
                is_current_month: true,
              })) ?? []
            }
          />
        </div>
        <div className="flex">
          <Suspense>
            <NetSpendingByMonth monthUTC={monthUTC} />
          </Suspense>
          {/**@ts-expect-error css modules are a pain with ts */}
          <div className={style.chart}>
            <SpendingChart discretionaryByMonth={spending ?? []} />
          </div>
        </div>

        <div className="max-w-[1100] mx-auto hidden sm:flex flex-col gap-3">
          <TagMaker />
          <TransactionFilters />
          <SpendingTable rows={tsMerged} />
        </div>
        <div className="w-full flex sm:hidden flex-col">
          <TransactionFilters />
          {tsMerged.map((t) => (
            <div
              key={t.transaction_id}
              className="p-3 border-b hover:bg-gray-100"
            >
              <span className="font-semibold">{t.name}</span>
              <span className="text-gray-600">
                {" "}
                - {formatCurrency(t.amount)}
              </span>
              <span className="text-gray-500">
                {" "}
                - {new Date(t.date).toLocaleDateString()}
              </span>
              <div className="flex flex-wrap gap-2">
                {t.tags.map((tag) => (
                  <span
                    key={tag.tag}
                    className="bg-blue-200 text-blue-800 px-2 py-1 rounded-md"
                  >
                    {tag.tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function NetSpendingByMonth({
  monthUTC,
}: {
  monthUTC: dateUtils.YyyyMm;
}) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }
  const rows = await getNetSpendingByMonth({ monthUTC });
  console.log({ rows });
  return (
    <div className="grid grid-cols-2 md:flex gap-3 flex-wrap">
      {rows
        .slice()
        .sort(
          (a, b) => new Date(b.month).getTime() - new Date(a.month).getTime()
        )
        .slice(0, 1)
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

async function TagMaker() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }

  return (
    <div>
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

// todo: make this a "display for" or something, don't hardcode
const toTrack = ["discretionary", "savings", "giving"] as const;

const labelForKind: Record<TargetKind, string> = {
  discretionary: "Discretionary",
  giving: "Giving",
  savings: "Savings",
};

type TargetKind = (typeof toTrack)[number];

async function SpendingTargets({
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
  const allTags = await db.query.tags_new.findMany({
    with: { allocation: true },
  });
  const tagsTracked = allTags.filter((t) =>
    toTrack.includes(t.tag as TargetKind)
  );
  const targets = tagsTracked.reduce((acc, t) => {
    if (isNaN(parseInt(t.allocation?.allocation))) {
      return acc;
    }
    acc[t.tag as TargetKind] = t;
    return acc;
  }, {} as Record<TargetKind, Tag & { allocation: TagAllocation | null }>);

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

  const { income } = R.groupBy(estimatedIncomeAndExpenses.rows, (r) => r.tag);

  const currentPeriodSpendingByTag = R.indexBy(
    currentPeriodSpending,
    (s) => s.tag
  );

  const estIncome = parseInt(income?.[0].amount ?? "0", 10) * -1;

  return (
    <div className="flex flex-col gap-5">
      <Label text="Est. Income">
        <span>${estIncome}</span>
      </Label>
      <div className="flex gap-5 flex-wrap">
        {toTrack.map((kind) => {
          const tag = targets[kind];
          if (!tag) {
            return <div key={kind}>No allocation for {kind}</div>;
          }
          const allocation = parseInt(tag?.allocation?.allocation ?? "0", 10);
          const targetSpending = (allocation / 100) * estIncome;
          const currentSpending = parseInt(
            currentPeriodSpendingByTag[kind]?.amount ?? "0"
          );
          return (
            <div
              className="flex border shadow-lg p-3 gap-5 flex-col bg-white"
              key={kind}
            >
              <div className="text-lg text-gray-500">{labelForKind[kind]}</div>
              <form
                action={setTagAllocation}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  name={tag.id}
                  defaultValue={allocation}
                  className="w-12"
                />
                <span>%</span>
                <button type="submit" className="shadow-sm  rounded px-2 py-1">
                  update
                </button>
              </form>
              <div className="text-xs">
                ${currentSpending} / ${Math.round(targetSpending)}
              </div>
              <div className="w-full h-6 overflow-hidden border rounded">
                <div
                  className={`bg-blue-500 relative h-full`}
                  style={{
                    width: `${(currentSpending / targetSpending) * 100}%`,
                  }}
                ></div>
              </div>
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
  );
}
