import { TransactionCategorizer } from "@/app/dashboard/SpendingTable";
import { Transaction } from "plaid";

type SpendingCategorizerProps = {
  transactionsWithoutTag: Array<Transaction>;
};

export function SpendingCategorizer({
  transactionsWithoutTag,
}: SpendingCategorizerProps) {
  if (transactionsWithoutTag.length === 0) {
    return <div>No transactions to categorize</div>;
  }
  return (
    <div className="flex flex-wrap gap-10">
      {transactionsWithoutTag.map((transaction) => (
        <div key={transaction.transaction_id} className="p-5 flex flex-col">
          <span>{transaction.amount}</span>
          <span>{transaction.name}</span>
          <TransactionCategorizer transaction={transaction} />
        </div>
      ))}
    </div>
  );
}
