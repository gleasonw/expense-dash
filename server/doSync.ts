import { syncTransactionContext } from "@/server/effectContext";
import { syncUsersPlaidTransactions } from "@/server/syncPlaidTransactions";
import { Effect } from "effect";

const runnable = Effect.provide(
  syncUsersPlaidTransactions,
  syncTransactionContext
).pipe(
  Effect.catchAll((e) => {
    console.error("Error syncing transactions:", e);
    return Effect.logError(e);
  })
);

Effect.runFork(runnable);
