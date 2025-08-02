"use client";
import { Transaction } from "plaid";
import { useContext, useState } from "react";
import { observer } from "mobx-react-lite";
import { AppStoreContext, TagsContext } from "@/app/dashboard/Providers";
import { TransactionWithTags } from "@/server/schema";
import {
  addTagToTransaction_v2,
  FormTagTransactionState,
  removeTagFromTransaction,
} from "@/app/dashboard/actions";
import { idForTagTransaction } from "@/app/dashboard/transaction_utils";

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
        {transaction.tags?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {transaction.tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() =>
                  removeTagFromTransaction({
                    transactionId: transaction.transaction_id,
                    tagId: tag.id,
                  })
                }
                className="bg-gray-200 text-gray-800 px-2 py-1 rounded-md flex justify-between"
              >
                {tag.tag}
                <span>X</span>
              </button>
            ))}
          </div>
        ) : null}
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

type MakeSync<T> = T extends (...args: any[]) => Promise<infer R>
  ? (...args: Parameters<T>) => R
  : T;

export function TransactionCategorizer({
  transaction,
  removeTag,
  addTag,
  tagState,
}: {
  transaction: TransactionWithTags;
  removeTag: MakeSync<typeof removeTagFromTransaction>;
  addTag: MakeSync<typeof addTagToTransaction_v2>;
  tagState: FormTagTransactionState;
}) {
  const tags = useContext(TagsContext);
  const [autoTagTransaction, setAutoTagTransaction] = useState(false);

  return (
    <div className="flex gap-2 flex-col">
      <div className="flex flex-wrap gap-3">
        {tags?.map((t) => {
          const id = idForTagTransaction({
            transactionId: transaction.transaction_id,
            tagId: t.id,
          });
          const tagIsSelectedForTransaction = tagState[id];
          return (
            <button
              key={t.id}
              className={`bg-gray-200 text-gray-800 px-2 py-1 rounded-md hover:cursor-pointer ${
                tagIsSelectedForTransaction ? "bg-green-500 outline" : ""
              }`}
              onClick={(e) => {
                e.preventDefault();

                if (tagIsSelectedForTransaction) {
                  removeTag({
                    transactionId: transaction.transaction_id,
                    tagId: t.id,
                  });
                } else {
                  addTag({
                    transactionId: transaction.transaction_id,
                    tagId: t.id,
                    autoTag: autoTagTransaction,
                  });
                }
              }}
            >
              {t.tag}
            </button>
          );
        })}
      </div>
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
