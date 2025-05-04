import { AppTransaction } from "@/app/dashboard/types";
import { getUserWithToken } from "@/server/session";
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

export const formatCurrency = (value) => {
  const roundedValue = Math.round(parseInt(value, 10));
  // Handle potential NaN if parsing fails
  if (isNaN(roundedValue)) {
    return "$--"; // Or some other placeholder
  }
  // Basic formatting, consider Intl.NumberFormat for more robust formatting
  return `${roundedValue < 0 ? "-" : ""}$${Math.abs(roundedValue)}`;
};
