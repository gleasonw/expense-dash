"use client";

import { SpendingChart } from "@/app/dashboard/SpendingChart";
import { NetSpendChart } from "@/app/dashboard/NetSpendingChart";
import { FilterByTagDropdown } from "@/app/dashboard/FilterByTagDropdown";
import {
  StartMonthPicker,
  EndMonthPicker,
} from "@/app/dashboard/MonthRangePicker";
import * as style from "@/app/dashboard/dashboard.module.css";
import { SpendingRow } from "@/app/dashboard/aggregates";
import { Tag } from "@/server/schema";

export function AggregateView({
  spendingData,
  netSpendingData,
  allTags,
  selectedTag,
}: {
  spendingData: SpendingRow[];
  netSpendingData: Array<{
    month: string;
    total_income: string;
    total_spending: string;
    net_amount: string;
  }>;
  allTags: Tag[];
  selectedTag?: string;
}) {
  return (
    <div className="px-2 flex flex-col gap-5 max-h-full overflow-hidden">
      {/* Controls Row */}
      <div className="flex gap-4 w-full flex-wrap items-end bg-white p-4 rounded shadow-md">
        <div className="flex gap-4">
          <StartMonthPicker />
          <EndMonthPicker />
        </div>
        <div className="ml-auto">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Filter by Tag</label>
            <FilterByTagDropdown
              options={[
                { label: "All", value: "" },
                ...allTags
                  .slice()
                  .sort((a, b) => a.tag.localeCompare(b.tag))
                  .map((tag) => ({ label: tag.tag, value: tag.tag })),
              ]}
              selectedValue={selectedTag ?? ""}
            />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FeatureBox>
          {/**@ts-expect-error css modules are a pain with ts */}
          <div className={style.chart}>
            <SpendingChart discretionaryByMonth={spendingData} />
          </div>
        </FeatureBox>

        <FeatureBox>
          {/**@ts-expect-error css modules are a pain with ts */}
          <div className={style.chart}>
            <NetSpendChart
              rows={netSpendingData}
              title="Net Spending Over Time"
            />
          </div>
        </FeatureBox>
      </div>
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
