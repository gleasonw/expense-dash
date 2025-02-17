import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import type { InferSelectModel } from "drizzle-orm";

export const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/expense_dash";

const pool = new pg.Pool({
  connectionString: dbUrl,
});
export const db = drizzle(pool);

/**we only store user info to seed the client with data, and sync latest data */
export const userTable = pgTable("user", {
  id: serial("id").primaryKey(),
});

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

export type User = InferSelectModel<typeof userTable>;
export type Session = InferSelectModel<typeof sessionTable>;
