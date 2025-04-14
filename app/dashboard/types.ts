import { tags_new } from "@/server/schema";

export type TransactionTag = typeof tags_new.$inferSelect;

export type MonthSpendingRow = {
  month: string;
  amount: string;
  tag: string;
  tag_id: string;
};
