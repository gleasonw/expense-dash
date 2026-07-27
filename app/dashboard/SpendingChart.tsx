"use client";

import * as Highcharts from "highcharts";
import { HighchartsReact } from "highcharts-react-official";
import { useMemo } from "react";
import "./highcharts.css";
import { SpendingRow } from "@/app/dashboard/aggregates";

type SpendingChartProps = {
  discretionaryByMonth: Array<
    Omit<SpendingRow, "depth" | "tagAllocation" | "tagAllocationType">
  >;
};

export function SpendingChart({ discretionaryByMonth }: SpendingChartProps) {
  const highchartsConfig = useMemo(() => {
    // Group data by tag
    const groupedData = discretionaryByMonth.reduce((acc, row) => {
      const month = row.month.substring(0, 7); // year-month
      const tag = row.tag;
      const spending = parseFloat(row.amount);

      if (!acc[tag]) {
        acc[tag] = { data: [], color: row.color ?? "" };
      }

      acc[tag].data.push({ name: month, y: spending });
      return acc;
    }, {} as Record<string, { data: Array<{ name: string; y: number }>; color: string }>);

    const months = Array.from(
      new Set(
        Object.values(groupedData).flatMap(({ data }) =>
          data.map(({ name }) => name)
        )
      )
    ).sort();

    return {
      chart: {
        styledMode: true,
        type: "column",
        width: null,
        height: null,
      },
      title: {
        text: "Monthly Spending by Category",
      },
      xAxis: {
        categories: months,
        title: { text: "Month" },
        labels: {
          rotation: -45,
          align: "right",
          style: {
            fontSize: "13px",
            fontFamily: "Verdana, sans-serif",
          },
        },
      },
      yAxis: {
        title: { text: "Total Spending" },
      },
      tooltip: {
        pointFormat:
          "Spending in {point.category} ({series.name}): <b>{point.y:.2f}</b>",
      },
      plotOptions: {
        column: {
          dataLabels: {
            enabled: true,
            format: "${point.y:.2f}",
            style: {
              fontWeight: "bold",
              color: "black",
              textOutline: "1px contrast",
            },
          },
        },
      },
      series: Object.entries(groupedData).map(([tag, { data, color }]) => {
        const spendingByMonth = new Map(
          data.map(({ name, y }) => [name, y])
        );

        return {
          name: tag,
          data: months.map((month) => spendingByMonth.get(month) ?? null),
          color: "",
          className: `fill-${color}-400`,
        };
      }),
    };
  }, [discretionaryByMonth]);

  return <HighchartsReact highcharts={Highcharts} options={highchartsConfig} />;
}
