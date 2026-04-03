"use client";

import Link from "next/link";
import { useState } from "react";
import type { DepartmentWithSubTeams } from "@/lib/departments/types";
import { softDeleteDepartment } from "@/lib/departments/actions";
import { SubTeamListSection } from "../../_components/sub-team-list-section";
import { DeleteConfirmModal } from "../../_components/delete-confirm-modal";

interface DepartmentDetailCardProps {
  eventId: string;
  department: DepartmentWithSubTeams;
  ownerNames: Record<string, string>;
  isSuperAdmin: boolean;
  canManage: boolean;
  canViewRoster: boolean;
  gapCount?: number;
}

export function DepartmentDetailCard({
  eventId,
  department,
  ownerNames,
  isSuperAdmin,
  canManage,
  canViewRoster,
  gapCount = 0,
}: DepartmentDetailCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const ownerName = ownerNames[department.owner_id ?? ""] ?? "Unassigned";

  return (
    <div className="flex flex-col gap-400">
      {/* Department header */}
      <div className="flex flex-col gap-200 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-h1 text-neutral-950">{department.name}</h1>
          <p className="mt-100 text-body-sm text-neutral-600">
            Department head:{" "}
            <span className="font-semibold text-neutral-800">{ownerName}</span>
          </p>
        </div>
        <div className="flex gap-200">
          {canViewRoster && (
            <div className="flex items-center gap-150">
              <Link
                href={`/events/${eventId}/departments/${department.id}/roster`}
                className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
              >
                View Roster
              </Link>
              {gapCount > 0 && (
                <span className="rounded-full border border-semantic-warning bg-semantic-warning/10 px-200 py-50 text-body-sm font-medium text-semantic-warning">
                  {gapCount === 1 ? "1 skill gap" : `${gapCount} skill gaps`}
                </span>
              )}
            </div>
          )}
          {isSuperAdmin && (
            <>
              <Link
                href={`/events/${eventId}/departments/${department.id}/edit`}
                className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="rounded-200 border border-semantic-error/30 bg-neutral-0 px-300 py-200 text-body-sm text-semantic-error transition-colors duration-fast hover:bg-semantic-error/5"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-teams */}
      <SubTeamListSection
        eventId={eventId}
        departmentId={department.id}
        subTeams={department.sub_teams}
        ownerNames={ownerNames}
        canManage={canManage}
      />

      {showDelete && (
        <DeleteConfirmModal
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          entityName={department.name}
          consequenceText="Deleting this department will also remove all its sub-teams. This action cannot be undone."
          action={softDeleteDepartment}
          hiddenFields={{ id: department.id, eventId }}
        />
      )}
    </div>
  );
}
