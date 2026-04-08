import Link from "next/link";

interface TeamEmptyStateProps {
  departmentId: string;
  canCreate: boolean;
}

export function TeamEmptyState({ departmentId, canCreate }: TeamEmptyStateProps) {
  return (
    <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-400 text-center">
      <p className="text-body text-neutral-600">
        No teams yet.
        {canCreate && " Add a team to build out this department."}
      </p>
      {canCreate && (
        <Link
          href={`/departments/${departmentId}/teams/new`}
          className="mt-300 inline-block rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
        >
          Add team
        </Link>
      )}
    </div>
  );
}
