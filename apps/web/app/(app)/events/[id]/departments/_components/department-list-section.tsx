import Link from "next/link";
import type { DepartmentWithSubTeams } from "@/lib/departments/types";
import { DepartmentEmptyState } from "./department-empty-state";

interface DepartmentListSectionProps {
  eventId: string;
  departments: DepartmentWithSubTeams[];
  ownerNames: Record<string, string>;
  isSuperAdmin: boolean;
}

export function DepartmentListSection({
  eventId,
  departments,
  ownerNames,
  isSuperAdmin,
}: DepartmentListSectionProps) {
  return (
    <section className="flex flex-col gap-300">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 font-semibold text-neutral-950">Departments</h2>
        {isSuperAdmin && (
          <Link
            href={`/events/${eventId}/departments/new`}
            className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
          >
            Add department
          </Link>
        )}
      </div>

      {departments.length === 0 ? (
        <DepartmentEmptyState eventId={eventId} canCreate={isSuperAdmin} />
      ) : (
        <ul className="flex flex-col gap-200">
          {departments.map((dept) => (
            <li
              key={dept.id}
              className="flex items-center justify-between rounded-200 border border-neutral-300 bg-neutral-0 p-400"
            >
              <div className="flex flex-col gap-100">
                <span className="text-body font-semibold text-neutral-950">
                  {dept.name}
                </span>
                <span className="text-body-sm text-neutral-600">
                  {ownerNames[dept.owner_id ?? ""] ?? "Unassigned"} &middot;{" "}
                  {dept.sub_teams.length}{" "}
                  {dept.sub_teams.length === 1 ? "sub-team" : "sub-teams"}
                </span>
              </div>
              <Link
                href={`/events/${eventId}/departments/${dept.id}`}
                className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
