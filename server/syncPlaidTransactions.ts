import { toAppTransaction } from "@/app/dashboard/transaction_utils";
import { db } from "@/server/db";
import {
  PlaidService,
  TransactionsService,
  UsersService,
} from "@/server/effectServices";
import { auto_tag_merchants_new, tagsLinkNew } from "@/server/schema";
import { eq } from "drizzle-orm";
import { Console, Effect } from "effect";

function normalizeAutoTagValue(value?: string | null) {
  return value?.trim().toLowerCase();
}

function getPreferredAutoTag(
  matches: {
    id: number;
    name: string;
    merchant_name?: string | null;
    tag_id: string;
  }[]
) {
  if (matches.length === 0) {
    return undefined;
  }

  return matches
    .slice()
    .sort((a, b) => {
      const specificityDiff =
        Number(!!b.merchant_name) - Number(!!a.merchant_name);
      if (specificityDiff !== 0) {
        return specificityDiff;
      }
      return a.id - b.id;
    })[0];
}

async function autoTagIncomingTransactionsForUser(
  userId: number,
  incomingTransactions: {
    transaction_id: string;
    name: string;
    merchant_name?: string | null;
  }[]
) {
  if (incomingTransactions.length === 0) {
    return;
  }

  const autoTags = await db
    .select()
    .from(auto_tag_merchants_new)
    .where(eq(auto_tag_merchants_new.user_id, userId));

  if (autoTags.length === 0) {
    return;
  }

  const tagLinksToInsert = incomingTransactions.reduce(
    (acc, transaction) => {
      const normalizedName = normalizeAutoTagValue(transaction.name);
      const normalizedMerchantName = normalizeAutoTagValue(
        transaction.merchant_name
      );

      const matches = autoTags.filter((autoTag) => {
        const ruleName = normalizeAutoTagValue(autoTag.name);
        const ruleMerchantName = normalizeAutoTagValue(autoTag.merchant_name);
        if (!ruleName || normalizedName !== ruleName) {
          return false;
        }
        if (!ruleMerchantName) {
          return true;
        }
        return normalizedMerchantName === ruleMerchantName;
      });

      const preferredTag = getPreferredAutoTag(matches);
      if (!preferredTag) {
        return acc;
      }

      acc.push({
        transaction_id: transaction.transaction_id,
        tag_id: preferredTag.tag_id,
      });
      return acc;
    },
    [] as { transaction_id: string; tag_id: string }[]
  );

  if (tagLinksToInsert.length === 0) {
    return;
  }

  await db.insert(tagsLinkNew).values(tagLinksToInsert).onConflictDoNothing();
}

export const syncUsersPlaidTransactions = Effect.gen(function* () {
  const usersService = yield* UsersService;
  const transactionsService = yield* TransactionsService;
  const plaidService = yield* PlaidService;
  const users = yield* usersService.getUsers();

  yield* Console.log(`syncing transactions for ${users.length} users`);

  yield* Effect.forEach(
    users,
    (u) =>
      Effect.gen(function* () {
        yield* Console.log(`syncing user ${u.name}`);
        const account = u.plaidAccounts.at(0);
        if (!account) {
          return;
        }
        yield* Console.log(`syncing account ${account.id}`);
        const latestTransactions = yield* plaidService.latestTransactions({
          access_token: account.access_token,
          count: 500,
          cursor: u.nextTransactionCursor ?? undefined,
        });
        const newTransactions = toAppTransaction(latestTransactions.added);
        const insertedTransactions = yield* transactionsService.insertTransactions(
          newTransactions,
          u.id
        );

        yield* Effect.tryPromise(() =>
          autoTagIncomingTransactionsForUser(
            u.id,
            insertedTransactions.map((t) => ({
              transaction_id: t.transaction_id,
              name: t.name,
              merchant_name: t.merchant_name,
            }))
          )
        );

        yield* usersService.updateUser(u.id, {
          ...u,
          nextTransactionCursor: latestTransactions.next_cursor,
        });
      }),
    {
      concurrency: 5,
    }
  );
});
