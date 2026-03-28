import Link from "next/link";

interface SubTeamEmptyStateProps {
  eventId: string;
  departmentId: string;
  canCreate: boolean;
}

export function SubTeamEmptyState({
  eventId,
  departmentId,
  canCreate,
}: SubTeamEmptyStateProps) {
  return (
    <div className="rounded-200 border border-neutral-300 bg-neutral-0 px-400 py-400 text-center">
      <p className="text-body text-neutral-600">
        No sub-teams yet.
        {canCreate
          ? " Add a sub-team to this department."
          : " Sub-teams will appear here once they are added."}
      </p>
      {canCreate && (
        <Link
          href={`/events/${eventId}/departments/${departmentId}/sub-teams/new`}
          className="mt-300 inline-block rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
        >
          Add sub-team
        </Link>
      )}
    </div>
  );
}
