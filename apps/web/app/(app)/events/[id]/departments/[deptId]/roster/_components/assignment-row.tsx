"use client";

import { useState, useTransition } from "react";
import type { AssignmentWithContext, AssignmentRole } from "@/lib/assignments/types";
import type { SubTeam } from "@/lib/departments/types";
import { updateAssignment, removeAssignment } from "@/lib/assignments/actions";
import { AssignmentStatusBadge } from "./assignment-status-badge";

interface AssignmentRowProps {
  assignment: AssignmentWithContext;
  readOnly: boolean;
  subTeams: Pick<SubTeam, "id" | "name">[];
}

const ROLE_LABELS: Record<AssignmentRole, string> = {
  volunteer: "Volunteer",
  sub_leader: "Sub-leader",
  dept_head: "Dept head",
};

/** Shared stateful controls used by both mobile and desktop renders */
function useAssignmentRowState(assignment: AssignmentWithContext) {
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editRole, setEditRole] = useState<AssignmentRole>(assignment.role);
  const [editSubTeamId, setEditSubTeamId] = useState<string>(
    assignment.sub_team_id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAssignment(assignment.id);
      if (result.error) {
        setError(result.error);
        setRemoving(false);
      }
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateAssignment(assignment.id, {
        role: editRole,
        subTeamId: editSubTeamId || null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  }

  function handleCancelEdit() {
    setEditRole(assignment.role);
    setEditSubTeamId(assignment.sub_team_id ?? "");
    setEditing(false);
    setError(null);
  }

  return {
    removing, setRemoving,
    editing, setEditing,
    editRole, setEditRole,
    editSubTeamId, setEditSubTeamId,
    error, setError,
    isPending,
    handleRemove, handleSave, handleCancelEdit,
  };
}

/**
 * AssignmentRow — desktop table row (renders <td> elements).
 * Wrapped in <tr> by AssignmentList.
 */
export function AssignmentRow({
  assignment,
  readOnly,
  subTeams,
}: AssignmentRowProps) {
  const state = useAssignmentRowState(assignment);

  return (
    <>
      <td className="px-300 py-300 text-body-sm font-medium text-neutral-950">
        {assignment.volunteer_display_name}
      </td>

      <td className="px-300 py-300 text-body-sm text-neutral-600">
        {state.editing && subTeams.length > 0 ? (
          <select
            value={state.editSubTeamId}
            onChange={(e) => state.setEditSubTeamId(e.target.value)}
            disabled={state.isPending}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-200 py-100 text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-calm-600/30"
          >
            <option value="">No sub-team</option>
            {subTeams.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        ) : (
          assignment.sub_team_name ?? "—"
        )}
      </td>

      <td className="px-300 py-300 text-body-sm text-neutral-700">
        {state.editing ? (
          <select
            value={state.editRole}
            onChange={(e) => state.setEditRole(e.target.value as AssignmentRole)}
            disabled={state.isPending}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-200 py-100 text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-calm-600/30"
          >
            <option value="volunteer">Volunteer</option>
            <option value="sub_leader">Sub-leader</option>
          </select>
        ) : (
          ROLE_LABELS[assignment.role]
        )}
      </td>

      <td className="px-300 py-300">
        <AssignmentStatusBadge status={assignment.status} />
      </td>

      {!readOnly && (
        <td className="px-300 py-300">
          <RowActions state={state} />
        </td>
      )}
    </>
  );
}

/**
 * AssignmentCard — mobile card layout.
 * Rendered directly by AssignmentList in the mobile section.
 */
export function AssignmentCard({
  assignment,
  readOnly,
  subTeams,
}: AssignmentRowProps) {
  const state = useAssignmentRowState(assignment);

  return (
    <div className="flex flex-col gap-200 rounded-200 border border-neutral-200 bg-neutral-0 p-300">
      <div className="flex items-center justify-between gap-200">
        <span className="text-body-sm font-medium text-neutral-950">
          {assignment.volunteer_display_name}
        </span>
        <AssignmentStatusBadge status={assignment.status} />
      </div>

      <div className="flex flex-wrap gap-300 text-body-sm text-neutral-600">
        <span>
          <span className="font-medium">Sub-team:</span>{" "}
          {state.editing && subTeams.length > 0 ? (
            <select
              value={state.editSubTeamId}
              onChange={(e) => state.setEditSubTeamId(e.target.value)}
              disabled={state.isPending}
              className="rounded-200 border border-neutral-300 bg-neutral-0 px-200 py-100 text-body-sm focus:outline-none"
            >
              <option value="">No sub-team</option>
              {subTeams.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          ) : (
            assignment.sub_team_name ?? "—"
          )}
        </span>
        <span>
          <span className="font-medium">Role:</span>{" "}
          {state.editing ? (
            <select
              value={state.editRole}
              onChange={(e) => state.setEditRole(e.target.value as AssignmentRole)}
              disabled={state.isPending}
              className="rounded-200 border border-neutral-300 bg-neutral-0 px-200 py-100 text-body-sm focus:outline-none"
            >
              <option value="volunteer">Volunteer</option>
              <option value="sub_leader">Sub-leader</option>
            </select>
          ) : (
            ROLE_LABELS[assignment.role]
          )}
        </span>
      </div>

      {!readOnly && <RowActions state={state} />}
    </div>
  );
}

type RowState = ReturnType<typeof useAssignmentRowState>;

function RowActions({ state }: { state: RowState }) {
  if (state.removing) {
    return (
      <div className="flex flex-col gap-100">
        <div className="flex items-center gap-200">
          <span className="text-body-sm text-neutral-600">
            Remove from roster?
          </span>
          <button
            onClick={state.handleRemove}
            disabled={state.isPending}
            className="text-body-sm font-semibold text-semantic-error underline underline-offset-2 transition-opacity duration-fast hover:opacity-70 disabled:opacity-50"
          >
            {state.isPending ? "Removing…" : "Confirm"}
          </button>
          <button
            onClick={() => { state.setRemoving(false); state.setError(null); }}
            disabled={state.isPending}
            className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors duration-fast hover:text-neutral-950 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {state.error && (
          <p className="text-body-sm text-semantic-error">{state.error}</p>
        )}
      </div>
    );
  }

  if (state.editing) {
    return (
      <div className="flex flex-col gap-100">
        <div className="flex items-center gap-200">
          <button
            onClick={state.handleSave}
            disabled={state.isPending}
            className="text-body-sm font-semibold text-brand-calm-600 underline underline-offset-2 transition-opacity duration-fast hover:opacity-70 disabled:opacity-50"
          >
            {state.isPending ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={state.handleCancelEdit}
            disabled={state.isPending}
            className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors duration-fast hover:text-neutral-950 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {state.error && (
          <p className="text-body-sm text-semantic-error">{state.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-100">
      <div className="flex items-center gap-200">
        <button
          onClick={() => state.setEditing(true)}
          className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors duration-fast hover:text-neutral-950"
        >
          Edit
        </button>
        <button
          onClick={() => { state.setRemoving(true); state.setError(null); }}
          className="text-body-sm text-semantic-error underline underline-offset-2 transition-opacity duration-fast hover:opacity-70"
        >
          Remove
        </button>
      </div>
      {state.error && (
        <p className="text-body-sm text-semantic-error">{state.error}</p>
      )}
    </div>
  );
}
