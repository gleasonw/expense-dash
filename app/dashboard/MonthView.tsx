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
import { Label } from "@/app/components/Label";
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
      <FeatureBox className="flex gap-2 w-full">
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
      </FeatureBox>
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
    <div className={`p-3 shadow-sm rounded bg-white ${className}`}>
      {children}
    </div>
  );
}
