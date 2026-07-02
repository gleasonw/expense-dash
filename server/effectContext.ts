import { db } from "@/server/db";
import {
  PlaidService,
  TransactionsService,
  UsersService,
} from "@/server/effectServices";
import { plaidClient } from "@/server/plaid";
import { transactions, userTable } from "@/server/schema";
import { eq } from "drizzle-orm";
import { Context, Effect } from "effect";

export const syncTransactionContext = Context.empty().pipe(
  Context.add(UsersService, {
    getUsers: () =>
      Effect.tryPromise(() => {
        return db.query.userTable.findMany({
          with: {
            plaidAccounts: true,
          },
        });
      }),
    updateUser: (id, newUser) =>
      Effect.tryPromise(async () => {
        const res = await db
          .update(userTable)
          .set(newUser)
          .where(eq(userTable.id, id))
          .returning();
        const updatedUser = res[0];
        if (!updatedUser) {
          throw new Error("User not found");
        }
        return updatedUser;
      }),
  }),
  Context.add(PlaidService, {
    latestTransactions: ({ access_token, cursor, count }) =>
      Effect.tryPromise(async () => {
        const res = await plaidClient.transactionsSync({
          access_token,
          cursor,
          count,
        });
        if (res.status !== 200) {
          throw new Error(`Plaid API error: ${res.status} - ${res.statusText}`);
        }
        return res.data;
      }),
  }),
);
