import Link from "next/link";

export function EventEmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center gap-300 rounded-300 border border-neutral-300 bg-neutral-0 p-500 text-center">
      <p className="font-display text-h3 text-neutral-950">No events yet</p>
      <p className="text-body-sm text-neutral-600">
        {canCreate
          ? "Create your first event to begin planning."
          : "Events will appear here once they are created."}
      </p>
      {canCreate && (
        <Link
          href="/events/new"
          className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
        >
          Create event
        </Link>
      )}
    </div>
  );
}
