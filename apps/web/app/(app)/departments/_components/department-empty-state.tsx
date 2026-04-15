import Link from "next/link";

export function DepartmentEmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-500 text-center">
      <p className="text-body text-neutral-600">
        {canCreate
          ? "No departments yet. Add a department to begin structuring your organisation."
          : "You have not been assigned to any department yet. Contact a Super Admin to set this up."}
      </p>
      {canCreate && (
        <Link
          href="/departments/new"
          className="mt-300 inline-block rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
        >
          Add department
        </Link>
      )}
    </div>
  );
}
