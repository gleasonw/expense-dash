import { YyyyMm } from "@/app/utils/dates";
import { getFilterConditions } from "@/app/utils/transactions_querys";
import { db } from "@/server/db";
import {
  tagAllocationsNew,
  tags_new,
  tagsLinkNew,
  transactions,
  User,
} from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { and, asc, eq, exists, inArray, notExists, sql } from "drizzle-orm";
import { cache } from "react";

type MonthAggregate = {
  month: string;
  amount: string;
  tag: string;
  tag_id: string;
  is_current_month: boolean;
};

type SpendingByMonthArgs = {
  afterXMonthsAgo?: number;
  excludeTags?: string[];
};

// TODO: clean this up... very closet drawer
export async function getMonthTargetForTag(tag: string) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return null;
  }
  const thisAndLastMonthSpending = await getSpendingByMonth({
    afterXMonthsAgo: 1,
  });

  console.log({ thisAndLastMonthSpending });

  //TODO: this is a bit klunky, need to figure out a more expressive API
  const lastMonthIncome = thisAndLastMonthSpending.rows.reduce((acc, rows) => {
    if (rows.tag !== "income" || rows.is_current_month) {
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
    target: lastMonthIncome * allocationPercent * -1,
  };
}

export async function getSpendingByMonth(args?: SpendingByMonthArgs): Promise<{
  rows: MonthAggregate[];
}> {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return { rows: [] };
  }
  return spendingByMonthForUser(user.user, args);
}

export const spendingForMonth = cache(
  async ({
    monthUTC,
    excludeTags,
  }: {
    monthUTC?: YyyyMm;
    excludeTags?: string[];
  }) => {
    const user = await getUserWithToken();
    if (user === "no-plaid-account") {
      return null;
    }
    const filterConditions = getFilterConditions({ monthUTC, excludeTags });
    return await db
      .select({
        month: sql<string>`DATE_TRUNC('month', ${transactions.date}) as month`,
        amount: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
        tag: tags_new.tag,
        tag_id: tags_new.id,
        color: tags_new.color,
      })
      .from(transactions)
      .innerJoin(
        tagsLinkNew,
        eq(transactions.transaction_id, tagsLinkNew.transaction_id)
      )
      .innerJoin(tags_new, eq(tagsLinkNew.tag_id, tags_new.id))
      .where(and(eq(transactions.user_id, user.user.id), ...filterConditions))
      .groupBy(sql`DATE_TRUNC('month', ${transactions.date}), tags_v2.id`)
      .orderBy(
        sql`DATE_TRUNC('month', ${transactions.date}), tags_v2.label, tags_v2.id`
      );
  }
);

// TODO: sql injection?
const spendingByMonthForUser = cache(
  async (
    user: User,
    { afterXMonthsAgo, excludeTags }: SpendingByMonthArgs = {}
  ): Promise<{
    rows: MonthAggregate[];
  }> => {
    return (await db.execute(
      sql.raw(`
      SELECT
          DATE_TRUNC('month', t.date) AS month,
          SUM(CAST(t.amount AS NUMERIC)) AS amount,
          tv.tag,
          tv.id as tag_id,
          CASE
              WHEN DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE)
              THEN TRUE
              ELSE FALSE
          END AS is_current_month
      FROM
          transactions t
      JOIN
          tags_link_new tl ON t.transaction_id = tl.transaction_id
      JOIN
          tags_v2 tv ON tl.tag_id = tv.id
      WHERE
          t.user_id = ${user.id}
          AND DATE_TRUNC('month', t.date) >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${
            afterXMonthsAgo ?? 12
          } months')
          ${
            excludeTags && excludeTags.length > 0
              ? `AND tv.tag NOT IN (${excludeTags
                  .map((tag) => `'${tag}'`)
                  .join(", ")})`
              : ""
          }
      GROUP BY
          DATE_TRUNC('month', t.date), tv.id
      ORDER BY
          month;
    `)
    )) as {
      rows: {
        month: string;
        amount: string;
        tag: string;
        tag_id: string;
        is_current_month: boolean;
      }[];
    };
  }
);

export const getIncomeByMonth = cache(
  async (): Promise<{
    rows: { month: string; amount: string; tag: string }[];
  } | null> => {
    const user = await getUserWithToken();
    if (user === "no-plaid-account") {
      return null;
    }
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
  async (args: { monthUTC: YyyyMm }) => {
    const user = await getUserWithToken();
    if (user === "no-plaid-account") {
      return [];
    }
    const filterConditions = getFilterConditions(args);
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
