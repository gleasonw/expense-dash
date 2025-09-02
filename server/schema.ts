import {
  decimal,
  varchar,
  date,
  jsonb,
  boolean,
  primaryKey,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  check,
} from "drizzle-orm/pg-core";
import {
  InferInsertModel,
  relations,
  sql,
  type InferSelectModel,
} from "drizzle-orm";
import { TransactionTag } from "@/app/dashboard/types";

export const transactions = pgTable("transactions", {
  account_id: text("account_id").notNull(),
  amount: text("amount").notNull(),
  iso_currency_code: varchar("iso_currency_code", { length: 3 }),
  unofficial_currency_code: varchar("unofficial_currency_code", {
    length: 255,
  }),
  category: text("category").array(),
  category_id: text("category_id"),
  check_number: varchar("check_number", { length: 255 }),
  date: date("date").notNull(),
  location: jsonb("location").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  merchant_name: varchar("merchant_name", { length: 255 }),
  original_description: text("original_description"),
  payment_meta: jsonb("payment_meta").notNull(),
  pending: boolean("pending").notNull(),
  pending_transaction_id: varchar("pending_transaction_id", { length: 255 }),
  account_owner: varchar("account_owner", { length: 255 }),
  transaction_id: text("transaction_id").primaryKey(),
  transaction_type: varchar("transaction_type", { length: 255 }),
  logo_url: varchar("logo_url", { length: 255 }),
  website: varchar("website", { length: 255 }),
  authorized_date: date("authorized_date"),
  authorized_datetime: timestamp("authorized_datetime", { withTimezone: true }),
  datetime: timestamp("datetime", { withTimezone: true }),
  payment_channel: varchar("payment_channel", { length: 255 }).notNull(),
  personal_finance_category: jsonb("personal_finance_category"),
  transaction_code: jsonb("transaction_code"),
  personal_finance_category_icon_url: varchar(
    "personal_finance_category_icon_url",
    { length: 255 }
  ),
  merchant_entity_id: varchar("merchant_entity_id", { length: 255 }),
  user_id: integer("user_id").references(() => userTable.id),
});

//TODO: remove old tag, tag allocation, tag link tables

export const auto_tag_merchants = pgTable("auto_tag_merchants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  merchant_name: varchar("merchant_name", { length: 255 }),
  tag: varchar("tag", { length: 255 })
    .references(() => tags.tag)
    .notNull(),
  user_id: integer("user_id").references(() => userTable.id),
  transaction_id: text("transaction_id").references(
    () => transactions.transaction_id
  ),
});

export const auto_tag_merchants_new = pgTable("auto_tag_merchants_new", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  merchant_name: varchar("merchant_name", { length: 255 }),
  tag_id: uuid("tag_id")
    .references(() => tags_new.id)
    .notNull(),
  user_id: integer("user_id").references(() => userTable.id),
  transaction_id: text("transaction_id").references(
    () => transactions.transaction_id
  ),
});

export type TransactionWithTags = InferSelectModel<typeof transactions> & {
  tags: TransactionTag[];
};

export const transactionsRelations = relations(transactions, ({ many }) => ({
  tagsLinks: many(tagsLink),
  tagsLinkNew: many(tagsLinkNew),
}));

export const tags = pgTable("tags", {
  tag: varchar("tag", { length: 255 }).primaryKey(),
});

export const tagsRelations = relations(tags, ({ many, one }) => ({
  tagsLinks: many(tagsLink),
  allocation: one(tagAllocations, {
    fields: [tags.tag],
    references: [tagAllocations.tag],
  }),
}));

export const tags_new = pgTable("tags_v2", {
  id: uuid("id").defaultRandom().primaryKey(),
  tag: varchar("tag", { length: 255 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  color: varchar("color", { length: 255 }).notNull(),
  userId: integer("user_id")
    .references(() => userTable.id)
    .notNull(),
});

export const tagsNewRelations = relations(tags_new, ({ many, one }) => ({
  tagsLinks: many(tagsLinkNew),
  allocation: one(tagAllocationsNew, {
    fields: [tags_new.id],
    references: [tagAllocationsNew.tag_id],
  }),
}));

export const tagsLink = pgTable(
  "tags_link",
  {
    transaction_id: text("transaction_id").notNull(),
    tag: varchar("tag").notNull(),
  },
  (table) => [primaryKey({ columns: [table.transaction_id, table.tag] })]
);

export const tagsLinkRelations = relations(tagsLink, ({ one }) => ({
  transaction: one(transactions, {
    fields: [tagsLink.transaction_id],
    references: [transactions.transaction_id],
  }),
  tag: one(tags, {
    fields: [tagsLink.tag],
    references: [tags.tag],
  }),
}));

export const tagsLinkNew = pgTable(
  "tags_link_new",
  {
    transaction_id: text("transaction_id")
      .notNull()
      .references(() => transactions.transaction_id),
    tag_id: uuid("tag_id")
      .notNull()
      .references(() => tags_new.id),
  },
  (table) => [primaryKey({ columns: [table.transaction_id, table.tag_id] })]
);

export const tagsLinkNewRelations = relations(tagsLinkNew, ({ one }) => ({
  transaction: one(transactions, {
    fields: [tagsLinkNew.transaction_id],
    references: [transactions.transaction_id],
  }),
  tag: one(tags_new, {
    fields: [tagsLinkNew.tag_id],
    references: [tags_new.id],
  }),
}));

export const tagAllocationsNew = pgTable(
  "tag_allocations_new",
  {
    user_id: integer("user_id")
      .notNull()
      .references(() => userTable.id),
    tag_id: uuid("tag_id")
      .notNull()
      .references(() => tags_new.id),
    allocation: decimal("allocation").notNull(),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.tag_id] })]
);

