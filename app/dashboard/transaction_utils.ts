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

export const formatCurrency = (value: number | string) => {
  const roundedValue =
    typeof value === "number"
      ? Math.round(value * 100) / 100
      : Math.round(parseFloat(value) * 100) / 100;
  // Handle potential NaN if parsing fails
  if (isNaN(roundedValue)) {
    return "$--"; // Or some other placeholder
  }
  // Basic formatting, consider Intl.NumberFormat for more robust formatting
  return `${roundedValue < 0 ? "-" : ""}$${Math.abs(roundedValue)}`;
};

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
