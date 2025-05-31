import { TransactionCategorizer } from "@/app/dashboard/SpendingTable";
import { TransactionWithTags } from "@/server/schema";

type SpendingCategorizerProps = {
  transactionsWithoutTag: Array<TransactionWithTags>;
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
