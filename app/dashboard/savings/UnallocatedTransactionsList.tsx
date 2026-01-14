"use client";

import { Button } from "@/components/ui/button";

type UnallocatedTransaction = {
  transactionId: string;
  transactionName: string;
  merchantName: string | null;
  transactionDate: string;
  transactionAmount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
};

export function UnallocatedTransactionsList({
  transactions,
  onAllocate,
}: {
  transactions: UnallocatedTransaction[];
  onAllocate: (transaction: {
    transactionId: string;
    transactionName: string;
    transactionDate: string;
    unallocatedAmount: string;
  }) => void;
}) {
  const unallocatedTransactions = transactions.filter(
    (t) => parseFloat(t.unallocatedAmount) > 0
  );

  if (unallocatedTransactions.length === 0) {
    return (
      <div className="bg-green-50 p-6 rounded-lg border border-green-200 mb-6">
        <p className="text-green-800">
          ✓ All savings transactions have been fully allocated!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <h3 className="text-lg font-semibold mb-4">
        Unallocated Savings Transactions ({unallocatedTransactions.length})
      </h3>

      <div className="space-y-3">
        {unallocatedTransactions.map((transaction) => (
          <div
            key={transaction.transactionId}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-200"
          >
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                {transaction.merchantName || transaction.transactionName}
              </p>
              <p className="text-sm text-gray-600">
                {new Date(transaction.transactionDate).toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }
                )}
              </p>
            </div>

            <div className="text-right mr-4">
              <p className="font-semibold text-gray-900">
                $
                {Math.abs(parseFloat(transaction.transactionAmount)).toFixed(2)}
              </p>
              {parseFloat(transaction.allocatedAmount) > 0 && (
                <p className="text-xs text-gray-500">
                  ${transaction.allocatedAmount} allocated
                </p>
              )}
              <p className="text-sm font-medium text-orange-600">
                ${transaction.unallocatedAmount} remaining
              </p>
            </div>

            <Button
              onClick={() =>
                onAllocate({
                  transactionId: transaction.transactionId,
                  transactionName: transaction.transactionName,
                  transactionDate: transaction.transactionDate,
                  unallocatedAmount: transaction.unallocatedAmount,
                })
              }
              size="sm"
              variant="default"
            >
              Allocate
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
