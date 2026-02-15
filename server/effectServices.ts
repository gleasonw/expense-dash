import { AppTransaction } from "@/app/dashboard/types";
import { plaidAccount, transactions, User } from "@/server/schema";
import { TransactionsSyncResponse } from "plaid";
import { Context, Effect } from "effect";

export class UsersService extends Context.Tag("UsersService")<
  UsersService,
  {
    readonly getUsers: () => Effect.Effect<
      Array<User & { plaidAccounts: (typeof plaidAccount.$inferSelect)[] }>,
      Error
    >;
    readonly updateUser: (
      id: number,
      newUser: User
    ) => Effect.Effect<User, Error>;
  }
>() {}

export class TransactionsService extends Context.Tag("TransactionsService")<
  TransactionsService,
  {
    readonly insertTransactions: (
      toAdd: AppTransaction[],
      userId: number
    ) => Effect.Effect<(typeof transactions.$inferInsert)[], Error>;
  }
>() {}

export class PlaidService extends Context.Tag("PlaidService")<
  PlaidService,
  {
    readonly latestTransactions: (args: {
      access_token: string;
      cursor?: string;
      count: number;
    }) => Effect.Effect<TransactionsSyncResponse, Error>;
  }
>() {}
