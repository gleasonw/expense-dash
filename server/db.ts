import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@/server/schema";

export const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/expense_dash";

const pool = new pg.Pool({
  connectionString: dbUrl,
});

export const db = drizzle(pool, { schema });
