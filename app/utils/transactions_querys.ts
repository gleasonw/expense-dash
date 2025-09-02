import * as dateUtils from "@/app/utils/dates";
import { transactions } from "@/server/schema";
import { gte, lt } from "drizzle-orm";

export function getFilterConditions(
  filters: { monthUTC?: dateUtils.YyyyMm } | undefined
) {
  const filterConditions = [];
  if (filters?.monthUTC) {
    const { start, end } = dateUtils.monthRangeUTC(filters.monthUTC);
    filterConditions.push(gte(transactions.date, start.toISOString()));
    filterConditions.push(lt(transactions.date, end.toISOString()));
  }
  return filterConditions;
}
