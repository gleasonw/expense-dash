import { db } from "@/server/db";
import { User } from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { and, sql } from "drizzle-orm";
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

const spendingByMonthForUser = cache(
  async (
    user: User,
    { afterXMonthsAgo }: SpendingByMonthArgs = {}
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

export const getNetSpendingByMonth = cache(async () => {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return { rows: [] };
  }
  return (await db.execute(`
     WITH monthly_income AS (
      -- Calculate total income per month
      SELECT
        DATE_TRUNC('month', t.date) AS month,
        SUM(CAST(t.amount AS NUMERIC)) * -1 AS total_income
      FROM
        transactions t
      JOIN tags_link_new tl ON t.transaction_id = tl.transaction_id
      JOIN tags_v2 tv ON tl.tag_id = tv.id
      WHERE
        t.user_id = ${user.user.id}
        AND tv.tag = 'income' -- Only include transactions tagged as 'income'
      GROUP BY
        DATE_TRUNC('month', t.date)
    ), monthly_spending AS (
      -- Calculate total spending per month (your original query logic)
      SELECT
        DATE_TRUNC('month', t.date) AS month,
        SUM(CAST(t.amount AS NUMERIC)) AS total_spending
      FROM
        transactions t
      WHERE
        t.user_id = ${user.user.id}
        AND t.transaction_id IN (
          SELECT DISTINCT tl.transaction_id
          FROM tags_link_new tl
          JOIN tags_v2 tv ON tl.tag_id = tv.id
          WHERE tv.tag NOT IN ('income', 'transfer') -- Exclude income & transfers
        )
      GROUP BY
        DATE_TRUNC('month', t.date)
    )
    -- Combine income and spending, calculate net
    SELECT
      COALESCE(mi.month, ms.month) AS month, -- Use COALESCE in case a month has only income or only spending
      COALESCE(mi.total_income, 0) AS total_income,
      COALESCE(ms.total_spending, 0) AS total_spending,
      (COALESCE(mi.total_income, 0) - COALESCE(ms.total_spending, 0)) AS net_amount
    FROM
      monthly_income mi
    FULL OUTER JOIN -- Use FULL OUTER JOIN to include months with only income or only spending
      monthly_spending ms ON mi.month = ms.month
    ORDER BY
      month ASC;
`)) as {
    rows: {
      month: string;
      total_income: string;
      total_spending: string;
      net_amount: string;
    }[];
  };
});
