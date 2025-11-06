import { createTag, deleteTag } from "@/app/dashboard/actions";
import { TagColorPicker } from "@/app/dashboard/TagColorPicker";
import { db } from "@/server/db";
import { Tag, tags_new } from "@/server/schema";
import { getUserWithToken } from "@/server/session";
import { eq, asc } from "drizzle-orm";

export default async function TagsPage() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>Please connect your bank account to use this feature.</div>;
  }
  const userTags = await db
    .select()
    .from(tags_new)
    .where(eq(tags_new.userId, user.user.id))
    .orderBy(asc(tags_new.label));
  return (
    <div className="flex flex-col gap-5 p-5 max-w-5xl mx-auto">
      <TagMaker />
      <div className="flex flex-wrap gap-5">
        {userTags.map((tag) => (
          <TagCard key={tag.id} tag={tag} />
        ))}
      </div>
    </div>
  );
}

async function TagMaker() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return <div>no plaid</div>;
  }

  return (
    <form action={createTag} className="flex gap-3">
      <input
        name="tag"
        type="text"
        className="border rounded-md shadow-xs"
        placeholder="tag"
      />

      <button type="submit" className="p-2 border hover:bg-gray-200">
        Create
      </button>
    </form>
  );
}

function TagCard({ tag }: { tag: Tag }) {
  const deleteTagWithId = deleteTag.bind(null, { tagId: tag.id });

  return (
    <div className="flex items-center gap-4 rounded-md border p-4 shadow-xs">
      <TagColorPicker tag={tag} />
      <form action={deleteTagWithId}>
        <button
          type="submit"
          className="text-sm font-medium text-red-600 hover:text-red-700"
        >
          Delete
        </button>
      </form>
    </div>
  );
}