export const tagAllocations = pgTable(
  "tag_allocations",
  {
    user_id: integer("user_id")
      .notNull()
      .references(() => userTable.id),
    tag: varchar("tag", { length: 255 })
      .notNull()
      .references(() => tags.tag),
    allocation: decimal("allocation").notNull(),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.tag] })]
);

export const tagAllocationsNewRelations = relations(
  tagAllocationsNew,
  ({ one }) => ({
    tag: one(tags_new, {
      fields: [tagAllocationsNew.tag_id],
      references: [tags_new.id],
    }),
  })
);

export const tagAllocationsRelations = relations(tagAllocations, ({ one }) => ({
  tag: one(tags, {
    fields: [tagAllocations.tag],
    references: [tags.tag],
  }),
}));

export const userTable = pgTable("user", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").notNull(),
  name: text("name").notNull(),
  /** this is for the plaid transaction sync endpoint, to fetch new transactions */
  nextTransactionCursor: text("next_transaction_cursor"),
});

export const userRelations = relations(userTable, ({ many }) => ({
  plaidAccounts: many(plaidAccount),
}));

export const sessionTable = pgTable("session", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => userTable.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const bucketTypeEnum = pgEnum("bucket_type", ["goal", "ongoing"]);

export const buckets = pgTable(
  "buckets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userTable.id),
    name: text("name").notNull(),
    isArchived: boolean("is_archived").notNull().default(false),
    type: bucketTypeEnum("type").notNull(), // 'goal' | 'ongoing'
    targetAmount: decimal("target_amount", { precision: 20, scale: 2 }), // only for goal
    targetPercentage: decimal("target_percentage", { precision: 8, scale: 4 }), // 0..1 only for ongoing
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "targetPercent",
      sql`(${t.targetPercentage} IS NULL OR (${t.targetPercentage} >= 0 AND ${t.targetPercentage} <= 1))`
    ),
    check(
      "targetAmountPositive",
      sql`(${t.targetAmount} IS NULL OR ${t.targetAmount} >= 0)`
    ),
    check(
      "goalShape",
      sql`((${t.type} <> 'goal') OR (${t.targetAmount} IS NOT NULL AND ${t.targetPercentage} IS NULL))`
    ),
    check(
      "ongoingShape",
      sql`((${t.type} <> 'ongoing') OR (${t.targetPercentage} IS NOT NULL AND ${t.targetAmount} IS NULL))`
    ),
  ]
);

export const bucketsRelations = relations(buckets, ({ many }) => ({
  movements: many(bucketMovements),
}));

export const bucketMovements = pgTable(
  "bucket_movements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userTable.id),
    bucketId: integer("bucket_id")
      .notNull()
      .references(() => buckets.id),
    amount: decimal("amount", { precision: 20, scale: 2 }).notNull(), // +/-
    note: text("note"),
    transactionId: text("transaction_id"), // optional link to a real transaction
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("nonZero", sql`(${t.amount} <> 0)`)]
);

export const bucketMovementsRelations = relations(
  bucketMovements,
  ({ one }) => ({
    bucket: one(buckets, {
      fields: [bucketMovements.bucketId],
      references: [buckets.id],
    }),
  })
);

export const plaidAccount = pgTable("plaid_account", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => userTable.id),
  access_token: text("access_token").notNull(),
  item_id: text("item_id").notNull(),
  created_at: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const plaidAccountRelations = relations(plaidAccount, ({ one }) => ({
  user: one(userTable, {
    fields: [plaidAccount.user_id],
    references: [userTable.id],
  }),
}));

export type User = InferSelectModel<typeof userTable>;
export type Session = InferSelectModel<typeof sessionTable>;
export type PostBucket = InferInsertModel<typeof buckets>;
export type Bucket = InferSelectModel<typeof buckets>;
export type PostMovement = InferInsertModel<typeof bucketMovements>;
export type Movement = InferSelectModel<typeof bucketMovements>;
export type Tag = InferSelectModel<typeof tags_new>;
export type UpdateTag = InferInsertModel<typeof tags_new>;
export type TagAllocation = InferSelectModel<typeof tagAllocationsNew>;
