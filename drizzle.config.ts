import { dbUrl } from "@/server/db";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./server/db.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
