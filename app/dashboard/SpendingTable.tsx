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
  updateTransactionDate,
} from "@/app/dashboard/actions";
import { idForTagTransaction } from "@/app/dashboard/transaction_utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

const columns = [
  "amount",
  "name",
  "date",
] as const satisfies (keyof Transaction)[];

const utcFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "2-digit",
});

function TransactionDateEditor({
  date,
  transaction,
}: {
  date?: Date;
  transaction: { id: string };
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!date}
          className="data-[empty=true]:text-muted-foreground w-[200px] justify-start text-left font-normal"
        >
          <CalendarIcon />
          {date ? utcFormatter.format(date) : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(date) =>
            date && updateTransactionDate(transaction.id, date?.toISOString())
          }
        />
      </PopoverContent>
    </Popover>
  );
}

function rendererForColumn(
  column: (typeof columns)[number],
  transaction: TransactionWithTags
): string | React.ReactNode {
  switch (column) {
    case "amount":
      // amount is actually a string here. we need to parse it to a number
      return Number(transaction.amount).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
    case "date":
      return (
        <TransactionDateEditor
          date={transaction.date ? new Date(transaction.date) : undefined}
          transaction={{ id: transaction.transaction_id }}
        />
      );

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
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
          <th>tags</th>
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
      {columns.map((column) => (
        <td
          key={`${transaction.transaction_id}-${column}`}
          className="text-left p-3"
        >
          {/* Handle different data types and potential null values */}
          {rendererForColumn(column, transaction as TransactionWithTags)}
        </td>
      ))}
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
                style={{ border: `3px solid ${tag.color}` }}
                className="bg-gray-200 text-gray-800 px-2 py-1 rounded-md flex justify-between"
              >
                {tag.tag}
                <span>X</span>
              </button>
            ))}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
