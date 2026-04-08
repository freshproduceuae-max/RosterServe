"use client";

import { useState } from "react";
import Link from "next/link";
import type { Team } from "@/lib/departments/types";
import { softDeleteTeam } from "@/lib/departments/actions";
import { TeamEmptyState } from "./team-empty-state";
import { DeleteConfirmModal } from "../../_components/delete-confirm-modal";

interface TeamListSectionProps {
  departmentId: string;
  teams: Team[];
  ownerNames: Record<string, string>;
  canManage: boolean;
}

export function TeamListSection({
  departmentId,
  teams,
  ownerNames,
  canManage,
}: TeamListSectionProps) {
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const deletingTeam = teams.find((t) => t.id === deletingTeamId);

  return (
    <section className="flex flex-col gap-300">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 font-semibold text-neutral-950">Teams</h2>
        {canManage && (
          <Link
            href={`/departments/${departmentId}/teams/new`}
            className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
          >
            Add team
          </Link>
        )}
      </div>

      {teams.length === 0 ? (
        <TeamEmptyState departmentId={departmentId} canCreate={canManage} />
      ) : (
        <ul className="flex flex-col gap-200">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex items-center justify-between rounded-200 border border-neutral-300 bg-neutral-0 p-400"
            >
              <div className="flex flex-col gap-100">
                <div className="flex items-center gap-200">
                  <span className="text-body font-semibold text-neutral-950">
                    {team.name}
                  </span>
                  {team.rotation_label && (
                    <span className="rounded-100 border border-neutral-300 bg-neutral-100 px-200 py-50 text-body-sm font-semibold text-neutral-700">
                      {team.rotation_label}
                    </span>
                  )}
                </div>
                <span className="text-body-sm text-neutral-600">
                  {ownerNames[team.owner_id ?? ""] ?? "No Team Head assigned"}
                </span>
              </div>
              {canManage && (
                <div className="flex gap-200">
                  <Link
                    href={`/departments/${departmentId}/teams/${team.id}/edit`}
                    className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeletingTeamId(team.id)}
                    className="rounded-200 border border-semantic-error/30 bg-neutral-0 px-300 py-100 text-body-sm text-semantic-error transition-colors duration-fast hover:bg-semantic-error/10"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {deletingTeam && (
        <DeleteConfirmModal
          entityName={deletingTeam.name}
          consequenceText="Deleting this team will remove it permanently. Any assignments linked to this team will lose their team reference."
          hiddenFields={{ id: deletingTeam.id }}
          action={softDeleteTeam}
          onCancel={() => setDeletingTeamId(null)}
        />
      )}
    </section>
  );
}
