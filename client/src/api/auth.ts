// Account API calls. OWNER: A
import { api } from "./client";
import type { User } from "./types";

export const fetchMe = () => api<{ user: User | null }>("/auth/me").then((r) => r.user);

export const login = (email: string, password: string) =>
  api<{ user: User }>("/auth/login", { method: "POST", body: { email, password } }).then(
    (r) => r.user,
  );

export type RegisterInput = {
  email: string;
  password: string;
  nickname: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
};

export const register = (input: RegisterInput) =>
  api<{ user: User }>("/auth/register", { method: "POST", body: input }).then((r) => r.user);

export const logout = () => api("/auth/logout", { method: "POST" });
