// /api/admin/*  OWNER: A  (SRS FR-11 to FR-16, FR-136 to FR-146)
//
// Every route here is admin-only because the whole router is mounted behind requireAdmin
// in app.ts.
//
// TODO (A): suspend/ban users, hide/delete parties (call the parties service), reports
// queue, system settings, statistics dashboard.
import { count, desc, ilike, inArray, or } from "drizzle-orm";
import { Router } from "express";
import { db, parties, users } from "../../db";

export const adminRouter = Router();

adminRouter.get("/users", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(q ? or(ilike(users.email, `%${q}%`), ilike(users.nickname, `%${q}%`)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(50);
  res.json({ users: rows });
});

adminRouter.get("/stats", async (_req, res) => {
  const [[u], [p], [active]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(parties),
    db
      .select({ n: count() })
      .from(parties)
      .where(inArray(parties.status, ["RECRUITING", "FULL"])),
  ]);
  res.json({ users: u.n, parties: p.n, activeParties: active.n });
});
