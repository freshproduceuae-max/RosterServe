"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BugReportForm } from "./_components/bug-report-form";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  const whatsappNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;

  return (
    <div className="flex flex-col gap-400 py-400">
      <div className="flex flex-col gap-200">
        <h1 className="font-display text-h1 text-neutral-950">
          Something went wrong
        </h1>
        <p className="text-body-sm text-neutral-600">
          It&apos;s not you — something on our end broke. Your data is safe.
        </p>
      </div>

      <div className="flex flex-col gap-200">
        <button
          onClick={reset}
          className="w-fit rounded-200 bg-neutral-950 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-80"
        >
          Try again
        </button>

        <Link
          href="/dashboard"
          className="w-fit text-body-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-950"
        >
          Go to dashboard
        </Link>

        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-body-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-950"
          >
            Contact support on WhatsApp
          </a>
        )}
      </div>

      <BugReportForm />
    </div>
  );
}
