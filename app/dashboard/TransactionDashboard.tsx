"use client";
import { Transaction } from "plaid";
import { useContext, useEffect, useState } from "react";
import { useLiveQuery, usePGlite } from "@electric-sql/pglite-react";
import { observer } from "mobx-react-lite";
import { AppStoreContext } from "@/app/dashboard/LocalPostgresProvider";

const useInitTransactions = (transactions: Transaction[]) => {
  const db = usePGlite();
  useEffect(() => {
    async function initTransactionsTable() {
      await db.transaction(async (tx) => {
        for (const transaction of transactions) {
          // first, check if the transaction already exists
          const existingTransaction = await tx.sql`
						SELECT * FROM transactions WHERE transaction_id = ${transaction.transaction_id}
					`;
          if (existingTransaction.rows.length > 0) {
            console.log(
              `Transaction ${transaction.transaction_id} already exists`
            );
            continue;
          }
          await tx.sql`
						INSERT INTO transactions (
							account_id, account_owner, amount, authorized_date, authorized_datetime,
							category, category_id, check_number, date, datetime,
							iso_currency_code, location, logo_url, merchant_entity_id, merchant_name,
							name, payment_channel, payment_meta, pending, pending_transaction_id,
							personal_finance_category, personal_finance_category_icon_url,
							transaction_code, transaction_id, transaction_type,
							unofficial_currency_code, website
						) VALUES (
							${transaction.account_id}, ${transaction.account_owner}, ${transaction.amount},
							${transaction.authorized_date}, ${transaction.authorized_datetime}, ${transaction.category},
							${transaction.category_id}, ${transaction.check_number},
							${transaction.date}, ${transaction.datetime}, ${transaction.iso_currency_code},
							${transaction.location}, ${transaction.logo_url}, ${transaction.merchant_entity_id},
							${transaction.merchant_name}, ${transaction.name}, ${transaction.payment_channel},
							${transaction.payment_meta}, ${transaction.pending}, ${transaction.pending_transaction_id},
							${transaction.personal_finance_category}, ${transaction.personal_finance_category_icon_url},
							${transaction.transaction_code}, ${transaction.transaction_id}, ${transaction.transaction_type},
							${transaction.unofficial_currency_code}, ${transaction.website}
						)
					`;
        }
      });
    }
    initTransactionsTable();
  }, [transactions]);
};

export function TransactionDashboard({
  transactions,
}: {
  transactions: Transaction[];
}) {
  useInitTransactions(transactions);
  const [query, setQuery] = useState("select * from transactions");
  const items = useLiveQuery(query);
  console.log({ items });

  if (items?.rows.length === 0) {
    return <div>No results</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <TransactionTags />
      <QueryInput onUpdate={setQuery} />
      <QueryResults rows={items?.rows ?? []} />
    </div>
  );
}

const TransactionTags = observer(function TransactionTags() {
  const appStore = useContext(AppStoreContext);
  if (!appStore) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4">
      {Array.from(appStore.transactionTags.entries()).map(([id, tag]) => (
        <div key={id}>
          {tag}
          {id}
        </div>
      ))}
    </div>
  );
});

function QueryInput({ onUpdate }: { onUpdate: (query: string) => void }) {
  const [query, setQuery] = useState("select * from transactions");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onUpdate(query);
      }}
    >
      <button className="p-5 bg-green-400" type="submit">
        Go
      </button>
      <input
        className="border-2 mx-auto w-[500px] border-black"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
      />
    </form>
  );
}

const columns = [
  "date",
  "name",
  "amount",
  "merchant_name",
  "category",
] as const satisfies (keyof Transaction)[];

function rendererForColumn(
  column: (typeof columns)[number],
  transaction: Transaction
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

    case "category":
      return transaction.category?.join(", ") || "N/A";
    default:
      const value = transaction[column];
      return value != null ? String(value) : "N/A";
  }
}

const QueryResults = observer(function QueryResults({
  rows,
}: {
  rows: { [key: string]: unknown }[];
}) {
  const firstRow = rows[0];

  const resultsAreTransactions = firstRow && "transaction_id" in firstRow;

  const appStore = useContext(AppStoreContext);

  if (!appStore) {
    return null;
  }

  if (resultsAreTransactions) {
    return (
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((transaction) => (
            <tr key={transaction.transaction_id}>
              {columns.map((column) => (
                <td key={`${transaction.transaction_id}-${column}`}>
                  {/* Handle different data types and potential null values */}
                  {rendererForColumn(column, transaction as Transaction)}
                </td>
              ))}
              <td>
                <select
                  value={
                    appStore.transactionTags.get(transaction.transaction_id) ??
                    "expenses"
                  }
                  onChange={(e) => {
                    appStore.markTransaction(
                      transaction.transaction_id,
                      e.target.value as any
                    );
                  }}
                >
                  <option value=""></option>
                  <option value="expenses">Expenses</option>
                  <option value="income">Income</option>
                  <option value="discretionary">Discretionary</option>
                  <option value="savings">Savings</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // just render key: val
  return (
    <div className="flex flex-col">
      {rows.map((item) => (
        <div className="flex flex-col">
          <DisplayUnknownObject obj={item} />
        </div>
      ))}
    </div>
  );
});

function DisplayUnknownObject({ obj }: { obj: unknown }) {
  return (
    <div className="flex flex-col pl-5">
      {Object.entries(obj).map(([key, val]) => (
        <div key={key}>
          {key}: {JSON.stringify(val)}
        </div>
      ))}
    </div>
  );
}
