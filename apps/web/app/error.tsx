"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  const whatsappNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-neutral-50 p-400">
        <div className="flex max-w-md flex-col gap-300 text-center">
          <h1 className="font-display text-h1 text-neutral-950">
            Something went wrong
          </h1>
          <p className="text-body-sm text-neutral-600">
            It&apos;s not you — something on our end broke. Your data is safe.
          </p>
          <div className="flex flex-col items-center gap-200">
            <button
              onClick={reset}
              className="rounded-200 bg-neutral-950 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-80"
            >
              Try again
            </button>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-950"
              >
                Contact support on WhatsApp
              </a>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
