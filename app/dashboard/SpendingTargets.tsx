"use client";
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
};

export function SpendingTargets({
  estimatedIncomeAndExpenses,
}: SpendingTargetsProps) {
  const { income, expenses, giving, savings, discretionary } = R.groupBy(
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

  const incomeAmount = parseInt(income[0].amount, 10) * -1;
  const expensesAmount = parseInt(expenses[0].amount, 10);
  const givingAmount = parseInt(giving[0].amount, 10);
  const savingsAmount = parseInt(savings[0].amount, 10);
  const discretionaryAmount = parseInt(discretionary[0].amount, 10);
  console.log({ givingAmount, savingsAmount, discretionaryAmount });

  const targetSpending = (R.sum(Object.values(targets)) / 100) * incomeAmount;
  const unspent = incomeAmount - targetSpending - expensesAmount;

  return (
    <div className="flex flex-col gap-4">
      {" "}
      <h1>
        Income: ${incomeAmount} (
        {new Date(income[0].month).toLocaleDateString()})
      </h1>
      <label className="flex gap-3">
        <span>Expenses: - ${expensesAmount}</span>
        <span>
          {`(${((expensesAmount / incomeAmount) * 100).toFixed(2)}%)`}
        </span>
      </label>
      <div className="grid grid-cols-2 gap-10">
        <div className="flex flex-col gap-2 border p-5">
          <h2>Targets</h2>
          {toTrack.map((kind) => (
            <label className="flex gap-3" key={kind}>
              {labelForKind[kind]}

              <input
                type="range"
                min="0"
                max="100"
                onChange={(e) => handleTargetChange(kind, e.target.value)}
                value={targets[kind]}
              />
              <span className="text-xl">
                - $
                {(
                  parseInt(income[0].amount) *
                  -1 *
                  (targets[kind] / 100)
                ).toFixed(2)}{" "}
                ({targets[kind]}
                %)
              </span>
            </label>
          ))}
          <div className="flex flex-col gap-3">
            Unspent = ${unspent.toFixed(2)} (
            {((unspent / incomeAmount) * 100).toFixed(2)}%)
          </div>
        </div>
        <div className="flex flex-col gap-2 border p-5">
          <h2>Actual {new Date(savings[0].month).toLocaleDateString()}</h2>
          <span>
            -${discretionaryAmount} Discretionary{" "}
            {`(${((discretionaryAmount / incomeAmount) * 100).toFixed(2)}%)`}
          </span>
          <span>
            -${savingsAmount} Savings{" "}
            {`(${((savingsAmount / incomeAmount) * 100).toFixed(2)}%)`}
          </span>
          <span>
            -${givingAmount} Giving{" "}
            {`(${((givingAmount / incomeAmount) * 100).toFixed(2)}%)`}
          </span>
          <span>
            Unspent = $
            {incomeAmount -
              expensesAmount -
              givingAmount -
              savingsAmount -
              discretionaryAmount}{" "}
          </span>
        </div>
      </div>
    </div>
  );
}
