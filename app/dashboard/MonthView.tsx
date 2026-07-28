import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { db } from "@/server/db";
import {
  tagAllocationsNew,
  tags_new,
  tagsLinkNew,
  transactions,
} from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { and, eq, sql } from "drizzle-orm";
import * as R from "remeda";
import { tagAllAsFirstTag } from "@/app/dashboard/transactions_sdk";
import { monthSpending, SpendingRow } from "@/app/dashboard/aggregates";
import { IS_LOCAL_HOST } from "@/env";
import * as dateUtils from "@/app/utils/dates";
import { TransactionDateEditor } from "@/app/dashboard/SpendingTable";
import { CreateAllocationForm } from "@/app/dashboard/CreateAllocationForm";
import { AddTagInput, RemoveTagButton } from "@/app/dashboard/RemoveTagButton";
import clsx from "clsx";
import { FilterByTagDropdown } from "@/app/dashboard/FilterByTagDropdown";
import { TransactionAmountSortDropdown } from "@/app/dashboard/TransactionAmountSortDropdown";
import { AllocationEditContext } from "@/app/dashboard/AllocationEditContext";
import { AllocationEditButton } from "@/app/dashboard/AllocationEditButton";
import { AllocationEditControls } from "@/app/dashboard/AllocationEditControls";
import { lowestTagForString, tagsByParent } from "@/app/dashboard/tag_utils";
import { getFilterConditions } from "@/app/utils/transactions_querys";
import { Tag, TransactionWithTags } from "@/server/schema";
import { allUserTags } from "@/app/dashboard/tags_sdk";
import { TransactionWithAutoTagMatchCount } from "@/app/dashboard/transactions_sdk";
import { PiggyBank, Sparkles } from "lucide-react";
import { FundedByBucketSelect } from "@/app/dashboard/FundedByBucketSelect";
import { SavingsReimbursementSelect } from "@/app/dashboard/SavingsReimbursementSelect";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type BucketFundingOption = {
  id: number;
  name: string;
  color: string | null;
  currentBalance: number;
};

type FundedTransaction = TransactionWithTags &
  TransactionWithAutoTagMatchCount & {
    fundedByBucket?: {
      movementId: number;
      bucketId: number;
      bucketName: string;
      bucketColor: string | null;
      amount: string;
    };
    isSavingsReimbursement: boolean;
  };

