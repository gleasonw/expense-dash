import { addTransactions, setTagAllocation } from "@/app/dashboard/actions";
import { SpendingCategorizer } from "@/app/dashboard/SpendingCategorizer";
import { SpendingTable } from "@/app/dashboard/SpendingTable";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import { userTable, tags_new, Tag, TagAllocation } from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { eq } from "drizzle-orm";
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
import {
  getNetSpendingByMonth,
  spendingForMonth,
} from "@/app/dashboard/aggregates";
import { SpendingChart } from "@/app/dashboard/SpendingChart";
import { IS_LOCAL_HOST } from "@/env";
import * as dateUtils from "@/app/utils/dates";
import { MonthPicker } from "@/app/dashboard/MonthPicker";

// TODO
// make the color of tags fixed, maybe also add an icon, use that across
// Range: MonthRangePicker (quick presets: YTD, last 3/6/12, custom)
//  - in range view, net spending by month chart
//  - in range view, net spending by this tag by month chart
// make single month spending by tag a donut
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
    <div className="flex flex-col gap-4 w-full h-full px-4">
      <div className="flex gap-2 w-full items-center justify-center">
        <MonthPicker monthUTC={monthUTC} />
        <div className="flex p-1 flex-col gap-2">
          <div className="flex flex-col text-right">
            <span>${netSpendForSelectedMonth?.total_income}</span>
            <span>${netSpendForSelectedMonth?.total_spending}</span>
          </div>
          <div
            className={`flex flex-col text-lg ${
              Number(netSpendForSelectedMonth?.net_amount) < 0
                ? "text-red-700"
                : "text-green-700"
            }`}
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
          </div>
        </div>
      </div>

      <div className="border w-full p-3 flex items-center justify-center flex-wrap">
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
        <SpendingTargets
          taggedSpendingByPeriod={
            spending?.map((s) => ({
              ...s,
              is_current_month: true,
            })) ?? []
          }
        />
        <div className="flex">
          {/**@ts-expect-error css modules are a pain with ts */}
          <div className={style.chart}>
            <SpendingChart discretionaryByMonth={spending ?? []} />
          </div>
        </div>

        <div className="max-w-[1100] mx-auto hidden sm:flex flex-col gap-3">
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

  const currentPeriodSpending = taggedSpendingByPeriod.filter(
    (t) => t.is_current_month
  );

  const { income } = R.groupBy(estimatedIncomeAndExpenses, (r) => r.tag);

  const currentPeriodSpendingByTag = R.indexBy(
    currentPeriodSpending,
    (s) => s.tag
  );

  const estIncome = parseInt(income?.[0].amount ?? "0", 10) * -1;

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex">
        <Label text="Est. Income">
          <span>${estIncome}</span>
        </Label>
      </div>
      <div className="flex gap-10 flex-wrap">
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
              className="flex-col gap-3 bg-white max-w-[500px] w-full"
              key={kind}
            >
              <div className="flex gap-2 justify-between">
                <div>{labelForKind[kind]}</div>

                <form
                  action={setTagAllocation}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    name={tag.id}
                    defaultValue={allocation}
                    className="w-8"
                  />
                  <span>%</span>
                  <button
                    type="submit"
                    className="shadow-sm  rounded px-2 py-1"
                  >
                    update
                  </button>
                </form>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-xs">
                  ${currentSpending} / ${Math.round(targetSpending)}
                </div>
                <div className="w-full h-6 overflow-hidden border rounded">
                  <div
                    className={`bg-blue-500 relative h-full`}
                    style={{
                      width: `${(currentSpending / targetSpending) * 100}%`,
                      background: tag.color,
                    }}
                  ></div>
                </div>
                <div className="flex gap-3">
                  <span className="text-xl">
                    {isNaN(currentSpending) ? (
                      <span className="text-right">
                        ${targetSpending.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-right">
                        ${Math.round(targetSpending - currentSpending)}
                      </span>
                    )}
                  </span>
                  <span className="text-gray-500 text-sm">to spend</span>
                </div>
              </div>
            </div>
          );
        })}
        <div>TODO: create new target for tag</div>
      </div>
    </div>
  );
}
