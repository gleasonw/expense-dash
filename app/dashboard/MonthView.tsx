import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { db } from "@/server/db";
import { tags_new, tagsLinkNew, transactions } from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { and, eq, sql } from "drizzle-orm";
import * as R from "remeda";
import {
  tryAutoTagTransactions,
  tagAllAsFirstTag,
} from "@/app/dashboard/transactions_sdk";
import { monthSpending, SpendingRow } from "@/app/dashboard/aggregates";
import { IS_LOCAL_HOST } from "@/env";
import * as dateUtils from "@/app/utils/dates";
import { MonthPicker } from "@/app/dashboard/MonthPicker";
import { TransactionDateEditor } from "@/app/dashboard/SpendingTable";
import { CreateAllocationForm } from "@/app/dashboard/CreateAllocationForm";
import { AddTagInput, RemoveTagButton } from "@/app/dashboard/RemoveTagButton";
import clsx from "clsx";
import { FilterByTagDropdown } from "@/app/dashboard/FilterByTagDropdown";
import { AllocationEditContext } from "@/app/dashboard/AllocationEditContext";
import { AllocationEditButton } from "@/app/dashboard/AllocationEditButton";
import { AllocationDeleteButton } from "@/app/dashboard/AllocationDeleteButton";
import { lowestTagForString, tagsByParent } from "@/app/dashboard/tag_utils";
import { getFilterConditions } from "@/app/utils/transactions_querys";
import { Tag, TransactionWithTags } from "@/server/schema";
import { allUserTags } from "@/app/dashboard/tags_sdk";

export async function MonthView({
  monthUTC,
  filterByTag,
  tsMerged,
  allTags,
  netSpendForSelectedMonth,
}: {
  monthUTC: dateUtils.YyyyMm;
  filterByTag?: string;
  tsMerged: TransactionWithTags[];
  allTags: Tag[];
  netSpendForSelectedMonth?: {
    month: string;
    total_income: string;
    total_spending: string;
    net_amount: string;
  };
  spendingLast5Months: SpendingRow[];
  testAllNetSpend: Array<{
    month: string;
    total_income: string;
    total_spending: string;
    net_amount: string;
  }>;
}) {
  return (
    <div className="px-2 flex flex-col justify-center w-full items-center max-w-[1000px] gap-5">
      <div className="flex flex-col lg:flex-row gap-4 w-full items-stretch">
        <FeatureBox className="flex items-center justify-center">
          <MonthPicker monthUTC={monthUTC} />
        </FeatureBox>

        <div className="grid grid-cols-3 gap-4 flex-1">
          {/* Income Card */}
          <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col">
            <span className="text-sm font-medium text-gray-500 mb-1">
              Income
            </span>
            <span className="text-2xl font-bold text-gray-900">
              ${netSpendForSelectedMonth?.total_income}
            </span>
          </div>

          {/* Spending Card */}
          <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col">
            <span className="text-sm font-medium text-gray-500 mb-1">
              Spending
            </span>
            <span className="text-2xl font-bold text-gray-900">
              ${netSpendForSelectedMonth?.total_spending}
            </span>
          </div>

          {/* Net Card */}
          <div
            className={`rounded-lg shadow-sm p-4 flex flex-col ${
              Number(netSpendForSelectedMonth?.net_amount) < 0
                ? "bg-red-50 border border-red-200"
                : "bg-green-50 border border-green-200"
            }`}
          >
            <span className="text-sm font-medium text-gray-600 mb-1">Net</span>
            <span
              className={`text-2xl font-bold ${
                Number(netSpendForSelectedMonth?.net_amount) < 0
                  ? "text-red-700"
                  : "text-green-700"
              }`}
            >
              ${netSpendForSelectedMonth?.net_amount}
            </span>
          </div>
        </div>
      </div>
      <FeatureBox
        className={clsx("w-full col-span-2 ", {
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

      <FeatureBox className="col-start-2 row-start-2 row-span-2 w-full">
        <SpendingTargets monthUTC={monthUTC} />
      </FeatureBox>
      <FeatureBox className="flex flex-col w-full">
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
                .sort((a: Tag, b: Tag) => a.tag.localeCompare(b.tag))
                .map((tag: Tag) => (
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

  // Sort so tags with allocations come first, then tags without allocations
  const sortedHierarchy = hierarchyForm.sort((a, b) => {
    const aHasAllocation = a.parent.tagAllocation !== null;
    const bHasAllocation = b.parent.tagAllocation !== null;

    if (aHasAllocation && !bHasAllocation) return -1;
    if (!aHasAllocation && bHasAllocation) return 1;
    return 0;
  });

  const tags = await allUserTags();
  return (
    <div className="flex flex-col gap-5 w-full">
      <AllocationEditContext>
        <div className="flex justify-between items-center">
          <CreateAllocationForm tags={tags} />
          <AllocationEditButton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {sortedHierarchy.map((tagSpending) => {
            if (!tagSpending) {
              return (
                <div key={tagSpending}>No allocation for {tagSpending}</div>
              );
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
        </div>
      </AllocationEditContext>
    </div>
  );
}

function TagChild({ children }: { children: React.ReactNode }) {
  return <div className="opacity-50 odd:bg-gray-100 py-1">{children}</div>;
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
        <div className={`flex gap-2 w-full justify-between`}>
          <span>{lowestTagForString(tagSpending.tag)}</span>
          <span>${tagSpending.amount}</span>
        </div>
        <div className="flex flex-col">
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
  const netAmount = targetSpending - Number(tagSpending.amount);

  return (
    <div className="flex flex-col gap-4 border border-gray-200 rounded-lg p-4 bg-white shadow-md">
      <div key={tagSpending.tag_id} className="w-full flex gap-3">
        <div className="flex-col gap-3 w-full flex">
          {/* Tag name */}
          <div className="text-lg font-semibold">{tagSpending.tag}</div>

          {/* Progress bar */}
          <div className="w-full h-4 overflow-hidden border rounded bg-gray-100">
            <div
              className={`relative h-full bg-${tagSpending.color}-400`}
              style={{
                width: `${Math.min(
                  (Number(tagSpending.amount) / targetSpending) * 100,
                  100
                )}%`,
              }}
            ></div>
          </div>

          {/* Budgeted / Spent / Net metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">
                Budgeted
              </span>
              <span className="text-lg text-gray-900">
                ${Math.round(targetSpending)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">Spent</span>
              <span className="text-lg text-gray-900">
                ${Math.abs(Number(tagSpending.amount))}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">
                Remaining
              </span>
              <span
                className={`text-lg font-bold ${
                  netAmount >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ${Math.round(Math.abs(netAmount))}
              </span>
            </div>
          </div>
        </div>
        {tagSpending.tag_id && (
          <AllocationDeleteButton tagId={tagSpending.tag_id} />
        )}
      </div>
      <div className="flex flex-col ">
        {tagSpending.depth === 1 ? (
          <RootSpendingForTag spending={tagSpending} monthUTC={monthUTC} />
        ) : null}

        {/* Breakdown section */}
        {children}
      </div>
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
      <div className="flex gap-2 w-full justify-between">
        <span>unbound</span>
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
    <div className={`p-3 shadow-sm rounded bg-white ${className}`}>
      {children}
    </div>
  );
}
