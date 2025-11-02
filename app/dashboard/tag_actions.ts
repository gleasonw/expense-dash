"use server";

import { db } from "@/server/db";
import {
  tagAllocationsNew,
  TagAllocationUpsert,
  tags_new,
  UpdateTag,
} from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateTag(tag: UpdateTag) {
  const user = await getUserWithTokenThrows();
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

export async function createAllocationForTag(
  upsertTag: Omit<TagAllocationUpsert, "user_id">
) {
  const user = await getUserWithTokenThrows();
  if (user === "no-plaid-account") {
    return;
  }
  const result = await db
    .insert(tagAllocationsNew)
    .values({
      ...upsertTag,
      user_id: user.user.id,
    })
    .returning();
  revalidatePath(`/dashboard`);
  return result;
}

export async function deleteAllocationForTag(tagId: string) {
  const user = await getUserWithTokenThrows();
  if (user === "no-plaid-account") {
    return;
  }
  await db
    .delete(tagAllocationsNew)
    .where(
      and(
        eq(tagAllocationsNew.tag_id, tagId),
        eq(tagAllocationsNew.user_id, user.user.id)
      )
    );
  revalidatePath(`/dashboard`);
  return;
}
