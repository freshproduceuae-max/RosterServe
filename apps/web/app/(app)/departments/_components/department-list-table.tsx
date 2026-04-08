import Link from "next/link";
import type { DepartmentWithTeams } from "@/lib/departments/types";
import { DepartmentEmptyState } from "./department-empty-state";

interface DepartmentListTableProps {
  departments: DepartmentWithTeams[];
  ownerNames: Record<string, string>;
  isSuperAdmin: boolean;
}

export function DepartmentListTable({
  departments,
  ownerNames,
  isSuperAdmin,
}: DepartmentListTableProps) {
  if (departments.length === 0) {
    return <DepartmentEmptyState canCreate={isSuperAdmin} />;
  }

  return (
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
              {dept.teams.length} {dept.teams.length === 1 ? "team" : "teams"}
            </span>
          </div>
          <Link
            href={`/departments/${dept.id}`}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
          >
            View
          </Link>
        </li>
      ))}
    </ul>
  );
}
