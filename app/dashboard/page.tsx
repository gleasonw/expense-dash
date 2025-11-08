import { addTransactions } from "@/app/dashboard/actions";
import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import {
  userTable,
  tags_new,
  tagsLinkNew,
  transactions,
} from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { and, eq, sql } from "drizzle-orm";
import * as style from "@/app/dashboard/dashboard.module.css";
import * as R from "remeda";
import {
  autoTagTransactions,
  getTransactionsWithTags,
  tagAllAsFirstTag,
  tryAutoTagTransactions,
} from "@/app/dashboard/transactions_sdk";
import { toAppTransaction } from "@/app/dashboard/transaction_utils";
import {
  getNetSpendingByMonth,
  monthSpending,
  SpendingRow,
} from "@/app/dashboard/aggregates";
import { SpendingChart } from "@/app/dashboard/SpendingChart";
import { IS_LOCAL_HOST } from "@/env";
import * as dateUtils from "@/app/utils/dates";
import { MonthPicker } from "@/app/dashboard/MonthPicker";
import { TransactionDateEditor } from "@/app/dashboard/SpendingTable";
import { CreateAllocationForm } from "@/app/dashboard/CreateAllocationForm";
import { AddTagInput, RemoveTagButton } from "@/app/dashboard/RemoveTagButton";
import clsx from "clsx";
import { Label } from "@/app/components/Label";
import { FilterByTagDropdown } from "@/app/dashboard/FilterByTagDropdown";
import { AllocationEditContext } from "@/app/dashboard/AllocationEditContext";
import { AllocationEditButton } from "@/app/dashboard/AllocationEditButton";
import { AllocationDeleteButton } from "@/app/dashboard/AllocationDeleteButton";
import { allUserTags } from "@/app/dashboard/tags_sdk";
import { lowestTagForString, tagsByParent } from "@/app/dashboard/tag_utils";
import { getFilterConditions } from "@/app/utils/transactions_querys";
import { NetSpendChart } from "@/app/dashboard/NetSpendingChart";

