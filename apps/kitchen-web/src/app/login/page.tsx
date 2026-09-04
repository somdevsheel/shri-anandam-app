"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { staffLoginSchema } from "@shri-anandam/validation";
import type { ApiResponse } from "@shri-anandam/shared-types";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/lib/auth-store";

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
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border-2 border-border bg-surface p-8 shadow-sm">
        <p className="text-base font-bold uppercase tracking-wide text-primary">Shri Anandam</p>
        <h1 className="mt-1 text-3xl font-bold text-text">Kitchen Sign In</h1>

        <div className="mt-6 flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-lg font-semibold text-text">Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-lg text-text focus:border-primary focus:outline-none"
            />
            {errors.email ? <span className="mt-1 block text-base text-danger">{errors.email}</span> : null}
          </label>
          <label className="block">
            <span className="mb-1 block text-lg font-semibold text-text">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-lg text-text focus:border-primary focus:outline-none"
            />
            {errors.password ? <span className="mt-1 block text-base text-danger">{errors.password}</span> : null}
          </label>
        </div>

        {errors.form ? <p className="mt-4 text-lg text-danger">{errors.form}</p> : null}

        <Button type="submit" loading={isSubmitting} className="mt-6 w-full">
          Sign In
        </Button>
      </form>
    </div>
  );
}
