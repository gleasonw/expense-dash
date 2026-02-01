import { syncUsersPlaidTransactions } from "@/server/syncPlaidTransactions";

syncUsersPlaidTransactions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
