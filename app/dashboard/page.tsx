import { addTransactions } from "@/app/dashboard/actions";
import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import {
  userTable,
  tags_new,
  tagsLinkNew,
  transactions,
  tagAllocationsNew,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { and, eq, gte, lt, notInArray, sql } from "drizzle-orm";
import * as style from "@/app/dashboard/dashboard.module.css";
import * as R from "remeda";
import { redirect } from "next/navigation";
import {
  autoTagTransactions,
  getTransactionsWithTags,
  tagAllAsFirstTag,
  tryAutoTagTransactions,
} from "@/app/dashboard/transactions_sdk";
import { toAppTransaction } from "@/app/dashboard/transaction_utils";
import {
  getNetSpendingByMonth,
  spendingForMonth,
} from "@/app/dashboard/aggregates";
import { SpendingChart } from "@/app/dashboard/SpendingChart";
import { IS_LOCAL_HOST } from "@/env";
import * as dateUtils from "@/app/utils/dates";
import { MonthPicker } from "@/app/dashboard/MonthPicker";
import { TransactionDateEditor } from "@/app/dashboard/SpendingTable";
import { getFilterConditions } from "@/app/utils/transactions_querys";
import { CreateAllocationForm } from "@/app/dashboard/CreateAllocationForm";
import { RemoveTagButton } from "@/app/dashboard/RemoveTagButton";
import clsx from "clsx";
import { Label } from "@/app/components/Label";
import { QueryParamFilterLink } from "@/app/dashboard/QueryParamFilterLink";
import { AllocationEditContext } from "@/app/dashboard/AllocationEditContext";
import { AllocationEditButton } from "@/app/dashboard/AllocationEditButton";
import { AllocationDeleteButton } from "@/app/dashboard/AllocationDeleteButton";

// TODO
// break down transactions table into accounts (tabs probably make the most sense here)
// migrate savings page away from old spending query

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

  const [tsMerged, spending, netSpendForMonth] = await Promise.all([
    getTransactionsWithTags({ tag: filterByTag, monthUTC }),
    spendingForMonth({
      monthUTC,
      //TODO: make these configurable, save view
      excludeTags: ["income", "transfer"],
    }),
    getNetSpendingByMonth({ monthUTC }),
  ]);

  const netSpendForSelectedMonth = netSpendForMonth?.at(0);

  return (
    <div className="px-2 flex flex-col sm:grid grid-cols-2 grid-rows-[auto_1fr] gap-5 max-h-full overflow-hidden max-w-[1400px] mx-auto">
      <div className="flex gap-2 w-full col-span-2 flex-wrap ml-10">
        <MonthPicker monthUTC={monthUTC} />
        <div className="flex p-1 gap-5">
          <Label text={"Income"}>
            ${netSpendForSelectedMonth?.total_income}
          </Label>
          <Label text={"Spending"}>
            ${netSpendForSelectedMonth?.total_spending}
          </Label>
          <Label
            className={`flex flex-col text-lg ${
              Number(netSpendForSelectedMonth?.net_amount) < 0
                ? "text-red-700"
                : "text-green-700"
            }`}
            text={"Net"}
          >
            <span
              className={`p-3 ${
                Number(netSpendForSelectedMonth?.net_amount) > 0
                  ? "bg-green-200"
                  : "bg-red-200"
              }`}
            >
              ${netSpendForSelectedMonth?.net_amount}
            </span>
          </Label>
        </div>
      </div>
      <FeatureBox
        className={clsx(" col-span-2 ", {
          hidden: tsMerged.filter((t) => t.tags.length === 0).length === 0,
        })}
      >
        <SpendingCategorizer
          transactionsWithoutTag={tsMerged.filter((t) => t.tags.length === 0)}
        />
        <button className="border" onClick={tryAutoTagTransactions}>
          Autotag transactions
        </button>
        {IS_LOCAL_HOST && (
          <button onClick={tagAllAsFirstTag}>tag all as first tag</button>
        )}
      </FeatureBox>

      <div className="flex flex-col gap-5">
        <FeatureBox className="col-start-2 row-start-2 row-span-2">
          <SpendingTargets monthUTC={monthUTC} />
        </FeatureBox>
        <FeatureBox className="hidden sm:flex">
          {/**@ts-expect-error css modules are a pain with ts */}
          <div className={style.chart}>
            <SpendingChart discretionaryByMonth={spending ?? []} />
          </div>
        </FeatureBox>
      </div>
      <div className="flex flex-col max-h-full overflow-hidden gap-5">
        <FeatureBox className="overflow-auto  sm:max-h-screen flex flex-col">
          <TransactionFilters />
          {tsMerged.map((t) => (
            <div
              key={t.transaction_id}
              className="p-3 border-b hover:bg-gray-100 flex flex-col"
            >
              <div className="flex justify-between">
                <span>{t.name}</span>
                <div className="flex flex-col items-end">
                  <span>${Number(t.amount).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.tags.map((tag) => (
                  <RemoveTagButton key={tag.tag} transaction={t} tag={tag}>
                    {tag.tag}
                  </RemoveTagButton>
                ))}
                <div className="ml-auto">
                  <TransactionDateEditor
                    date={new Date(t.date)}
                    transaction={t}
                  />
                </div>
              </div>
            </div>
          ))}
        </FeatureBox>
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
        <QueryParamFilterLink value={t.tag} label="tag" key={t.tag}>
          {t.tag}
        </QueryParamFilterLink>
      ))}
      <QueryParamFilterLink value="" label="tag">
        All
      </QueryParamFilterLink>
    </div>
  );
}

