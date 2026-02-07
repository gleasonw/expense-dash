"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TransactionAllocationModal } from "./TransactionAllocationModal";

type UnallocatedTransaction = {
  transactionId: string;
  transactionName: string;
  merchantName: string | null;
  transactionDate: string;
  transactionAmount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
};

type Bucket = {
  id: number;
  name: string;
  targetAmount: string | null;
  autoAllocationPercent: string | null;
};

export function UnallocatedTransactionsSection({
  transactions,
  buckets,
  extra,
}: {
  transactions: UnallocatedTransaction[];
  buckets: Bucket[];
  extra?: React.ReactNode;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<{
    transactionId: string;
    transactionName: string;
    transactionDate: string;
    unallocatedAmount: string;
  } | null>(null);

  const unallocatedTransactions = transactions.filter(
    (t) => parseFloat(t.unallocatedAmount) > 0
  );

  const handleAllocate = (transaction: UnallocatedTransaction) => {
    setSelectedTransaction({
      transactionId: transaction.transactionId,
      transactionName: transaction.transactionName,
      transactionDate: transaction.transactionDate,
      unallocatedAmount: transaction.unallocatedAmount,
    });
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  if (unallocatedTransactions.length === 0) {
    return null;
  }

  return (
    <>
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
                  {Math.abs(parseFloat(transaction.transactionAmount)).toFixed(
                    2
                  )}
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
                onClick={() => handleAllocate(transaction)}
                size="sm"
                variant="default"
              >
                Allocate
              </Button>
            </div>
          ))}
          {extra}
        </div>
      </div>

      <TransactionAllocationModal
        isOpen={isModalOpen}
        onClose={handleClose}
        transaction={selectedTransaction}
        buckets={buckets}
        onSuccess={handleClose}
      />
    </>
  );
}
