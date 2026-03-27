"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionResult } from "@/lib/auth/actions";

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState<
    AuthActionResult,
    FormData
  >(signUpAction, undefined);

  const isSuccess = state && "success" in state;
  const errorMessage = state && "error" in state ? state.error : null;

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center gap-300 py-300 text-center">
        <div className="flex h-500 w-500 items-center justify-center rounded-pill bg-brand-support-500/10">
          <svg
            className="h-6 w-6 text-brand-support-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-h3 text-neutral-950">
            Check your email
          </h2>
          <p className="mt-200 text-body-sm text-neutral-600">
            We sent a confirmation link to your email address. Click the link to
            activate your account.
          </p>
        </div>
        <Link
          href="/auth/sign-in"
          className="mt-200 text-body-sm text-brand-support-500 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-300">
      <div>
        <h1 className="font-display text-h1 text-neutral-950">
          Join RosterServe
        </h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Create your account to get started
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-300">
        <div className="flex flex-col gap-100">
          <label
            htmlFor="displayName"
            className="text-body-sm font-semibold text-neutral-800"
          >
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            required
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 outline-none transition-colors duration-fast focus:border-brand-calm-600 focus:ring-2 focus:ring-brand-calm-600/20"
          />
        </div>

        <div className="flex flex-col gap-100">
          <label
            htmlFor="email"
            className="text-body-sm font-semibold text-neutral-800"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 outline-none transition-colors duration-fast focus:border-brand-calm-600 focus:ring-2 focus:ring-brand-calm-600/20"
          />
        </div>

        <div className="flex flex-col gap-100">
          <label
            htmlFor="password"
            className="text-body-sm font-semibold text-neutral-800"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 outline-none transition-colors duration-fast focus:border-brand-calm-600 focus:ring-2 focus:ring-brand-calm-600/20"
          />
          <p className="text-label text-neutral-600">At least 8 characters</p>
        </div>

        {errorMessage && (
          <p className="text-body-sm text-semantic-error">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-200 bg-brand-warm-500 px-400 py-200 text-body font-semibold text-neutral-950 transition-colors duration-fast hover:bg-brand-warm-500/90 disabled:opacity-60"
        >
          {isPending ? "Creating account\u2026" : "Create account"}
        </button>
      </form>

      <p className="text-center text-body-sm text-neutral-600">
        Already have an account?{" "}
        <Link
          href="/auth/sign-in"
          className="text-brand-calm-600 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
