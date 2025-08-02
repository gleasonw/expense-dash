"use client";
import {
  addTagsToTransactions,
  TransactionTagId,
} from "@/app/dashboard/actions";
import { TransactionCategorizer } from "@/app/dashboard/SpendingTable";
import { idForTagTransaction } from "@/app/dashboard/transaction_utils";
import { TransactionWithTags } from "@/server/schema";
import { useState } from "react";

export type SpendingCategorizerProps = {
  transactionsWithoutTag: Array<TransactionWithTags>;
};

export function SpendingCategorizer({
  transactionsWithoutTag,
}: SpendingCategorizerProps) {
  const [pendingTransactionTags, setPendingTransactionTags] = useState<
    Record<TransactionTagId, { autoTag: boolean }>
  >({});

  function removeTag({
    transactionId,
    tagId,
  }: {
    transactionId: string;
    tagId: string;
  }) {
    setPendingTransactionTags((prev) => {
      const newTags = { ...prev };
      delete newTags[idForTagTransaction({ transactionId, tagId })];
      return newTags;
    });
  }

  function addTag({
    transactionId,
    tagId,
    autoTag = false,
  }: {
    transactionId: string;
    tagId: string;
    autoTag?: boolean;
  }) {
    setPendingTransactionTags((prev) => ({
      ...prev,
      [idForTagTransaction({ transactionId, tagId })]: { autoTag },
    }));
  }

  if (transactionsWithoutTag.length === 0) {
    return <div>No transactions to categorize</div>;
  }
  // add addTag, removeTag, then figure out how to batch upsert on form submit
  return (
    <form
      className="flex flex-col gap-4"
      action={() => {
        console.log(pendingTransactionTags);
        setPendingTransactionTags({});
        addTagsToTransactions(pendingTransactionTags);
      }}
    >
      <div className="flex flex-wrap gap-10">
        {transactionsWithoutTag.map((transaction) => (
          <div key={transaction.transaction_id} className="p-5 flex flex-col">
            <span>{transaction.amount}</span>
            <span>{transaction.name}</span>
            <TransactionCategorizer
              transaction={transaction}
              removeTag={removeTag}
              addTag={addTag}
              tagState={pendingTransactionTags} // Pass the pending tags state
            />
          </div>
        ))}
      </div>
      <button className="bg-green-200 text-green-800 px-4 py-2 rounded-md hover:bg-green-300">
        Categorize Transactions
      </button>
    </form>
  );
}
