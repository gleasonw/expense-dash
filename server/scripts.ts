import { db } from "@/server/db";
import { userTable } from "@/server/schema";

export async function clearCursor() {
  await db.update(userTable).set({ nextTransactionCursor: null });
}

process.exit(0);
