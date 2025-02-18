"use client";
import { Transaction } from "plaid";
import { useEffect, useState } from "react";
import { useLiveQuery, usePGlite } from "@electric-sql/pglite-react";
import { useDebounce } from "@uidotdev/usehooks";

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
      <QueryInput onUpdate={setQuery} />
      <QueryResults rows={items?.rows ?? []} />
    </div>
  );
}

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

function QueryResults({ rows }: { rows: { [key: string]: unknown }[] }) {
  const firstRow = rows[0];

  const resultsAreTransactions = firstRow && "transaction_id" in firstRow;

  if (resultsAreTransactions) {
    return (
      <div className="flex flex-col gap-10">
        {rows.map((item) => (
          <DisplayUnknownObject obj={item} key={item.transaction_id} />
        ))}
      </div>
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
}

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