async function SpendingTargets({ monthUTC }: { monthUTC: dateUtils.YyyyMm }) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }
  const monthFilters = getFilterConditions({
    monthUTC,
  });
  if (monthFilters.length === 0) {
    monthFilters.push(
      gte(transactions.date, sql`date_trunc('month', CURRENT_DATE)`)
    );
    monthFilters.push(
      lt(
        transactions.date,
        sql`date_trunc('month', CURRENT_DATE + INTERVAL '1 month')`
      )
    );
  }
  const taggedSpendingByPeriod = await db
    .select({
      month: sql<string>`DATE_TRUNC('month', ${transactions.date}) as month`,
      amount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
      tag: tags_new.tag,
      tagId: tags_new.id,
      label: tags_new.label,
      tag_id: tags_new.id,
      color: tags_new.color,
      allocation: tagAllocationsNew.allocation,
    })
    .from(transactions)
    .innerJoin(
      tagsLinkNew,
      eq(transactions.transaction_id, tagsLinkNew.transaction_id)
    )
    .innerJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
    .leftJoin(tagAllocationsNew, eq(tagAllocationsNew.tag_id, tags_new.id))
    .where(
      and(
        eq(transactions.user_id, user.user.id),
        notInArray(tags_new.tag, ["income", "transfer"]),
        ...monthFilters
      )
    )
    .groupBy(
      sql`DATE_TRUNC('month', ${transactions.date}), tags_v2.id, ${tagAllocationsNew.allocation}`
    )
    .orderBy(
      sql`DATE_TRUNC('month', ${transactions.date}), tags_v2.label, tags_v2.id`
    );

  console.log({ taggedSpendingByPeriod });

  const estimatedIncomeAndExpenses = await spendingForMonth({
    monthUTC: `${new Date().getUTCFullYear()}-${String(
      new Date().getUTCMonth()
    ).padStart(2, "0")}-01`,
  });

  if (!estimatedIncomeAndExpenses) {
    return null;
  }

  if (estimatedIncomeAndExpenses?.length === 0) {
    return null;
  }

  const { income } = R.groupBy(estimatedIncomeAndExpenses, (r) => r.tag);
  const estIncome = parseInt(income?.[0].amount ?? "0", 10) * -1;
  const toTrack = taggedSpendingByPeriod.filter((t) => t.allocation !== null);

  const allUserTags = await db.query.tags_new.findMany({
    where: eq(tags_new.userId, user.user.id),
  });

  return (
    <div className="flex flex-col gap-5 w-full">
      <AllocationEditContext>
        <div className="flex gap-5 flex-wrap">
          {toTrack.map((tagSpending) => {
            if (!tagSpending) {
              return (
                <div key={tagSpending}>No allocation for {tagSpending}</div>
              );
            }
            const allocation = parseInt(tagSpending?.allocation ?? "0", 10);
            const targetSpending = (allocation / 100) * estIncome;
            return (
              <div key={tagSpending.tagId} className="w-full flex">
                <div className="flex-col gap-3 w-full">
                  <div className="flex gap-2 justify-between text-xs">
                    <div>{tagSpending.label}</div>
                    <div>
                      ${tagSpending.amount} / ${Math.round(targetSpending)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="w-full h-6 overflow-hidden border rounded">
                      <div
                        className={`bg-blue-500 relative h-full`}
                        style={{
                          width: `${
                            (Number(tagSpending.amount) / targetSpending) * 100
                          }%`,
                          background: tagSpending.color,
                        }}
                      ></div>
                    </div>
                    <div className="flex gap-3 text-sm">
                      At <span>{isNaN(allocation) ? 0 : allocation}%</span>{" "}
                      percent of income, you have
                      <span className="font-bold">
                        {isNaN(Number(tagSpending.amount)) ? (
                          <span className="text-right">
                            ${targetSpending.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-right">
                            $
                            {Math.round(
                              targetSpending - Number(tagSpending.amount)
                            )}
                          </span>
                        )}
                      </span>
                      left to spend
                    </div>
                  </div>
                </div>
                <AllocationDeleteButton tagId={tagSpending.tagId} />
              </div>
            );
          })}
          <CreateAllocationForm tags={allUserTags} />

          <div className="ml-auto">
            <AllocationEditButton />
          </div>
        </div>
      </AllocationEditContext>
    </div>
  );
}

function FeatureBox({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-3 shadow-md rounded bg-white ${className}`}>
      {children}
    </div>
  );
}
