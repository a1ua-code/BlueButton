// Accounts and sessions. OWNER: A  (SRS FR-01 to FR-10, FR-17 to FR-19)
//
// TODO (A):
//  - email verification + welcome email (FR-20, FR-21) - for now accounts are usable right away
//  - password reset by email (FR-06, FR-22)
//  - profile edit, account deactivation/deletion (FR-07, FR-08)
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { config } from "../../config";
import { db, sessions, users } from "../../db";
import { AppError } from "../../lib/errors";
import type { AuthUser } from "../../middleware/auth";

export const SESSION_COOKIE = "bb_session";

const publicUser = {
  id: users.id,
  email: users.email,
  nickname: users.nickname,
  role: users.role,
};

export async function register(input: {
  email: string;
  password: string;
  nickname: string;
}): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();

  const [emailTaken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (emailTaken) {
    throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists.", {
      email: "This email is already registered.",
    });
  }
  const [nickTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.nickname, input.nickname));
  if (nickTaken) {
    throw new AppError(409, "NICKNAME_TAKEN", "This nickname is taken.", {
      nickname: "This nickname is taken.",
    });
  }

  const now = new Date();
  const [user] = await db
    .insert(users)
    .values({
      email,
      nickname: input.nickname,
      passwordHash: await bcrypt.hash(input.password, 10),
      ageConfirmedAt: now, // FR-03: the form only submits when "I am 14 or older" is checked
      termsAcceptedAt: now, // FR-04
    })
    .returning(publicUser);
  return user;
}

export async function login(emailRaw: string, password: string): Promise<AuthUser> {
  const email = emailRaw.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  // Same message whether the email exists or not, so nobody can probe which emails are registered.
  const wrong = new AppError(401, "INVALID_LOGIN", "Wrong email or password.");
  if (!user) throw wrong;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(
      423,
      "ACCOUNT_LOCKED",
      "Too many failed attempts. Try again in a few minutes.",
    );
  }
  if (user.status !== "ACTIVE") {
    throw new AppError(403, "ACCOUNT_INACTIVE", "This account is not active.");
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= config.maxFailedLogins; // FR-19
    await db
      .update(users)
      .set({
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + config.lockMinutes * 60_000) : null,
      })
      .where(eq(users.id, user.id));
    throw wrong;
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null })
    .where(eq(users.id, user.id));
  return { id: user.id, email: user.email, nickname: user.nickname, role: user.role };
}

export async function createSession(userId: string) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 3600_000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function deleteSession(id: string) {
  await db.delete(sessions).where(eq(sessions.id, id));
}

/** The user for a session cookie, or null if the session is missing/expired or the account is blocked. */
export async function findUserBySession(sessionId: string): Promise<AuthUser | null> {
  const [row] = await db
    .select({ ...publicUser, status: users.status, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId));
  if (!row || row.expiresAt < new Date()) return null;
  if (row.status !== "ACTIVE") return null; // suspended users are logged out immediately
  return { id: row.id, email: row.email, nickname: row.nickname, role: row.role };
}
