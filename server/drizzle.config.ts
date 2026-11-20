// Settings for drizzle-kit (the migration tool). You normally don't need to touch this.
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle", // generated SQL migrations - commit this folder
  casing: "snake_case", // memberCount in TypeScript = member_count in the database
  dbCredentials: { url: process.env.DATABASE_URL! },
});
