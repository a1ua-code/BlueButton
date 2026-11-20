// Login handling shared by every module. OWNER: A
//
//   router.post("/", requireUser, handler)    -> 401 unless logged in; req.user is set
//   router.get("/", requireAdmin, handler)    -> 403 unless an admin
//
// Inside a handler, `currentUser(req)` returns the logged-in user (never undefined
// after requireUser has run).
import type { NextFunction, Request, Response } from "express";
import type { Role } from "../db/schema";
import { forbidden, unauthorized } from "../lib/errors";
import { findUserBySession, SESSION_COOKIE } from "../modules/auth/service";

export type AuthUser = { id: string; email: string; nickname: string; role: Role };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Runs on every request: if the session cookie is valid, puts the user on req.user. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (sessionId) {
    const user = await findUserBySession(sessionId);
    if (user) req.user = user;
  }
  next();
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw unauthorized();
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw unauthorized();
  if (req.user.role !== "ADMIN") throw forbidden("Admins only.");
  next();
}

/** The logged-in user. Use only in handlers protected by requireUser. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
