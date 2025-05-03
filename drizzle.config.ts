import { dbUrl } from "@/server/db";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!dbUrl) {
  throw new Error("DATABASE_URL is not set");
}

console.log("drizzle.config.ts", { dbUrl });

export default defineConfig({
  out: "./drizzle",
  schema: "./server/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
