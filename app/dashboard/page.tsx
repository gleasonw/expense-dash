import { addTransactions } from "@/app/dashboard/actions";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import { userTable } from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { eq } from "drizzle-orm";
import {
  autoTagTransactions,
  getTransactionsWithTags,
} from "@/app/dashboard/transactions_sdk";
import { toAppTransaction } from "@/app/dashboard/transaction_utils";
import {
  getNetSpendingByMonth,
  monthSpending,
} from "@/app/dashboard/aggregates";
import * as dateUtils from "@/app/utils/dates";
import { allUserTags } from "@/app/dashboard/tags_sdk";
import { ViewToggle } from "@/app/dashboard/ViewToggle";
import { MonthView } from "@/app/dashboard/MonthView";
import { AggregateView } from "@/app/dashboard/AggregateView";

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
  const view = (params.view as string) ?? "month";
  const filterByTag = params.tag as string | undefined;

  // Sync Plaid transactions
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

    const [spendingData, netSpendingData] = await Promise.all([
      monthSpending({
        forPastXMonths: monthsDiff,
        excludeTags: ["income", "transfer"],
        includeTag: filterByTag,
        atDepth: 1,
      }),
      getNetSpendingByMonth({
        pastXMonths: monthsDiff,
        includeTag: filterByTag,
      }),
    ]);

    return (
      <div className="flex flex-col gap-4 p-4 items-center">
        <ViewToggle defaultView="month" />
        <AggregateView
          spendingData={spendingData}
          netSpendingData={netSpendingData}
          allTags={allTags}
          selectedTag={filterByTag}
        />
      </div>
    );
  }

  // Month view: fetch single month data
  const mParam = params.monthUTC;
  const mParamString = typeof mParam === "string" ? mParam : undefined;
  const monthUTC = dateUtils.normYyyyMm(mParamString);
  console.log({ monthUTC });

  const [tsMerged, netSpendForMonth, spendingLast5Months, testAllNetSpend] =
    await Promise.all([
      getTransactionsWithTags({ tag: filterByTag, monthUTC }),
      getNetSpendingByMonth({ monthUTC }),
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
    <div className="flex flex-col gap-4 p-4 items-center">
      <ViewToggle defaultView="month" />
      <MonthView
        monthUTC={monthUTC}
        filterByTag={filterByTag}
        tsMerged={tsMerged}
        allTags={allTags}
        netSpendForSelectedMonth={netSpendForSelectedMonth}
        spendingLast5Months={spendingLast5Months ?? []}
        testAllNetSpend={testAllNetSpend ?? []}
      />
    </div>
  );
}
