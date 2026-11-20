// OWNER: A  (SRS FR-05; password reset FR-06 is TODO)
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, TextField, useToast } from "../components/ui";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.nickname}!`);
      navigate(params.get("next") || "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-6 text-center text-2xl font-bold">Log in to B&amp;B</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            Log in
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-500">
        No account yet?{" "}
        <Link
          to={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}
          className="font-medium text-brand-700 hover:underline"
        >
          Sign up
        </Link>
      </p>
      <p className="mt-6 rounded-lg bg-slate-100 p-3 text-center text-xs text-slate-500">
        Development test account: alice@kaist.ac.kr / password123
      </p>
    </div>
  );
}
