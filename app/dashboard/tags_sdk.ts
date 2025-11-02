import { db } from "@/server/db";
import { tags_new } from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { eq } from "drizzle-orm";
import { cache } from "react";

export const allUserTags = cache(async function allUserTags() {
  const user = await getUserWithTokenThrows();
  if (user === "no-plaid-account") {
    return [];
  }
  return await db.query.tags_new.findMany({
    where: eq(tags_new.userId, user.user.id),
  });
});
