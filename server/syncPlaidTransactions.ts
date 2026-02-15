import { toAppTransaction } from "@/app/dashboard/transaction_utils";
import {
  PlaidService,
  TransactionsService,
  UsersService,
} from "@/server/effectServices";
import { Console, Effect } from "effect";

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
        yield* transactionsService.insertTransactions(newTransactions, u.id);
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
