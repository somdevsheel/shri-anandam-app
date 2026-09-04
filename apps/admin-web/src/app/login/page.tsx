"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { staffLoginSchema } from "@shri-anandam/validation";
import type { ApiResponse } from "@shri-anandam/shared-types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/lib/auth-store";

/** Staff auth is email + password (ADR-003), proxied through /api/auth/login (ADR-020) rather than called from the browser directly, since that route is the only place the refresh token can be written as an httpOnly cookie. */
export default function LoginPage() {
  const router = useRouter();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = staffLoginSchema.safeParse({ email: email.trim(), password });
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === "email") fieldErrors.email = issue.message;
        if (issue.path[0] === "password") fieldErrors.password = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const json = (await res.json()) as ApiResponse<{ accessToken: string }>;
      if (!res.ok || !json.success) {
        setErrors({ form: !json.success ? json.error.message : "Could not sign in. Try again." });
        return;
      }
      setAccessToken(json.data.accessToken);
      router.replace("/");
    } catch {
      setErrors({ form: "Could not reach the server. Check your connection and try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Shri Anandam</p>
        <h1 className="mt-1 text-2xl font-bold text-text">Admin Sign In</h1>
        <p className="mt-1 text-sm text-text-muted">Manage orders, catalog, inventory, staff, and more.</p>

        <div className="mt-6 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
        </div>

        {errors.form ? <p className="mt-4 text-sm text-danger">{errors.form}</p> : null}

        <Button type="submit" loading={isSubmitting} className="mt-6 w-full">
          Sign In
        </Button>
      </form>
    </div>
  );
}
