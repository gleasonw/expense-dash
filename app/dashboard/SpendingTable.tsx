"use client";
import { Transaction } from "plaid";
import { useContext, useState } from "react";
import { observer } from "mobx-react-lite";
import { AppStoreContext, TagsContext } from "@/app/dashboard/Providers";
import { TransactionWithTags } from "@/server/schema";
import {
  addTagToTransaction_v2,
  removeTagFromTransaction,
} from "@/app/dashboard/actions";
import * as R from "remeda";

const columns = [
  "date",
  "name",
  "amount",
] as const satisfies (keyof Transaction)[];

function rendererForColumn(
  column: (typeof columns)[number],
  transaction: TransactionWithTags
): string {
  switch (column) {
    case "amount":
      // amount is actually a string here. we need to parse it to a number
      return Number(transaction.amount).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
    case "date":
      // simple day date
      return new Date(transaction.date).toLocaleDateString("en-US", {
        dateStyle: "long",
      });

    default:
      const value = transaction[column];
      return value != null ? String(value) : "N/A";
  }
}

export const SpendingTable = observer(function QueryResults({
  rows,
}: {
  rows: TransactionWithTags[];
}) {
  const appStore = useContext(AppStoreContext);

  if (!appStore) {
    return null;
  }

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Tags</th>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody className="space-y-4">
        {rows.map((transaction) => (
          <TransactionRow
            transaction={transaction}
            key={transaction.transaction_id}
          />
        ))}
      </tbody>
    </table>
  );
});

function TransactionRow({ transaction }: { transaction: TransactionWithTags }) {
  return (
    <tr
      key={transaction.transaction_id}
      className="border-spacing-5 border-2 odd:bg-gray-100"
    >
      <td className="p-3">
        <TransactionCategorizer transaction={transaction} />
      </td>
      {columns.map((column) => (
        <td
          key={`${transaction.transaction_id}-${column}`}
          className="text-right"
        >
          {/* Handle different data types and potential null values */}
          {rendererForColumn(column, transaction as TransactionWithTags)}
        </td>
      ))}
    </tr>
  );
}

export function TransactionCategorizer({
  transaction,
}: {
  transaction: TransactionWithTags;
}) {
  const tags = useContext(TagsContext);
  const [autoTagTransaction, setAutoTagTransaction] = useState(false);

  return (
    <div className="flex gap-2 flex-col">
      <div className="flex flex-wrap gap-1">
        {transaction.tags.map((t) => (
          <button
            key={t.tag}
            className="bg-blue-200 text-blue-800 px-2 py-1 rounded-md hover:bg-blue-300"
            onClick={() => {
              removeTagFromTransaction({
                transactionId: transaction.transaction_id,
                tagId: t.id,
              });
            }}
          >
            {t.tag}
          </button>
        ))}
      </div>
      <select
        value={transaction.tags?.at(0)?.id ?? ""}
        onChange={(e) => {
          addTagToTransaction_v2({
            tagId: e.target.value,
            transactionId: transaction.transaction_id,
            autoTag: autoTagTransaction,
          });
        }}
      >
        {tags?.map((t) => (
          <option key={t.tag} value={t.id}>
            {t.tag}
          </option>
        ))}
        <option value="">None</option>
      </select>
      <label>
        Autotag
        <input
          type="checkbox"
          checked={autoTagTransaction}
          onChange={(e) => setAutoTagTransaction(e.target.checked)}
        />
      </label>
    </div>
  );
}

function DisplayUnknownObject({ obj }: { obj: unknown }) {
  if (obj === undefined || obj === null) {
    return <div>null</div>;
  }
  return (
    <div className="flex flex-col pl-5">
      {Object.entries(obj).map(([key, val], i) => (
        <div key={`${key}-${i}`}>
          {key}: {JSON.stringify(val)}
        </div>
      ))}
    </div>
  );
}
