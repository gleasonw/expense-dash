"use client";

import { removeTagFromTransaction } from "@/app/dashboard/actions";

export function RemoveTagButton({
  transaction,
  tag,
  children,
}: {
  transaction: { transaction_id: string };
  tag: { id: string };
  children: React.ReactNode;
}) {
  return (
    <button
      className="bg-blue-200 text-blue-800  px-1 py-0 rounded-md"
      onClick={() =>
        removeTagFromTransaction({
          transactionId: transaction.transaction_id,
          tagId: tag.id,
        })
      }
    >
      {children}
    </button>
  );
}
