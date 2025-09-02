"use client";

import * as Highcharts from "highcharts";
import { HighchartsReact } from "highcharts-react-official";
import { useMemo } from "react";

type SpendingChartProps = {
  discretionaryByMonth: Array<{
    month: string;
    tag: string;
    amount: string;
    color: string;
  }>;
};

export function SpendingChart({ discretionaryByMonth }: SpendingChartProps) {
  const highchartsConfig = useMemo(() => {
    // Group data by tag
    const groupedData = discretionaryByMonth.reduce((acc, row) => {
      const month = row.month.substring(0, 7); // year-month
      const tag = row.tag;
      const spending = parseFloat(row.amount);

      if (!acc[tag]) {
        acc[tag] = { data: [], color: row.color };
      }

      acc[tag].data.push({ name: month, y: spending });
      return acc;
    }, {} as Record<string, { data: Array<{ name: string; y: number }>; color: string }>);

    return {
      chart: {
        type: "column",
        width: null,
        height: null,
      },
      title: {
        text: "Monthly Spending by Category",
      },
      xAxis: {
        type: "category",
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
      series: Object.entries(groupedData).map(([tag, { data, color }]) => ({
        name: tag,
        data,
        color,
      })),
    };
  }, [discretionaryByMonth]);

  return <HighchartsReact highcharts={Highcharts} options={highchartsConfig} />;
}
