import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@/server/schema";

export const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({
  connectionString: dbUrl,
});

export const db = drizzle(pool, { schema, logger: false });
