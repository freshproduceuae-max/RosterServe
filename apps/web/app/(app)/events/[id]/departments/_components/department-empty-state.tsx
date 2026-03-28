import Link from "next/link";

interface DepartmentEmptyStateProps {
  eventId: string;
  canCreate: boolean;
}

export function DepartmentEmptyState({ eventId, canCreate }: DepartmentEmptyStateProps) {
  return (
    <div className="rounded-200 border border-neutral-300 bg-neutral-0 px-400 py-500 text-center">
      <p className="text-body text-neutral-600">
        No departments yet.
        {canCreate
          ? " Add a department to begin structuring this event."
          : " Departments will appear here once they are added."}
      </p>
      {canCreate && (
        <Link
          href={`/events/${eventId}/departments/new`}
          className="mt-300 inline-block rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
        >
          Add department
        </Link>
      )}
    </div>
  );
}
