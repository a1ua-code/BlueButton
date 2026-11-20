// OWNER: A  (SRS FR-01 to FR-04)
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { errorMessage, fieldErrors } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Checkbox, TextField, useToast } from "../components/ui";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const [form, setForm] = useState({
    email: "",
    password: "",
    nickname: "",
    ageConfirmed: false,
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.ageConfirmed) {
      // FR-03: under 14 cannot register
      setErrors({ ageConfirmed: "You must be 14 or older to use B&B." });
      return;
    }
    setLoading(true);
    setErrors({});
    setFormError("");
    try {
      await register(form);
      toast.success("Welcome to B&B!");
      navigate(params.get("next") || "/", { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-6 text-center text-2xl font-bold">Create your account</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextField
            label="Nickname"
            required
            value={form.nickname}
            onChange={set("nickname")}
            error={errors.nickname}
            hint="Shown to other players. 2-20 characters."
            maxLength={20}
          />
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
          />
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            hint="At least 8 characters."
          />
          <Checkbox
            label="I am 14 years old or older."
            checked={form.ageConfirmed}
            onChange={set("ageConfirmed")}
            error={errors.ageConfirmed}
          />
          <Checkbox
            label={
              <>
                I accept the{" "}
                <Link to="/help" className="text-brand-700 underline">
                  Terms of Service and Privacy Policy
                </Link>
                .
              </>
            }
            checked={form.termsAccepted}
            onChange={set("termsAccepted")}
            error={errors.termsAccepted}
          />
          {formError && !Object.keys(errors).length && (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            Sign up
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
