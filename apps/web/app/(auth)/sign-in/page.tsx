"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signInAction, type AuthActionResult } from "@/lib/auth/actions";

const CALLBACK_ERROR_MESSAGE =
  "Your confirmation link has expired or is invalid. Please try signing up again.";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error") === "confirmation_failed";

  const [state, formAction, isPending] = useActionState<
    AuthActionResult,
    FormData
  >(signInAction, undefined);

  const errorMessage =
    callbackError && !state
      ? CALLBACK_ERROR_MESSAGE
      : state && "error" in state
        ? state.error
        : null;

  return (
    <div className="flex flex-col gap-300">
      <div>
        <h1 className="font-display text-h1 text-neutral-950">Welcome back</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Sign in to continue to RosterServe
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-300">
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
            autoComplete="current-password"
            required
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 outline-none transition-colors duration-fast focus:border-brand-calm-600 focus:ring-2 focus:ring-brand-calm-600/20"
          />
        </div>

        {errorMessage && (
          <p className="text-body-sm text-semantic-error">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-60"
        >
          {isPending ? "Signing in\u2026" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-body-sm text-neutral-600">
        New here?{" "}
        <Link
          href="/sign-up"
          className="text-brand-calm-600 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
