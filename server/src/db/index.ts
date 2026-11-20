// The one shared database connection. Import `db` (and the tables you need) everywhere:
//
//   import { db, users } from "../../db";
//   import { eq } from "drizzle-orm";
//   const [user] = await db.select().from(users).where(eq(users.id, id));
//
// Drizzle docs:  https://orm.drizzle.team/docs/select
// Browse the data in your browser with `npm run db:studio`.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config";
import * as schema from "./schema";

export const pool = new Pool({ connectionString: config.databaseUrl });

export const db = drizzle(pool, { schema, casing: "snake_case" });

/** The type of `tx` inside db.transaction(async (tx) => ...). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export * from "./schema";
