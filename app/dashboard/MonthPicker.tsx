"use client";

import { Calendar } from "@/components/ui/calendar";
import { useRouter } from "next/navigation";
import * as dateUtils from "@/app/utils/dates";

export function MonthPicker({
  monthUTC,
}: {
  monthUTC: dateUtils.YyyyMm | undefined;
}) {
  const router = useRouter();
  const month =
    monthUTC ??
    dateUtils.normYyyyMm(
      `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1)}`
    );
  const { end } = dateUtils.monthRangeUTC(month);
  console.log(end);

  // Prevent navigation to future months
  const now = new Date();
  const currentMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  return (
    <Calendar
      mode="single"
      month={end}
      className="bg-transparent"
      onMonthChange={(month) => {
        const currentURL = new URL(window.location.href);
        currentURL.searchParams.set(
          "monthUTC",
          month.toISOString().slice(0, 7)
        );
        router.push(currentURL.toString());
      }}
      captionLayout="dropdown" // shows month/year dropdown
      startMonth={new Date(2000, 0)}
      endMonth={currentMonth}
      showOutsideDays={false}
      fixedWeeks={false}
      // hide actual grid
      styles={{
        day: { display: "none" },
        week: { display: "none" },
        head: { display: "none" },
        month_grid: { display: "none" },
      }}
    />
  );
}
