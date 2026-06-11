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

export type TagAllocationType = "percent" | "fixed";

type TagAllocationInput = {
  tag_id: string;
  allocation: string;
  allocationType?: TagAllocationType;
};

function cleanAllocationInput({
  tag_id,
  allocation,
  allocationType = "percent",
}: TagAllocationInput): TagAllocationInput {
  const numericAllocation = Number(allocation);
  if (!tag_id || !Number.isFinite(numericAllocation) || numericAllocation < 0) {
    throw new Error("Invalid allocation");
  }

  if (allocationType !== "percent" && allocationType !== "fixed") {
    throw new Error("Invalid allocation type");
  }

  return { tag_id, allocation, allocationType };
}

export async function updateTag(tag: UpdateTag) {
  const user = await getUserWithTokenThrows();
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
  upsertTag: Omit<TagAllocationUpsert, "user_id" | "allocationType"> & {
    allocationType?: TagAllocationType;
  }
) {
  const user = await getUserWithTokenThrows();
  const allocation = cleanAllocationInput(upsertTag);
  const result = await db
    .insert(tagAllocationsNew)
    .values({
      ...allocation,
      user_id: user.user.id,
    })
    .onConflictDoUpdate({
      target: [tagAllocationsNew.user_id, tagAllocationsNew.tag_id],
      set: {
        allocation: sql`excluded.allocation`,
        allocationType: sql`excluded.allocation_type`,
      },
    })
    .returning();
  revalidatePath(`/dashboard`);
  return result;
}

export async function updateAllocationForTag({
  tagId,
  allocation,
  allocationType,
}: {
  tagId: string;
  allocation: string;
  allocationType: TagAllocationType;
}) {
  const user = await getUserWithTokenThrows();
  const cleanAllocation = cleanAllocationInput({
    tag_id: tagId,
    allocation,
    allocationType,
  });
  await db
    .insert(tagAllocationsNew)
    .values({
      ...cleanAllocation,
      user_id: user.user.id,
    })
    .onConflictDoUpdate({
      target: [tagAllocationsNew.user_id, tagAllocationsNew.tag_id],
      set: {
        allocation: sql`excluded.allocation`,
        allocationType: sql`excluded.allocation_type`,
      },
    });
  revalidatePath(`/dashboard`);
  return;
}

export async function deleteAllocationForTag(tagId: string) {
  const user = await getUserWithTokenThrows();
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
