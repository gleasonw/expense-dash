import {
  decimal,
  varchar,
  date,
  jsonb,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { relations, type InferSelectModel } from "drizzle-orm";
import { Transaction } from "plaid";

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

export type TransactionWithTags = InferSelectModel<typeof transactions> & {
  tagsLinks: InferSelectModel<typeof tagsLink> &
    { tag: Tag; transaction: Transaction }[];
};

export const transactionsRelations = relations(transactions, ({ many }) => ({
  tagsLinks: many(tagsLink),
}));

export const tags = pgTable("tags", {
  tag: varchar("tag", { length: 255 }).primaryKey(),
});

export type Tag = InferSelectModel<typeof tags>;

export const tagsRelations = relations(tags, ({ many }) => ({
  tagsLinks: many(tagsLink),
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
