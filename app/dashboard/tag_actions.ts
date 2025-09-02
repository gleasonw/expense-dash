"use server";

import { db } from "@/server/db";
import { tags_new, UpdateTag } from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateTag(tag: UpdateTag) {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return;
  }
  if (user.user.id !== tag.userId) {
    return;
  }
  await db
    .insert(tags_new)
    .values(tag)
    .onConflictDoUpdate({
      target: tags_new.id,
      set: { color: sql.raw(`excluded.${tags_new.color.name}`) },
    });
  revalidatePath(`/dashboard/tags`);
}
