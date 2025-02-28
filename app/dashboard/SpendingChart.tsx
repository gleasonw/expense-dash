"use client";

import * as Highcharts from "highcharts";
import { HighchartsReact } from "highcharts-react-official";
import { useMemo } from "react";

type SpendingChartProps = {
  discretionaryByMonth: Array<{
    month: string;
    tag: string;
    total_discretionary_spending: string;
  }>;
};

export function SpendingChart({ discretionaryByMonth }: SpendingChartProps) {
  const highchartsConfig = useMemo(() => {
    // Group data by month and tag
    const groupedData = discretionaryByMonth.reduce((acc, row) => {
      const month = row.month.substring(0, 7); // Extract year-month
      const tag = row.tag;
      const spending = parseFloat(row.total_discretionary_spending);

      if (!acc[tag]) {
        acc[tag] = [];
      }

      acc[tag].push({ name: month, y: spending });
      return acc;
    }, {} as Record<string, Array<{ name: string; y: number }>>);

    return {
      chart: {
        type: "column",
      },
      title: {
        text: "Monthly Spending by Category",
      },
      xAxis: {
        type: "category",
        title: {
          text: "Month",
        },
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
        title: {
          text: "Total Spending",
        },
      },
      tooltip: {
        pointFormat:
          "Spending in {point.category} ({series.name}): <b>{point.y:.2f}</b>",
      },
      plotOptions: {
        column: {
          stacking: undefined,
          grouping: "normal",
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
      series: Object.entries(groupedData).map(([tag, data]) => ({
        name: tag,
        data,
      })),
    };
  }, [discretionaryByMonth]);

  return <HighchartsReact highcharts={Highcharts} options={highchartsConfig} />;
}
