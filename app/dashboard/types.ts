import { tags_new } from "@/server/schema";
import { Transaction } from "plaid";

export type TransactionTag = typeof tags_new.$inferSelect;

export type MonthSpendingRow = {
  month: string;
  amount: string;
  tag: string;
  tag_id: string;
};

// we're casting amount to number due to some drizzle reason
export type AppTransaction = Transaction & { amount: string };