function formatMoney(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatTransactionAmount(amount: number) {
  const formatted = formatMoney(Math.abs(amount));
  if (amount < 0) {
    return `+${formatted}`;
  }
  return formatted;
}

function tagIsInSubtree(tag: string, root: string) {
  return tag === root || tag.startsWith(`${root}/`);
}

export async function MonthView({
  monthUTC,
  filterByTag,
  amountSort,
  tsMerged,
  allTags,
  buckets,
  netSpendForSelectedMonth,
  savingsFundingStatus,
}: {
  monthUTC: dateUtils.YyyyMm;
  filterByTag?: string;
  amountSort?: "asc" | "desc";
  tsMerged: FundedTransaction[];
  allTags: Tag[];
  buckets: BucketFundingOption[];
  savingsFundingStatus: {
    bucketFundedAmount: number;
    reimbursedAmount: number;
    fundingNeeded: number;
    excessReimbursement: number;
  };
  netSpendForSelectedMonth?: {
    month: string;
    total_income: string;
    total_spending: string;
    bucket_funded_spending: string;
    savings_reimbursements: string;
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
  const incomeAmount = Number(netSpendForSelectedMonth?.total_income ?? 0);
  const spendingAmount = Math.abs(
    Number(netSpendForSelectedMonth?.total_spending ?? 0),
  );
  const fromSavingsAmount = Number(
    netSpendForSelectedMonth?.savings_reimbursements ?? 0,
  );
  const netAmount = Number(netSpendForSelectedMonth?.net_amount ?? 0);
  const savingsFundingNeeded = savingsFundingStatus.fundingNeeded;
  const netTextClass = netAmount >= 0 ? "text-green-700" : "text-red-700";

  return (
    <div className="px-2 flex flex-col lg:flex-row justify-center w-full items-center max-w-[1000px] lg:max-w-[2000px] lg:items-start lg:justify-start gap-5">
      <div className="flex w-full flex-col gap-5">
        <div className="flex flex-col lg:flex-row gap-4 w-full items-stretch">
          <div className="flex flex-wrap gap-4 flex-1">
            <div className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 w-full">
              <span className="text-sm font-medium text-gray-500">Income</span>
              <span className="text-2xl font-bold text-green-900 text-right tabular-nums">
                +{formatMoney(incomeAmount)}
              </span>
              <span className="text-sm font-medium text-gray-500">
                From savings
              </span>
              <span className="text-2xl font-bold text-blue-800 text-right tabular-nums">
                +{formatMoney(fromSavingsAmount)}
              </span>
              <span className="text-sm font-medium text-gray-500">
                Spending
              </span>
              <span className="text-2xl font-bold text-gray-900 text-right tabular-nums">
                −{formatMoney(spendingAmount)}
              </span>
              <span className="col-span-2 w-full h-1 bg-gray-200"></span>
              <span className="text-sm font-semibold text-gray-700">
                Monthly balance
              </span>
              <span
                className={`text-2xl font-bold ${netTextClass} text-right tabular-nums`}
              >
                {formatMoney(netAmount)}
              </span>
            </div>

            <div
              className={clsx(
                "rounded-lg border p-4 shadow-sm flex flex-col",
                savingsFundingNeeded > 0
                  ? "border-amber-200 bg-amber-50"
                  : "border-blue-200 bg-blue-50",
              )}
            >
              <span className="text-sm font-medium text-gray-600 mb-1">
                Outstanding savings transfer
              </span>
              <span
                className={clsx(
                  "text-2xl font-bold",
                  savingsFundingNeeded > 0 ? "text-amber-700" : "text-blue-700",
                )}
              >
                {formatMoney(savingsFundingNeeded)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-5 w-full">
          <FeatureBox
            className={clsx("w-full col-span-2 ", {
              hidden: tsMerged.filter((t) => t.tags.length === 0).length === 0,
            })}
          >
            <SpendingCategorizer
              transactionsWithoutTag={tsMerged.filter(
                (t) => t.tags.length === 0,
              )}
            />
            {IS_LOCAL_HOST && (
              <button onClick={tagAllAsFirstTag}>tag all as first tag</button>
            )}
          </FeatureBox>

          <FeatureBox className="col-start-2 row-start-2 row-span-2 w-full">
            <SpendingTargets monthUTC={monthUTC} />
          </FeatureBox>
        </div>
      </div>

      <FeatureBox className="flex flex-col w-full">
        <TransactionFilters selectedTag={filterByTag} amountSort={amountSort} />
        {tsMerged.map((t) => {
          const amount = Number(t.amount);
          const isTransfer = t.tags.some((tag) =>
            tagIsInSubtree(tag.tag, "transfer"),
          );
          const isCredit = amount < 0;

          return (
            <div
              key={t.transaction_id}
              className="flex flex-col border-b border-gray-100 px-3 py-2.5 transition-colors hover:bg-gray-50"
            >
              <div className="flex min-w-0 items-center justify-between gap-4">
                <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                  {t.name}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <TransactionDateEditor
                    date={new Date(t.date)}
                    transaction={t}
                    compact
                  />
                  <span
                    className={clsx(
                      "min-w-[88px] text-right text-sm font-semibold",
                      {
                        "text-gray-400": isTransfer,
                        "text-emerald-700": isCredit && !isTransfer,
                        "text-gray-900": !isCredit && !isTransfer,
                      },
                    )}
                  >
                    {formatTransactionAmount(amount)}
                  </span>
                </div>
              </div>

              <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1.5 text-gray-500">
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.tags
                    .slice()
                    .sort((a: Tag, b: Tag) => a.tag.localeCompare(b.tag))
                    .map((tag: Tag) => (
                      <RemoveTagButton key={tag.tag} transaction={t} tag={tag}>
                        {tag.tag}
                      </RemoveTagButton>
                    ))}
                  {t.autoTagMatchCount > 0 && (
                    <span
                      className="inline-flex items-center text-gray-300"
                      title={`Auto-tag rules matched: ${t.autoTagMatchCount}`}
                      aria-label={`Auto-tag rules matched: ${t.autoTagMatchCount}`}
                    >
                      <Sparkles className="h-4 w-4" />
                    </span>
                  )}
                  <AddTagInput
                    tags={allTags}
                    transaction={t}
                    label={t.tags.length === 0 ? "Add category" : "+"}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isTransfer && amount > 0 && buckets.length > 0 && (
                    <Popover>
                      <PopoverTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-300"
                        >
                          <PiggyBank />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="bg-white">
                        <FundedByBucketSelect
                          transactionId={t.transaction_id}
                          buckets={buckets}
                          selectedBucketId={t.fundedByBucket?.bucketId}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  {!isTransfer && isCredit && (
                    <SavingsReimbursementSelect
                      transactionId={t.transaction_id}
                      isReimbursement={t.isSavingsReimbursement}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </FeatureBox>
    </div>
  );
}

async function TransactionFilters({
  selectedTag,
  amountSort,
}: {
  selectedTag?: string;
  amountSort?: "asc" | "desc";
}) {
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
      <TransactionAmountSortDropdown selectedValue={amountSort} />
    </div>
  );
}

async function SpendingTargets({ monthUTC }: { monthUTC: dateUtils.YyyyMm }) {
  const user = await getUserWithTokenThrows();
  const allocations = await db.query.tagAllocationsNew.findMany({
    where: eq(tagAllocationsNew.user_id, user.user.id),
    with: {
      tag: true,
    },
  });
  const taggedSpendingByPeriod = await monthSpending({
    monthUTC,
    excludeTags: ["income", "transfer"],
  });

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
  const totalAllocatedPercent = allocations.reduce((total, allocation) => {
    if (allocation.allocationType !== "percent") {
      return total;
    }

    return total + parseFloat(allocation.allocation);
  }, 0);
  const remainingPercent = 100 - totalAllocatedPercent;
  const spendingForTag = R.indexBy(
    taggedSpendingByPeriod,
    (s) => s.tag_id ?? "unallocated",
  );
  const allocationsWithNoSpending = allocations.filter(
    (a) => !spendingForTag[a.tag_id ?? "unallocated"],
  );

  return (
    <div className="flex flex-col gap-5 w-full">
      <AllocationEditContext>
        <div className="flex justify-between items-center">
          <CreateAllocationForm
            tags={tags}
            remainingPercent={remainingPercent}
          />
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
                  <TagAllocation
                    key={childTagSpending.tag_id}
                    monthUTC={monthUTC}
                    tagSpending={childTagSpending}
                  />
                ))}
              </TagAllocation>
            );
          })}
          {allocationsWithNoSpending.map((allocation) => (
            <TagAllocation
              monthUTC={monthUTC}
              key={allocation.tag_id}
              tagSpending={{
                month: monthUTC,
                amount: "0",
                color: allocation.tag.color,
                depth: 0,
                tag: allocation.tag.tag,
                tagAllocation: allocation.allocation,
                tagAllocationType: allocation.allocationType,
                tag_id: allocation.tag_id,
              }}
            />
          ))}
        </div>
      </AllocationEditContext>
    </div>
  );
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
      new Date().getUTCMonth(),
    ).padStart(2, "0")}-01`,
  });

  if (!estimatedIncomeAndExpenses) {
    return <div>no income</div>;
  }

  if (estimatedIncomeAndExpenses?.length === 0) {
    return (
      <div>
        <div>no income for previous month</div>
        <div>{tagSpending.tag}</div>
        <div>{tagSpending.amount}</div>
      </div>
    );
  }

  const isRootAllocation = tagSpending.depth === 1;

  if (!tagSpending.tagAllocation) {
    return (
      <div className="">
        <div
          className={clsx("flex w-full justify-between gap-2", {
            "text-base": isRootAllocation,
            "text-sm ": !isRootAllocation,
          })}
        >
          <span>{lowestTagForString(tagSpending.tag)}</span>
          <CurrencyAmount amount={tagSpending.amount} />
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
  const allocation = parseFloat(tagSpending?.tagAllocation ?? "0");
  const allocationType = tagSpending.tagAllocationType ?? "percent";
  const targetSpending =
    allocationType === "fixed" ? allocation : (allocation / 100) * estIncome;
  const netAmount = targetSpending - Number(tagSpending.amount);
  const progressPercent =
    targetSpending > 0
      ? Math.min((Number(tagSpending.amount) / targetSpending) * 100, 100)
      : 0;

  if (!isRootAllocation) {
    return (
      <SubcategoryAllocationView
        tagSpending={tagSpending}
        targetSpending={targetSpending}
        netAmount={netAmount}
      >
        {children}
      </SubcategoryAllocationView>
    );
  }

  return (
    <div
      className={clsx("flex flex-col gap-4 rounded-lg bg-white", {
        "border border-gray-200 shadow-md p-4": isRootAllocation,
      })}
    >
      <div key={tagSpending.tag_id} className="w-full flex gap-3">
        <div className="flex-col gap-3 w-full flex">
          <div className="flex items-center justify-between gap-2">
            <div
              className={clsx({
                "text-lg font-semibold": isRootAllocation,
                "text-base font-medium text-gray-700": !isRootAllocation,
              })}
            >
              {tagSpending.tag}
            </div>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {allocationType === "fixed"
                ? `$${Math.round(allocation)} fixed`
                : `${allocation.toFixed(2)}% allocation`}
            </span>
          </div>

          <div
            className={clsx(
              "w-full overflow-hidden border rounded bg-gray-100",
              {
                "h-4": isRootAllocation,
                "h-2": !isRootAllocation,
              },
            )}
          >
            <div
              className={`relative h-full bg-${tagSpending.color}-400`}
              style={{
                width: `${progressPercent}%`,
              }}
            ></div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">
                Budgeted
              </span>
              <span
                className={clsx("text-gray-900", {
                  "text-lg": isRootAllocation,
                  "text-base": !isRootAllocation,
                })}
              >
                ${Math.round(targetSpending)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">Spent</span>
              <span
                className={clsx("text-gray-900", {
                  "text-lg": isRootAllocation,
                  "text-base": !isRootAllocation,
                })}
              >
                ${Math.abs(Number(tagSpending.amount))}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">
                Remaining
              </span>
              <span
                className={clsx("font-bold", {
                  "text-lg": isRootAllocation,
                  "text-base": !isRootAllocation,
                  "text-green-600": netAmount >= 0,
                  "text-red-600": netAmount < 0,
                })}
              >
                ${Math.round(Math.abs(netAmount))}
              </span>
            </div>
          </div>
        </div>
        {tagSpending.tag_id && tagSpending.tagAllocation && (
          <AllocationEditControls
            tagId={tagSpending.tag_id}
            initialAllocation={tagSpending.tagAllocation}
            initialAllocationType={tagSpending.tagAllocationType ?? "percent"}
          />
        )}
      </div>
      <div className="pl-10 flex flex-col gap-2">
        {children}
        {tagSpending.depth === 1 ? (
          <RootSpendingForTag spending={tagSpending} monthUTC={monthUTC} />
        ) : null}
      </div>
    </div>
  );
}

function SubcategoryAllocationView({
  tagSpending,
  children,
  targetSpending,
  netAmount,
}: {
  tagSpending: SpendingRow;
  children?: React.ReactNode;
  targetSpending: number;
  netAmount: number;
}) {
  const displayTag = lowestTagForString(tagSpending.tag);
  const remainingAmount = Math.round(Math.abs(netAmount));
  const remainingLabel = netAmount >= 0 ? "remaining" : "over";

  return (
    <div className="border-t border-gray-100  text-sm">
      <div className="flex w-full justify-between gap-3">
        <span className="min-w-0 truncate">{displayTag}</span>
        <CurrencyAmount amount={Math.abs(Number(tagSpending.amount))} />
      </div>
      <div className="mt-0.5 min-w-0 truncate text-xs text-gray-500">
        <span>${Math.round(targetSpending)} budgeted</span>
        <span className="mx-1.5 text-gray-300">/</span>
        <span
          className={clsx({
            "text-green-600": netAmount >= 0,
            "text-red-600": netAmount < 0,
          })}
        >
          ${remainingAmount} {remainingLabel}
        </span>
      </div>
      {tagSpending.tag_id && tagSpending.tagAllocation && (
        <div className="mt-2 flex justify-end">
          <AllocationEditControls
            tagId={tagSpending.tag_id}
            initialAllocation={tagSpending.tagAllocation}
            initialAllocationType={tagSpending.tagAllocationType ?? "percent"}
          />
        </div>
      )}
      <div className="flex flex-col">{children}</div>
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
      eq(transactions.transaction_id, tagsLinkNew.transaction_id),
    )
    .innerJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
    .where(
      and(
        eq(transactions.user_id, user.user.id),
        eq(tags_new.id, spending.tag_id),
        ...filterConditions,
      ),
    )
    .groupBy(sql`DATE_TRUNC('month', ${transactions.date}), ${tags_new.tag}`);
  const baseSpend = baseSpendResults?.at(0);

  if (!baseSpend) {
    return null;
  }
  return (
    <div className="border-t border-gray-100 text-sm ">
      <div className="flex w-full justify-between gap-2">
        <span>unbound</span>
        <CurrencyAmount amount={baseSpend.amount} />
      </div>
    </div>
  );
}

function CurrencyAmount({ amount }: { amount: string | number }) {
  return (
    <span className="inline-block min-w-[8ch] shrink-0 text-right tabular-nums">
      ${amount}
    </span>
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
