import { YyyyMm } from "@/app/utils/dates";
import { getFilterConditions } from "@/app/utils/transactions_querys";
import { db } from "@/server/db";
import {
  tagAllocationsNew,
  tags_new,
  tagsLinkNew,
  transactions,
} from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { and, asc, eq, exists, inArray, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

type SpendingByMonthArgs = {
  afterXMonthsAgo?: number;
  excludeTags?: string[];
  matchDepth?: number;
};

// TODO: clean this up... very closet drawer
export async function getMonthTargetForTag(tag: string) {
  const user = await getUserWithTokenThrows();
  const thisAndLastMonthSpending = await getSpendingByMonth({
    afterXMonthsAgo: 1,
  });

  //TODO: this is a bit klunky, need to figure out a more expressive API
  const lastMonthIncome = thisAndLastMonthSpending?.reduce((acc, rows) => {
    const rowMonth = new Date(rows.month);
    const currentDate = new Date();
    console.log({
      rowMonth: rowMonth.getUTCMonth(),
      currentDate: currentDate.getUTCMonth(),
    });
    if (
      rows.tag !== "income" ||
      (rowMonth.getFullYear() === currentDate.getFullYear() &&
        rowMonth.getUTCMonth() === currentDate.getUTCMonth())
    ) {
      return acc;
    }
    return acc + parseFloat(rows.amount);
  }, 0);

  const fullTag = await db.query.tags_new.findFirst({
    where: (tags_new, { eq }) =>
      and(eq(tags_new.tag, tag), eq(tags_new.userId, user.user.id)),
  });

  if (!fullTag) {
    console.error(`Tag not found: ${tag}`);
    return null;
  }

  const tagAllocation = await db.query.tagAllocationsNew.findFirst({
    where: (tagAllocationsNew, { eq }) =>
      eq(tagAllocationsNew.tag_id, fullTag.id) &&
      eq(tagAllocationsNew.user_id, user.user.id),
  });

  if (!tagAllocation) {
    console.error(`Tag allocation not found for tag: ${tag}`);
    return null;
  }

  const allocationPercent = parseFloat(tagAllocation.allocation) / 100;

  return {
    fullTag,
    lastMonthIncome,
    tagAllocation,
    target: (lastMonthIncome ?? 0) * allocationPercent * -1,
  };
}

export async function getSpendingByMonth(args?: SpendingByMonthArgs) {
  return spendingByMonthForUser(args);
}

export type SpendingRow = {
  month: string;
  amount: string;
  tag: string;
  tag_id: string | null;
  color: string | null;
  tagAllocation: string | null;
  depth: number;
};

export function monthSpending({
  monthUTC,
  excludeTags,
  forPastXMonths,
  atDepth,
}: {
  monthUTC?: YyyyMm;
  forPastXMonths?: number;
  excludeTags?: Array<string>;
  atDepth?: number;
}): Promise<Array<SpendingRow>> {
  return cache(async () => {
    const user = await getUserWithTokenThrows();
    if (forPastXMonths && monthUTC) {
      throw new Error("Cannot specify both monthUTC and forPastXMonths");
    }
    const filterConditions = getFilterConditions({
      monthUTC,
      excludeTags,
      afterXMonthsAgo: forPastXMonths,
    });

    // Use one alias consistently for the tags table.
    const T = alias(tags_new, "t");

    // subtree excludes (node + descendants) applied ONCE at line_items stage
    const subtreeExcludes =
      excludeTags && excludeTags.length
        ? excludeTags.map(
            (p) => sql`NOT (${T.tag} = ${p} OR ${T.tag} LIKE ${p + "/"} || '%')`
          )
        : [];

    // 1) Line-items at full tag granularity (keep full path)
    const lineItems = db.$with("line_items").as(
      db
        .select({
          month: sql<string>`DATE_TRUNC('month', ${transactions.date}) as month`,
          amount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC)) as amount`,
          full_tag: sql<string>`T.tag as full_tag`,
        })
        .from(transactions)
        .innerJoin(
          tagsLinkNew,
          eq(transactions.transaction_id, tagsLinkNew.transaction_id)
        )
        .innerJoin(T, eq(tagsLinkNew.tag_id, T.id))
        .where(
          and(
            eq(transactions.user_id, user.user.id),
            ...filterConditions,
            ...subtreeExcludes
          )
        )
        .groupBy(sql`DATE_TRUNC('month', ${transactions.date}), ${T.tag}`)
    );

    // 2) Fan-out ancestors: a/b/c -> a, a/b, a/b/c
    // @ts-expect-error Drizzle typing issue with generate_series
    const ancestors = db.$with("ancestors").as(sql`
      SELECT
        li.month,
        li.amount,
        array_to_string((regexp_split_to_array(li.full_tag, '/'))[1:gs], '/') AS bucket_tag,
        gs AS depth
      FROM ${lineItems} li
      CROSS JOIN LATERAL generate_series(
        1, cardinality(regexp_split_to_array(li.full_tag, '/'))
      ) AS gs
    `);

    return await db
      .with(lineItems, ancestors)
      .select({
        month: sql<string>`a.month`,
        amount: sql<string>`SUM(a.amount)`,
        tag: sql<string>`a.bucket_tag`,
        tag_id: sql<string | null>`t.id`,
        color: sql<string | null>`t.color`,
        tagAllocation: sql<string | null>`tag_allocations_new.allocation`,
        depth: sql<number>`MIN(a.depth)`,
      })
      .from(sql`ancestors a`)
      .leftJoin(T, eq(sql`a.bucket_tag`, sql`t.tag`))
      .leftJoin(tagAllocationsNew, eq(tagAllocationsNew.tag_id, sql`t.id`))
      .groupBy(
        sql`a.month, a.bucket_tag, t.id, t.color, tag_allocations_new.allocation`
      )
      .having(sql`MIN(a.depth) <= ${atDepth ?? 100}`)
      .orderBy(sql`a.month, a.bucket_tag`);
  })();
}

const spendingByMonthForUser = cache(
  async ({
    afterXMonthsAgo,
    excludeTags,
    matchDepth,
  }: SpendingByMonthArgs = {}) => {
    const user = await getUserWithTokenThrows();
    const filterConditions = getFilterConditions({
      excludeTags,
      afterXMonthsAgo,
    });
    console.log({ filterConditions });
    const spendingByMonth = db.$with("spending_by_month").as(
      db
        .select({
          month: sql<string>`DATE_TRUNC('month', ${transactions.date})`.as(
            "month"
          ),
          amount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`.as(
            "amount"
          ),
          tag: tags_new.tag,
          tag_id: tags_new.id,
          color: tags_new.color,
          depth:
            sql<number>`cardinality(regexp_split_to_array(${tags_new.tag}, '/'))`.as(
              "depth"
            ),
        })
        .from(transactions)
        .innerJoin(
          tagsLinkNew,
          eq(transactions.transaction_id, tagsLinkNew.transaction_id)
        )
        .innerJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
        .where(and(eq(transactions.user_id, user.user.id), ...filterConditions))
        .groupBy(
          sql`DATE_TRUNC('month', ${transactions.date}), ${tags_new.id}, ${tags_new.label}`
        )
        .orderBy(
          sql`DATE_TRUNC('month', ${transactions.date}), ${tags_new.label}, ${tags_new.id}`
        )
    );
    return await db
      .with(spendingByMonth)
      .select()
      .from(spendingByMonth)
      .where(sql`depth <= ${matchDepth ?? 100}`);
  }
);