// TODO
// break down transactions table into accounts (tabs probably make the most sense here)
// migrate savings page away from old spending query

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userWithAccount = await getUserWithTokenThrows();
  const params = await searchParams;
  const filterByTag = params.tag as string | undefined;
  // should be postgres-readable, eg. 2022-01-01
  const mParam = (await searchParams).monthUTC;
  const mParamString = typeof mParam === "string" ? mParam : undefined;
  const monthUTC = dateUtils.normYyyyMm(mParamString);
  console.log({ monthUTC });

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

  console.log(`beginning fetch`);
  const [
    tsMerged,
    netSpendForMonth,
    allTags,
    spendingLast5Months,
    testAllNetSpend,
  ] = await Promise.all([
    getTransactionsWithTags({ tag: filterByTag, monthUTC }),
    getNetSpendingByMonth({ monthUTC }),
    allUserTags(),
    monthSpending({
      forPastXMonths: 3,
      excludeTags: ["income", "transfer"],
      atDepth: 1,
    }),
    getNetSpendingByMonth({ pastXMonths: 3 }),
  ]);

  console.log({ testAllNetSpend });

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
            <SpendingChart discretionaryByMonth={spendingLast5Months ?? []} />
          </div>
        </FeatureBox>
        <FeatureBox className="hidden sm:flex">
          {/**@ts-expect-error css modules are a pain with ts */}
          <div className={style.chart}>
            <NetSpendChart rows={testAllNetSpend ?? []} title="net spend" />
          </div>
        </FeatureBox>
      </div>
      <div className="flex flex-col max-h-full overflow-hidden gap-5">
        <FeatureBox className="overflow-auto  sm:max-h-screen flex flex-col">
          <TransactionFilters selectedTag={filterByTag} />
          {tsMerged.map((t) => (
            <div
              key={t.transaction_id}
              className="p-3 border-b hover:bg-gray-100 flex gap-1 flex-col"
            >
              <div className="flex justify-between">
                <span className="text-sm">{t.name}</span>
                <div className="flex flex-col items-end text-lg">
                  <span>${Number(t.amount).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.tags
                  .slice()
                  .sort((a, b) => a.tag.localeCompare(b.tag))
                  .map((tag) => (
                    <RemoveTagButton key={tag.tag} transaction={t} tag={tag}>
                      {tag.tag}
                    </RemoveTagButton>
                  ))}
                <AddTagInput tags={allTags} transaction={t} />
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

async function TransactionFilters({ selectedTag }: { selectedTag?: string }) {
  const user = await getUserWithTokenThrows();
  const userTags = await db.query.tags_new.findMany({
    where: eq(tags_new.userId, user.user.id),
  });
  return (
    <div className="flex flex-wrap gap-2">
      <FilterByTagDropdown
        options={[
          { label: "All", value: "" },
          ...userTags
            .slice()
            .sort((a, b) => a.tag.localeCompare(b.tag))
            .map((tag) => ({ label: tag.tag, value: tag.tag })),
        ]}
        selectedValue={selectedTag ?? ""}
      />
    </div>
  );
}

async function SpendingTargets({ monthUTC }: { monthUTC: dateUtils.YyyyMm }) {
  const taggedSpendingByPeriod = await monthSpending({
    monthUTC,
    excludeTags: ["income", "transfer"],
  });

  console.log({ taggedSpendingByPeriod });
  const toTrack = taggedSpendingByPeriod;

  const hierarchyForm = tagsByParent(toTrack);

  const tags = await allUserTags();
  return (
    <div className="flex flex-col gap-5 w-full">
      <AllocationEditContext>
        {hierarchyForm.map((tagSpending) => {
          if (!tagSpending) {
            return <div key={tagSpending}>No allocation for {tagSpending}</div>;
          }
          return (
            <TagAllocation
              monthUTC={monthUTC}
              key={tagSpending.parent.tag}
              tagSpending={tagSpending.parent}
            >
              {tagSpending.children.map((childTagSpending) => (
                <TagChild key={childTagSpending.tag_id}>
                  <TagAllocation
                    monthUTC={monthUTC}
                    tagSpending={childTagSpending}
                  />
                </TagChild>
              ))}
            </TagAllocation>
          );
        })}
        <div className="flex justify-between">
          <CreateAllocationForm tags={tags} />

          <div className="ml-auto">
            <AllocationEditButton />
          </div>
        </div>
      </AllocationEditContext>
    </div>
  );
}

function TagChild({ children }: { children: React.ReactNode }) {
  return <div className="ml-10 mt-2">{children}</div>;
}

async function TagAllocation({
  tagSpending,
  children,
  monthUTC,
}: {
  tagSpending: SpendingRow;
  children?: React.ReactNode;
  monthUTC: dateUtils.YyyyMm;
}) {
  const estimatedIncomeAndExpenses = await monthSpending({
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

  if (!tagSpending.tagAllocation) {
    return (
      <div className="">
        <div
          className={`flex gap-2 w-full justify-between ${
            tagSpending.depth === 1 ? "" : "opacity-50"
          }`}
        >
          <span>{lowestTagForString(tagSpending.tag)}</span>
          <span>${tagSpending.amount}</span>
        </div>
        <div>
          {tagSpending.depth === 1 ? (
            <RootSpendingForTag spending={tagSpending} monthUTC={monthUTC} />
          ) : null}

          {children}
        </div>
      </div>
    );
  }

  const { income } = R.groupBy(estimatedIncomeAndExpenses, (r) => r.tag);
  const estIncome = parseInt(income?.[0].amount ?? "0", 10) * -1;
  const allocation = parseInt(tagSpending?.tagAllocation ?? "0", 10);
  const targetSpending = (allocation / 100) * estIncome;
  return (
    <div className="flex flex-col">
      <div key={tagSpending.tag_id} className="w-full flex">
        <div className="flex-col gap-2 w-full flex">
          <div className="flex gap-2 justify-between text-sm">
            <div>{tagSpending.tag}</div>
            <div>
              ${tagSpending.amount} / ${Math.round(targetSpending)}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-full h-3 overflow-hidden border rounded">
              <div
                className={`relative h-full bg-${tagSpending.color}-400`}
                style={{
                  width: `${
                    (Number(tagSpending.amount) / targetSpending) * 100
                  }%`,
                }}
              ></div>
            </div>
            <div className="flex w-full justify-between">
              <div className="text-sm text-gray-500">
                <span className="text-lg pr-2 text-black">
                  {isNaN(Number(tagSpending.amount)) ? (
                    <span className="text-right">
                      ${targetSpending.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-right">
                      ${Math.round(targetSpending - Number(tagSpending.amount))}
                    </span>
                  )}
                </span>
                left to spend
              </div>
              <span className="text-sm align-bottom text-gray-500 px-2">
                {isNaN(allocation) ? 0 : allocation}%
              </span>
            </div>
          </div>
        </div>
        {tagSpending.tag_id && (
          <AllocationDeleteButton tagId={tagSpending.tag_id} />
        )}
      </div>
      {tagSpending.depth === 1 ? (
        <RootSpendingForTag spending={tagSpending} monthUTC={monthUTC} />
      ) : null}
      {children}
    </div>
  );
}

/** spending that is not marked to a child tag like {parent}/{child}, just {parent} */
async function RootSpendingForTag({
  spending,
  monthUTC,
}: {
  spending: SpendingRow;
  monthUTC: dateUtils.YyyyMm;
}) {
  const user = await getUserWithTokenThrows();
  const filterConditions = getFilterConditions({ monthUTC });
  if (!spending.tag_id) {
    return null;
  }
  const baseSpendResults = await db
    .select({
      month: sql<string>`DATE_TRUNC('month', ${transactions.date}) as month`,
      amount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC)) as amount`,
      full_tag: sql<string>`${tags_new.tag} as full_tag`,
    })
    .from(transactions)
    .innerJoin(
      tagsLinkNew,
      eq(transactions.transaction_id, tagsLinkNew.transaction_id)
    )
    .innerJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
    .where(
      and(
        eq(transactions.user_id, user.user.id),
        eq(tags_new.id, spending.tag_id),
        ...filterConditions
      )
    )
    .groupBy(sql`DATE_TRUNC('month', ${transactions.date}), ${tags_new.tag}`);
  const baseSpend = baseSpendResults?.at(0);

  if (!baseSpend) {
    return null;
  }
  return (
    <TagChild>
      <div className="flex gap-2 w-full justify-between opacity-50">
        <span>{baseSpend.full_tag}</span>
        <span>${baseSpend.amount}</span>
      </div>
    </TagChild>
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
