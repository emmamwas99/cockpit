"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors";
import { Eye, EyeOff } from "lucide-react";
import { ADMIN_LOGIN } from "@/graphql/operations";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function readableError(error: unknown): string {
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors[0]?.message ?? "Sign-in failed";
  }
  if (ServerError.is(error)) {
    try {
      const parsed = JSON.parse(error.bodyText) as { errors?: Array<{ message?: string }> };
      const message = parsed.errors?.[0]?.message;
      if (message) return message;
    } catch {
      // Fall through to the generic message below.
    }
  }
  if (error instanceof Error) return error.message;
  return "Sign-in failed";
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminLogin, { loading }] = useMutation(ADMIN_LOGIN);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const { data } = await adminLogin({ variables: { input: { email, password } } });
      if (!data?.adminLogin) throw new Error("Sign-in failed");
      setAuth(data.adminLogin);
      router.replace("/");
    } catch (err) {
      setError(readableError(err));
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/icon.svg" alt="" width={40} height={40} className="size-10" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">Sign in to Shopi Admin</h1>
          <p className="mt-1 text-sm text-muted">Use your staff account.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-elevated p-6"
        >
          {error && (
            <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-[13px] text-error">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@shopi.co.ke"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="h-10 w-full" loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          For Shopi staff only. Accounts lock after repeated failed attempts.
        </p>
      </div>
    </main>
  );
}
