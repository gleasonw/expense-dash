import * as dateUtils from "@/app/utils/dates";
import { db } from "@/server/db";
import { tags_new, tagsLinkNew, transactions } from "@/server/schema";
import { and, eq, exists, gte, inArray, lt, notExists, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export function tagMatchesSubtree(tagColumn: AnyPgColumn, tag: string) {
  return sql`(${tagColumn} = ${tag} OR ${tagColumn} LIKE ${tag + "/"} || '%')`;
}

export function tagExcludesSubtree(tagColumn: AnyPgColumn, tag: string) {
  return sql`NOT (${tagMatchesSubtree(tagColumn, tag)})`;
}

export function tagFilter(tag: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(tagsLinkNew)
      .innerJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
      .where(
        and(
          eq(tagsLinkNew.transaction_id, transactions.transaction_id),
          tagMatchesSubtree(tags_new.tag, tag)
        )
      )
  );
}

/** filters expected to apply directly onto the transactions table */
export function getFilterConditions(
  filters:
    | {
        monthUTC?: dateUtils.YyyyMm;
        excludeTags?: string[];
        includeTag?: string;
        afterXMonthsAgo?: number;
      }
    | undefined
) {
  const filterConditions = [];
  if (filters?.monthUTC) {
    const { start, end } = dateUtils.monthRangeUTC(filters.monthUTC);
    console.log("filtering for month", filters.monthUTC, start, end);
    filterConditions.push(gte(transactions.date, start.toISOString()));
    filterConditions.push(lt(transactions.date, end.toISOString()));
  }
  if (filters?.includeTag) {
    // Positive filtering: only include transactions with this tag (or subtags)
    filterConditions.push(tagFilter(filters.includeTag));
  }
  if (filters?.excludeTags && filters.excludeTags.length > 0) {
    filterConditions.push(
      notExists(
        db
          .select({ one: sql`1` })
          .from(tagsLinkNew)
          .innerJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
          .where(
            and(
              eq(tagsLinkNew.transaction_id, transactions.transaction_id),
              inArray(tags_new.tag, filters.excludeTags)
            )
          )
      )
    );
  }
  if (filters?.afterXMonthsAgo !== undefined) {
    filterConditions.push(
      gte(
        transactions.date,
        sql`DATE_TRUNC('month', CURRENT_DATE - ${
          filters.afterXMonthsAgo ?? 0
        } * INTERVAL '1 month')`
      )
    );
  }
  return filterConditions;
}
