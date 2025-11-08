"use client";

import * as Highcharts from "highcharts";
import { HighchartsReact } from "highcharts-react-official";
import { useMemo } from "react";
import "./highcharts.css";

export type NetRow = {
  month: string; // 'YYYY-MM-01 00:00:00+00'
  total_income: string;
  total_spending: string;
  net_amount: string;
};

type NetSpendChartProps = {
  rows: Array<NetRow>;
  title?: string;
};

function toCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function parseMonthLabel(m: string) {
  // '2025-07-01 00:00:00+00' -> '2025-07'
  return m.substring(0, 7);
}

export function NetSpendChart({ rows, title }: NetSpendChartProps) {
  const options = useMemo(() => {
    // sort by month ASC (defensive)
    const sorted = [...rows].sort((a, b) =>
      a.month < b.month ? -1 : a.month > b.month ? 1 : 0
    );

    const categories = sorted.map((r) => parseMonthLabel(r.month));
    const points = sorted.map((r) => {
      const y = parseFloat(r.net_amount);
      const income = parseFloat(r.total_income);
      const spend = parseFloat(r.total_spending);
      return {
        name: parseMonthLabel(r.month),
        y,
        custom: {
          income,
          spend,
        },
        className: y < 0 ? "net-neg" : "net-pos",
      };
    });

    return {
      chart: {
        styledMode: true,
        type: "column",
        width: null,
        height: null,
      },
      title: {
        text: title ?? "Net Spend by Month",
      },
      xAxis: {
        categories,
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
        title: { text: "Net Amount" },
        plotLines: [
          {
            value: 0,
            width: 1,
            className: "zero-line",
            zIndex: 5,
          },
        ],
      },
      tooltip: {
        useHTML: true,
        formatter: function () {
          // @ts-expect-error Highcharts dynamic this
          const p = this.point;
          const cat = this.x;
          const y = Number(p.y || 0);
          const income = Number(p.custom?.income || 0);
          const spend = Number(p.custom?.spend || 0);
          return `
						<div>
							<div><b>${cat}</b></div>
							<div>Net: <b>${toCurrency(y)}</b></div>
							<div>Income: ${toCurrency(income)}</div>
							<div>Spending: ${toCurrency(spend)}</div>
						</div>
					`;
        },
      },
      plotOptions: {
        series: {
          animation: false,
          // Zones give you automatic pos/neg styling without inline colors
          zones: [
            { value: 0, className: "net-neg" }, // y < 0
            { className: "net-pos" }, // y >= 0
          ],
          dataLabels: {
            enabled: true,
            formatter: function () {
              return toCurrency(this.y as number);
            },
            className: "net-label",
          },
        },
        column: {
          pointPadding: 0.1,
          borderWidth: 0,
        },
      },
      series: [
        {
          name: "Net",
          type: "column",
          data: points,
        },
      ],
      credits: { enabled: false },
      legend: { enabled: false },
    } as Highcharts.Options;
  }, [rows, title]);

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
