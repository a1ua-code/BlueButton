// Who is logged in, available everywhere. OWNER: A
//
//   const { user, login, logout } = useAuth();
//   if (!user) ...guest...
//
// Wrap a page in <RequireAuth> to send guests to the login page first (SRS FR-09, FR-27).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import * as authApi from "../api/auth";
import { disconnectSocket } from "../api/chat";
import type { User } from "../api/types";
import { LoadingBlock } from "../components/ui";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: authApi.RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: authApi.fetchMe, staleTime: Infinity });

  // Switch user: forget data loaded for the previous user (but keep the "me" query alive).
  const setUser = (user: User | null) => {
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    queryClient.setQueryData(["me"], user);
  };

  const value: AuthState = {
    user: me.data ?? null,
    loading: me.isPending,
    async login(email, password) {
      const user = await authApi.login(email, password);
      setUser(user);
      return user;
    },
    async register(input) {
      const user = await authApi.register(input);
      setUser(user);
      return user;
    },
    async logout() {
      await authApi.logout();
      disconnectSocket();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Shows children only to logged-in users; guests go to /login and come back afterwards. */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingBlock />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (admin && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return <>{children}</>;
}
