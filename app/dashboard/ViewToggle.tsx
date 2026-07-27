"use client";

import { MonthPicker } from "@/app/dashboard/MonthPicker";
import {
  EndMonthPicker,
  StartMonthPicker,
} from "@/app/dashboard/MonthRangePicker";
import * as dateUtils from "@/app/utils/dates";
import { useRouter, useSearchParams } from "next/navigation";

interface ViewToggleProps {
  defaultView?: "month" | "aggregate";
  extra?: React.ReactNode;
}

export function ViewToggle({ defaultView = "month", extra }: ViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = (searchParams.get("view") ?? defaultView) as
    | "month"
    | "aggregate";

  const handleViewChange = (view: "month" | "aggregate") => {
    const currentURL = new URL(window.location.href);
    if (view === defaultView) {
      currentURL.searchParams.delete("view");
    } else {
      currentURL.searchParams.set("view", view);
    }
    router.push(currentURL.toString());
  };

  const mParam = searchParams.get("monthUTC");
  const mParamString = typeof mParam === "string" ? mParam : undefined;
  const monthUTC = dateUtils.normYyyyMm(mParamString);

  return (
    <div className="flex w-full items-start gap-3">
      {extra}
      <div className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500">
        <button
          onClick={() => handleViewChange("month")}
          className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
            currentView === "month"
              ? "bg-white text-gray-900 shadow-sm"
              : "hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          Month View
        </button>
        <button
          onClick={() => handleViewChange("aggregate")}
          className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
            currentView === "aggregate"
              ? "bg-white text-gray-900 shadow-sm"
              : "hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          Aggregate View
        </button>
      </div>
      <div className="bg-white p-1">
        {currentView === "month" ? (
          <MonthPicker monthUTC={monthUTC} />
        ) : (
          <div className="flex gap-2 items-center">
            <StartMonthPicker />
            to
            <EndMonthPicker />
          </div>
        )}
      </div>
    </div>
  );
}
