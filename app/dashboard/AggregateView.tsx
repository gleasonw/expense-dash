"use client";

import { SpendingChart } from "@/app/dashboard/SpendingChart";
import { NetSpendChart } from "@/app/dashboard/NetSpendingChart";
import { SubtagDrilldownChart } from "@/app/dashboard/SubtagDrilldownChart";
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
  subtagData,
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
  subtagData?: SpendingRow[];
}) {
  return (
    <div className="px-2 flex flex-col gap-5 max-h-full overflow-hidden w-full">
      {/* Controls Row */}
      <div className="flex gap-4 w-full flex-wrap items-end bg-white p-4 rounded shadow-md">
        <div className="flex gap-4">
          <StartMonthPicker />
          <EndMonthPicker />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FeatureBox>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Filter by Top-Level Tag
              </label>
              <FilterByTagDropdown
                options={[
                  { label: "All", value: "" },
                  ...allTags
                    .filter((tag) => !tag.tag.includes("/")) // Only show top-level tags
                    .slice()
                    .sort((a, b) => a.tag.localeCompare(b.tag))
                    .map((tag) => ({ label: tag.tag, value: tag.tag })),
                ]}
                selectedValue={selectedTag ?? ""}
              />
              <span className="text-xs text-gray-500">
                Applies to spending charts only.
              </span>
            </div>
            {/**@ts-expect-error css modules are a pain with ts */}
            <div className={style.chart}>
              <SpendingChart discretionaryByMonth={spendingData} />
            </div>
          </div>
        </FeatureBox>

        <FeatureBox>
          {/**@ts-expect-error css modules are a pain with ts */}
          <div className={style.chart}>
            <NetSpendChart
              rows={netSpendingData}
              title={
                selectedTag
                  ? "Net Spending Over Time (All Tags)"
                  : "Net Spending Over Time"
              }
            />
          </div>
        </FeatureBox>

        {/* Subtag Drill-down Chart - only shown when a tag is filtered */}
        {selectedTag && subtagData && subtagData.length > 0 && (
          <FeatureBox className="lg:col-span-2">
            {/**@ts-expect-error css modules are a pain with ts */}
            <div className={style.chart}>
              <SubtagDrilldownChart
                subtagData={subtagData}
                parentTag={selectedTag}
              />
            </div>
          </FeatureBox>
        )}
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
