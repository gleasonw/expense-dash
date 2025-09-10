import { TransactionTagId } from "@/app/dashboard/actions";
import { AppTransaction } from "@/app/dashboard/types";
import { Transaction } from "plaid";

/**annoying drizzle parsing numbers to strings for postgres precision reasons */
export function toAppTransaction(
  transactions: Transaction[]
): AppTransaction[] {
  return transactions.map((t) => ({
    ...t,
    amount: t.amount.toString(),
  })) as AppTransaction[];
}

export function idForTagTransaction({
  transactionId,
  tagId,
}: {
  transactionId: string;
  tagId: string;
}) {
  return `${transactionId}%nufra%${tagId}` as TransactionTagId;
}

export function tagIdAndTransactionIdFromId(id: TransactionTagId): {
  transactionId: string;
  tagId: string;
} {
  const [transactionId, tagId] = id.split("%nufra%");
  if (!transactionId || !tagId) {
    throw new Error(`Invalid tag transaction ID: ${id}`);
  }
  return { transactionId, tagId };
}
