// /api/auth/*  OWNER: A
import { Router, type Response } from "express";
import { z } from "zod";
import { config } from "../../config";
import { parse } from "../../lib/validate";
import * as auth from "./service";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "At least 8 characters.").max(128), // SR-04
  nickname: z.string().trim().min(2, "At least 2 characters.").max(20, "At most 20 characters."),
  ageConfirmed: z.literal(true, "You must be 14 or older to register."), // FR-03
  termsAccepted: z.literal(true, "Please accept the Terms of Service and Privacy Policy."), // FR-04
});

const loginSchema = z.object({
  email: z.string().min(1, "Enter your email."),
  password: z.string().min(1, "Enter your password."),
});

async function startSession(res: Response, userId: string) {
  const session = await auth.createSession(userId);
  res.cookie(auth.SESSION_COOKIE, session.id, {
    httpOnly: true, // JavaScript in the page cannot read it (protects against XSS theft)
    sameSite: "lax",
    secure: config.isProduction, // HTTPS only in production
    expires: session.expiresAt,
  });
}

authRouter.post("/register", async (req, res) => {
  const body = parse(registerSchema, req.body);
  const user = await auth.register(body);
  await startSession(res, user.id);
  res.status(201).json({ user });
});

authRouter.post("/login", async (req, res) => {
  const body = parse(loginSchema, req.body);
  const user = await auth.login(body.email, body.password);
  await startSession(res, user.id);
  res.json({ user });
});

authRouter.post("/logout", async (req, res) => {
  const id = req.cookies?.[auth.SESSION_COOKIE];
  if (id) await auth.deleteSession(id);
  res.clearCookie(auth.SESSION_COOKIE);
  res.status(204).end();
});

/** Who am I? The React app calls this on load. Returns { user: null } for guests. */
authRouter.get("/me", (req, res) => {
  res.json({ user: req.user ?? null });
});
