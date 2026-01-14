"use client";

import { useState } from "react";
import { TransactionAllocationModal } from "./TransactionAllocationModal";

type Transaction = {
  transactionId: string;
  transactionName: string;
  transactionDate: string;
  unallocatedAmount: string;
};

type Bucket = {
  id: number;
  name: string;
  type: "goal" | "ongoing";
};

export function AllocationModalProvider({
  children,
  buckets,
}: {
  children: (openModal: (transaction: Transaction) => void) => React.ReactNode;
  buckets: Bucket[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const openModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedTransaction(null);
  };

  return (
    <>
      {children(openModal)}
      <TransactionAllocationModal
        isOpen={isOpen}
        onClose={handleClose}
        transaction={selectedTransaction}
        buckets={buckets}
        onSuccess={handleClose}
      />
    </>
  );
}
