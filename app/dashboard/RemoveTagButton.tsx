"use client";

import { removeTagFromTransaction } from "@/app/dashboard/actions";

export function RemoveTagButton({
  transaction,
  tag,
  children,
}: {
  transaction: { transaction_id: string };
  tag: { id: string; color: string };
  children: React.ReactNode;
}) {
  return (
    <button
      className={`bg-${tag.color}-200 text-${tag.color}-800  px-1 py-0 rounded-md`}
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
