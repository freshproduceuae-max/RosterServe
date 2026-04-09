import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-300 bg-neutral-50 p-400 text-center">
      <h1 className="font-display text-h1 text-neutral-950">Page not found</h1>
      <p className="text-body-sm text-neutral-600">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="rounded-200 bg-neutral-950 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-80"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
