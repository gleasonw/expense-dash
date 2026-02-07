import {
  createAutoTag,
  createTag,
  deleteAutoTag,
  deleteTag,
} from "@/app/dashboard/actions";
import { AutoTagAutocompleteInput } from "@/app/dashboard/AutoTagAutocompleteInput";
import { TagColorPicker } from "@/app/dashboard/TagColorPicker";
import { db } from "@/server/db";
import {
  auto_tag_merchants_new,
  Tag,
  tags_new,
  transactions,
} from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";

const MAX_SUGGESTIONS = 20;
const MIN_QUERY_LENGTH = 2;

type TagsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function normalizeSearchParam(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const user = await getUserWithTokenThrows();
  const transactionQuery = normalizeSearchParam(
    searchParams?.transaction
  ).trim();
  const merchantQuery = normalizeSearchParam(searchParams?.merchant).trim();
  const transactionLike =
    transactionQuery.length >= MIN_QUERY_LENGTH
      ? `%${escapeLike(transactionQuery)}%`
      : null;
  const merchantLike =
    merchantQuery.length >= MIN_QUERY_LENGTH
      ? `%${escapeLike(merchantQuery)}%`
      : null;

  const [userTags, autoTags, transactionNameRows, merchantNameRows] =
    await Promise.all([
    db
      .select()
      .from(tags_new)
      .where(eq(tags_new.userId, user.user.id))
      .orderBy(asc(tags_new.label)),
    db
      .select({
        id: auto_tag_merchants_new.id,
        name: auto_tag_merchants_new.name,
        merchantName: auto_tag_merchants_new.merchant_name,
        tagId: auto_tag_merchants_new.tag_id,
        tagLabel: tags_new.label,
        tagColor: tags_new.color,
      })
      .from(auto_tag_merchants_new)
      .innerJoin(tags_new, eq(auto_tag_merchants_new.tag_id, tags_new.id))
      .where(eq(auto_tag_merchants_new.user_id, user.user.id))
      .orderBy(asc(auto_tag_merchants_new.name)),
    db
      .select({ name: transactions.name })
      .from(transactions)
      .where(
        and(
          eq(transactions.user_id, user.user.id),
          ne(transactions.name, ""),
          ...(transactionLike
            ? [
                sql`${transactions.name} ILIKE ${transactionLike} ESCAPE '\\'`,
              ]
            : [])
        )
      )
      .groupBy(transactions.name)
      .orderBy(asc(transactions.name))
      .limit(MAX_SUGGESTIONS),
    db
      .select({ merchantName: transactions.merchant_name })
      .from(transactions)
      .where(
        and(
          eq(transactions.user_id, user.user.id),
          isNotNull(transactions.merchant_name),
          ne(transactions.merchant_name, ""),
          ...(merchantLike
            ? [
                sql`${transactions.merchant_name} ILIKE ${merchantLike} ESCAPE '\\'`,
              ]
            : [])
        )
      )
      .groupBy(transactions.merchant_name)
      .orderBy(asc(transactions.merchant_name))
      .limit(MAX_SUGGESTIONS),
  ]);

  const transactionNameSuggestions = transactionNameRows.map(({ name }) => name);
  const merchantNameSuggestions = merchantNameRows
    .map(({ merchantName }) => merchantName)
    .filter((merchantName): merchantName is string => Boolean(merchantName));
  return (
    <div className="flex flex-col gap-5 p-5 max-w-5xl mx-auto">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Tags</h2>
        <TagMaker />
        <div className="flex flex-wrap gap-5">
          {userTags.map((tag) => (
            <TagCard key={tag.id} tag={tag} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Auto tags</h2>
          <p className="text-sm text-gray-500">
            Automatically tag matching transactions by name or merchant.
          </p>
        </div>
        <AutoTagMaker
          tags={userTags}
          transactionNameSuggestions={transactionNameSuggestions}
          merchantNameSuggestions={merchantNameSuggestions}
        />
        <div className="flex flex-col gap-3">
          {autoTags.length === 0 ? (
            <p className="text-sm text-gray-500">No auto tags yet.</p>
          ) : (
            autoTags.map((autoTag) => (
              <AutoTagCard key={autoTag.id} autoTag={autoTag} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

async function TagMaker() {
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

async function AutoTagMaker({
  tags,
  transactionNameSuggestions,
  merchantNameSuggestions,
}: {
  tags: Tag[];
  transactionNameSuggestions: string[];
  merchantNameSuggestions: string[];
}) {
  return (
    <form action={createAutoTag} className="flex flex-wrap gap-3 items-end">
      <AutoTagAutocompleteInput
        label="Transaction name"
        name="name"
        placeholder="e.g. Starbucks"
        queryParam="transaction"
        suggestions={transactionNameSuggestions}
        required
      />
      <AutoTagAutocompleteInput
        label="Merchant name (optional)"
        name="merchantName"
        placeholder="Merchant name"
        queryParam="merchant"
        suggestions={merchantNameSuggestions}
      />
      <label className="flex flex-col text-sm gap-1">
        Tag
        <select
          name="tagId"
          className="border rounded-md px-2 py-1 shadow-xs"
          required
        >
          <option value="" disabled>
            Select a tag
          </option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="p-2 border hover:bg-gray-200">
        Add auto tag
      </button>
    </form>
  );
}

function AutoTagCard({
  autoTag,
}: {
  autoTag: {
    id: number;
    name: string;
    merchantName: string | null;
    tagId: string;
    tagLabel: string;
    tagColor: string;
  };
}) {
  const deleteAutoTagWithId = deleteAutoTag.bind(null, {
    autoTagId: autoTag.id,
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 shadow-xs">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">{autoTag.name}</div>
        {autoTag.merchantName ? (
          <div className="text-xs text-gray-500">
            Merchant: {autoTag.merchantName}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full bg-${autoTag.tagColor}-500`}
          ></span>
          <span>{autoTag.tagLabel}</span>
        </div>
        <form action={deleteAutoTagWithId}>
          <button
            type="submit"
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
