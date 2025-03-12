"use client";
import { Label } from "@/app/components/Label";
import { useState } from "react";
import * as R from "remeda";

const toTrack = ["discretionary", "savings", "giving"] as const;

const labelForKind: Record<TargetKind, string> = {
  discretionary: "Discretionary",
  giving: "Giving",
  savings: "Savings",
};

type TargetKind = (typeof toTrack)[number];

type SpendingTargetsProps = {
  estimatedIncomeAndExpenses: {
    month: string;
    amount: string;
    tag: string;
  }[];
  currentMonthSpending: {
    month: string;
    amount: string;
    tag: string;
    is_current_month: boolean;
  }[];
};

function getFormattedDate(d: Date) {
  const intl = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return intl.format(d);
}

export function SpendingTargets({
  estimatedIncomeAndExpenses,
  currentMonthSpending,
}: SpendingTargetsProps) {
  const { income, expenses } = R.groupBy(
    estimatedIncomeAndExpenses,
    (r) => r.tag
  );
  const [targets, setTargets] = useState({
    discretionary: 20,
    savings: 30,
    giving: 10,
  });

  function handleTargetChange(kind: TargetKind, value: string) {
    const valAsNumber = parseInt(value, 10);
    if (isNaN(valAsNumber)) {
      return;
    }
    setTargets({ ...targets, [kind]: valAsNumber });
  }
  const currentMonthSpendingByTag = R.indexBy(
    currentMonthSpending,
    (s) => s.tag
  );

  const estIncome = parseInt(income?.[0].amount ?? "0", 10) * -1;
  const estExpenses = parseInt(expenses?.[0].amount ?? "0", 10);

  const targetSpending = (R.sum(Object.values(targets)) / 100) * estIncome;
  const unspent = estIncome - targetSpending - estExpenses;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex gap-10 w-full">
          <Label text="Income">
            <span>${estIncome}</span>
          </Label>
          <Label text="Expenses">-${estExpenses}</Label>
        </div>
        <div className="w-full border" />
        <Label text="To allocate">
          <span>${estIncome - estExpenses}</span>
        </Label>
        <div className="flex gap-10 flex-wrap">
          {toTrack.map((kind) => {
            const targetSpending = (targets[kind] / 100) * estIncome;
            const currentSpending = parseInt(
              currentMonthSpendingByTag[kind]?.amount ?? "0"
            );
            return (
              <div className="p-5 flex gap-5 flex-col" key={kind}>
                <Label text={labelForKind[kind]}>
                  <div className="flex">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-18"
                      onChange={(e) => handleTargetChange(kind, e.target.value)}
                      value={targets[kind]}
                    />
                    <span>%</span>
                  </div>
                </Label>
                <Label text="Spent this month">
                  <span className=" text-right">
                    {isNaN(currentSpending) ? "$0" : `$${currentSpending}`}
                  </span>
                </Label>
                <Label text="To spend">
                  {isNaN(currentSpending) ? (
                    <span className="text-right">
                      ${targetSpending.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-right">
                      ${Math.round(targetSpending - currentSpending)}
                    </span>
                  )}
                </Label>
              </div>
            );
          })}
        </div>
        <Label text={"Unallocated"}>
          <span className=" ">${unspent.toFixed(2)}</span>
        </Label>
      </div>
    </div>
  );
}
