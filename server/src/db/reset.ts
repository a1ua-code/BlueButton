// Deletes EVERYTHING in your local database (used by `npm run db:reset`, which then
// re-runs migrations and the seed). Never point this at a shared or production database.
import { pool } from "./index";

await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE"); // migration history
await pool.query("CREATE SCHEMA public");
console.log("Database wiped.");
await pool.end();
