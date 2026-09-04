"use client";

import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "danger" | "ghost";
  loading?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-on-primary active:bg-primary-dark",
  outline: "bg-transparent border-2 border-primary text-primary active:bg-primary/10",
  danger: "bg-danger text-on-primary active:opacity-90",
  ghost: "bg-transparent text-text active:bg-border/50",
};

/** Minimum 56px tall — a kitchen screen is tapped in a hurry, sometimes with a glove or a wet finger; iOS/Android's own 44px guideline is a floor, not a target, here. */
export function Button({ variant = "primary", loading, disabled, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-5 text-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {loading ? <span className="size-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}