export const getIncomeByMonth = cache(
  async (): Promise<{
    rows: { month: string; amount: string; tag: string }[];
  } | null> => {
    const user = await getUserWithTokenThrows();
    return (await db.execute(
      sql`
    SELECT
      DATE_TRUNC('month', t.date) AS month,
      SUM(CAST(t.amount AS NUMERIC)) AS amount,
      tv.tag
    FROM
        transactions t
    JOIN
        tags_link_new tl ON t.transaction_id = tl.transaction_id
    JOIN
        tags_v2 tv ON tl.tag_id = tv.id
    WHERE
        t.user_id = ${user.user.id}
        AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND tv.tag = 'income'
    GROUP BY
        DATE_TRUNC('month', t.date), tv.tag
    ORDER BY
        month;
`
    )) as { rows: { month: string; amount: string; tag: string }[] };
  }
);

export const getNetSpendingByMonth = cache(
  async (args?: { monthUTC?: YyyyMm; pastXMonths?: number }) => {
    if (args?.monthUTC && args?.pastXMonths) {
      throw new Error("Cannot specify both monthUTC and pastXMonths");
    }
    const user = await getUserWithTokenThrows();
    const filterConditions = getFilterConditions({
      monthUTC: args?.monthUTC,
      afterXMonthsAgo: args?.pastXMonths,
    });
    const incomeSubquery = db
      .select({
        month: sql<string>`DATE_TRUNC('month', ${transactions.date})`.as(
          "month"
        ),
        total_income:
          sql<number>`SUM(CAST(${transactions.amount} AS NUMERIC)) * -1`.as(
            "total_income"
          ),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.user_id, user.user.id),
          exists(
            db
              .select({ one: sql`1` })
              .from(tagsLinkNew)
              .innerJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
              .where(
                and(
                  eq(tagsLinkNew.transaction_id, transactions.transaction_id),
                  eq(tags_new.tag, "income")
                )
              )
          ),
          ...filterConditions
        )
      )
      .groupBy(sql`DATE_TRUNC('month', ${transactions.date})`)
      .as("mi");

    const spendSubquery = db
      .select({
        month: sql<string>`DATE_TRUNC('month', ${transactions.date})`.as(
          "month"
        ),
        total_spending:
          sql<number>`SUM(CAST(${transactions.amount} AS NUMERIC)) * -1`.as(
            "total_spending"
          ),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.user_id, user.user.id),
          notExists(
            db
              .select({ one: sql`1` })
              .from(tagsLinkNew)
              .innerJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
              .where(
                and(
                  eq(tagsLinkNew.transaction_id, transactions.transaction_id),
                  //Maybe reconsider, currently this means that as soon as a transaction
                  // gets an income or transfer tag, it's excluded
                  inArray(tags_new.tag, ["income", "transfer"])
                )
              )
          ),
          ...filterConditions
        )
      )
      .groupBy(sql`DATE_TRUNC('month', ${transactions.date})`)
      .as("ms");

    return await db
      .select({
        // oddly, drizzle won't auto alias, so to avoid ambiguity we have to manually alias
        // https://github.com/drizzle-team/drizzle-orm/issues/2772
        month: sql<string>`COALESCE(mi.month, ms.month) as month`,
        total_income: sql<string>`COALESCE(mi.total_income, 0) as total_income`,
        total_spending: sql<string>`COALESCE(ms.total_spending, 0) as total_spending`,
        net_amount: sql<string>`
    COALESCE(mi.total_income, 0)
    + COALESCE(ms.total_spending, 0) as net_amount
  `,
      })
      .from(incomeSubquery)
      .fullJoin(spendSubquery, eq(sql`mi.month`, sql`ms.month`))
      .orderBy(asc(sql`COALESCE(mi.month, ms.month)`));
  }
);
