"use client";

import { Calendar } from "@/components/ui/calendar";
import { useRouter, useSearchParams } from "next/navigation";
import * as dateUtils from "@/app/utils/dates";

export function StartMonthPicker() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Default to 12 months ago
  const defaultStart = new Date();
  defaultStart.setUTCMonth(defaultStart.getUTCMonth() - 12);
  const defaultStartMonth = dateUtils.normYyyyMm(
    `${defaultStart.getUTCFullYear()}-${String(
      defaultStart.getUTCMonth() + 1,
    ).padStart(2, "0")}`,
  );

  const startMonth = searchParams.get("startMonth") ?? defaultStartMonth;
  const { end } = dateUtils.monthRangeUTC(startMonth as dateUtils.YyyyMm);

  // Prevent navigation to future months
  const now = new Date();
  const currentMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  return (
    <div className="flex flex-col gap-1">
      <Calendar
        mode="single"
        month={end}
        className="bg-transparent"
        onMonthChange={(month) => {
          const currentURL = new URL(window.location.href);
          currentURL.searchParams.set(
            "startMonth",
            month.toISOString().slice(0, 7),
          );
          router.push(currentURL.toString());
        }}
        captionLayout="dropdown"
        startMonth={new Date(2000, 0)}
        endMonth={currentMonth}
        showOutsideDays={false}
        fixedWeeks={false}
        styles={{
          day: { display: "none" },
          week: { display: "none" },
          head: { display: "none" },
          month_grid: { display: "none" },
        }}
      />
    </div>
  );
}

export function EndMonthPicker() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Default to current month
  const defaultEnd = new Date();
  const defaultEndMonth = dateUtils.normYyyyMm(
    `${defaultEnd.getUTCFullYear()}-${String(
      defaultEnd.getUTCMonth() + 1,
    ).padStart(2, "0")}`,
  );

  const endMonth = searchParams.get("endMonth") ?? defaultEndMonth;
  const { end } = dateUtils.monthRangeUTC(endMonth as dateUtils.YyyyMm);

  // Prevent navigation to future months
  const now = new Date();
  const currentMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  return (
    <div className="flex flex-col gap-1">
      <Calendar
        mode="single"
        month={end}
        className="bg-transparent"
        onMonthChange={(month) => {
          const currentURL = new URL(window.location.href);
          currentURL.searchParams.set(
            "endMonth",
            month.toISOString().slice(0, 7),
          );
          router.push(currentURL.toString());
        }}
        captionLayout="dropdown"
        startMonth={new Date(2000, 0)}
        endMonth={currentMonth}
        showOutsideDays={false}
        fixedWeeks={false}
        styles={{
          day: { display: "none" },
          week: { display: "none" },
          head: { display: "none" },
          month_grid: { display: "none" },
        }}
      />
    </div>
  );
}
