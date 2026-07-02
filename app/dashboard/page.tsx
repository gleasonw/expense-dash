import { getTransactionsWithTags } from "@/app/dashboard/transactions_sdk";
import {
  getNetSpendingByMonth,
  monthSpending,
} from "@/app/dashboard/aggregates";
import * as dateUtils from "@/app/utils/dates";
import { allUserTags } from "@/app/dashboard/tags_sdk";
import { ViewToggle } from "@/app/dashboard/ViewToggle";
import { MonthView } from "@/app/dashboard/MonthView";
import { AggregateView } from "@/app/dashboard/AggregateView";
import { getBuckets } from "@/app/dashboard/buckets_sdk";

// TODO
// break down transactions table into accounts (tabs probably make the most sense here)
// migrate savings page away from old spending query

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const view = (params.view as string) ?? "month";
  const filterByTag = params.tag as string | undefined;
  const amountSort = params.amountSort as string | undefined;
  const validatedAmountSort =
    amountSort === "asc" || amountSort === "desc" ? amountSort : undefined;

  // Fetch tags (needed for both views)
  const allTags = await allUserTags();

  console.log(`beginning fetch for ${view} view`);

  if (view === "aggregate") {
    // Aggregate view: fetch multi-month data
    const startMonthParam = params.startMonth as string | undefined;
    const endMonthParam = params.endMonth as string | undefined;

    // Default to 12 months back to current month
    const currentDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setUTCMonth(defaultStartDate.getUTCMonth() - 12);

    const startMonth = startMonthParam
      ? dateUtils.normYyyyMm(startMonthParam)
      : dateUtils.normYyyyMm(
          `${defaultStartDate.getUTCFullYear()}-${String(
            defaultStartDate.getUTCMonth() + 1
          ).padStart(2, "0")}`
        );

    const endMonth = endMonthParam
      ? dateUtils.normYyyyMm(endMonthParam)
      : dateUtils.normYyyyMm(
          `${currentDate.getUTCFullYear()}-${String(
            currentDate.getUTCMonth() + 1
          ).padStart(2, "0")}`
        );

    // Calculate number of months between start and end
    const startDate = new Date(startMonth);
    const endDate = new Date(endMonth);
    const monthsDiff =
      (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
      (endDate.getUTCMonth() - startDate.getUTCMonth());

    // Fetch subtag data when a tag filter is active for drill-down view
    const [spendingData, netSpendingData] = await Promise.all([
      monthSpending({
        forPastXMonths: monthsDiff,
        excludeTags: ["income", "transfer"],
        includeTag: filterByTag,
        atDepth: 1,
      }),
      getNetSpendingByMonth({
        pastXMonths: monthsDiff,
      }),
    ]);

    // If a tag is selected, also fetch its subtags at depth 2
    const subtagData = filterByTag
      ? await monthSpending({
          forPastXMonths: monthsDiff,
          excludeTags: ["income", "transfer"],
          includeTag: filterByTag,
          atDepth: 2,
        })
      : undefined;

    return (
      <div className="flex flex-col gap-4 p-4 items-center">
        <ViewToggle defaultView="month" />
        <AggregateView
          spendingData={spendingData}
          netSpendingData={netSpendingData}
          allTags={allTags}
          selectedTag={filterByTag}
          subtagData={subtagData}
        />
      </div>
    );
  }

  // Month view: fetch single month data
  const mParam = params.monthUTC;
  const mParamString = typeof mParam === "string" ? mParam : undefined;
  const monthUTC = dateUtils.normYyyyMm(mParamString);

  const [
    tsMerged,
    netSpendForMonth,
    spendingLast5Months,
    testAllNetSpend,
    buckets,
  ] =
    await Promise.all([
      getTransactionsWithTags({
        tag: filterByTag,
        monthUTC,
        amountSort: validatedAmountSort,
      }),
      getNetSpendingByMonth({ monthUTC }),
      monthSpending({
        forPastXMonths: 3,
        excludeTags: ["income", "transfer"],
        atDepth: 1,
      }),
      getNetSpendingByMonth({ pastXMonths: 3 }),
      getBuckets(),
    ]);

  console.log({ testAllNetSpend });

  const netSpendForSelectedMonth = netSpendForMonth?.at(0);

  return (
    <div className="flex flex-col gap-4 p-4 items-center">
      <ViewToggle defaultView="month" />
      <MonthView
        monthUTC={monthUTC}
        filterByTag={filterByTag}
        amountSort={validatedAmountSort}
        tsMerged={tsMerged}
        allTags={allTags}
        buckets={buckets.filter((bucket) => !bucket.isArchived)}
        netSpendForSelectedMonth={netSpendForSelectedMonth}
        spendingLast5Months={spendingLast5Months ?? []}
        testAllNetSpend={testAllNetSpend ?? []}
      />
    </div>
  );
}
