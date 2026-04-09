"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { TeamHeadDashboardData, AssignmentWithEventContext } from "@/lib/dashboard/types";
import { respondToServiceRequest } from "@/lib/assignments/actions";
import { RosterHealthBar } from "./roster-health-bar";

function formatEventDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface TeamHeadDashboardProps {
  data: TeamHeadDashboardData;
  displayName: string;
}

export function TeamHeadDashboard({ data, displayName }: TeamHeadDashboardProps) {
  const { subTeamSummaries, myInvitations } = data;
  const pendingInvitations = myInvitations.filter((a) => a.status === "invited");
  const confirmedInvitations = myInvitations.filter((a) => a.status === "accepted");

  return (
    <div className="flex flex-col gap-400">
      {/* Header band */}
      <div className="rounded-300 bg-surface-cool px-400 py-400">
        <h1 className="font-display text-h1 text-neutral-950">
          Hi, {displayName.split(" ")[0]}
        </h1>
      </div>

      {/* Pending invitations prompt */}
      {pendingInvitations.length > 0 && (
        <section className="flex flex-col gap-200">
          <h2 className="font-display text-h2 text-neutral-950">Action required</h2>
          <div className="flex flex-col gap-200">
            {pendingInvitations.map((inv) => (
              <InvitationCard key={inv.id} invitation={inv} />
            ))}
          </div>
        </section>
      )}

      {/* Confirmed service */}
      {confirmedInvitations.length > 0 && (
        <section className="flex flex-col gap-200">
          <h2 className="font-display text-h2 text-neutral-950">
            Confirmed service
          </h2>
          <div className="flex flex-col gap-200">
            {confirmedInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col gap-50 rounded-200 border border-semantic-success/30 bg-semantic-success/5 p-300"
              >
                <p className="text-body-sm font-semibold text-neutral-950">
                  {inv.event_title}
                </p>
                <p className="text-body-sm text-neutral-600">
                  {inv.department_name}
                  {inv.sub_team_name ? ` · ${inv.sub_team_name}` : ""} ·{" "}
                  {formatEventDate(inv.event_date)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team roster cards */}
      <section className="flex flex-col gap-300">
        <h2 className="font-display text-h2 text-neutral-950">Your teams</h2>
        {subTeamSummaries.length === 0 ? (
          <p className="text-body text-neutral-600">
            No upcoming assignments in your teams.
          </p>
        ) : (
          <div className="flex flex-col gap-300">
            {subTeamSummaries.map((st) => (
              <div
                key={`${st.sub_team_id}-${st.event_id}`}
                className="rounded-200 border border-neutral-300 bg-neutral-0 p-300"
              >
                <div className="flex items-start justify-between gap-200">
                  <div className="flex flex-col gap-50">
                    <p className="font-display text-h3 text-neutral-950">
                      {st.sub_team_name}
                    </p>
                    <p className="text-body-sm text-neutral-600">
                      {st.event_title} · {formatEventDate(st.event_date)}
                    </p>
                    <p className="text-body-sm text-neutral-500">{st.department_name}</p>
                  </div>
                  <Link
                    href={`/events/${st.event_id}/departments/${st.department_id}/roster`}
                    className="shrink-0 text-body-sm text-brand-calm-600 underline-offset-2 hover:underline"
                  >
                    View Roster
                  </Link>
                </div>
                <div className="mt-200">
                  <RosterHealthBar
                    invited={st.invited}
                    accepted={st.accepted}
                    declined={st.declined}
                    gapCount={st.gap_count}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InvitationCard({ invitation }: { invitation: AssignmentWithEventContext }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingResponse, setPendingResponse] = useState<"accepted" | "declined" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [responded, setResponded] = useState(false);

  function handleResponse(response: "accepted" | "declined") {
    if (
      response === "declined" &&
      !window.confirm(
        "Decline this service request? This cannot be undone.",
      )
    ) {
      return;
    }
    setError(null);
    setPendingResponse(response);
    startTransition(async () => {
      const result = await respondToServiceRequest(invitation.id, response);
      if (result.error) {
        setError(result.error);
        setPendingResponse(null);
      } else {
        setPendingResponse(null);
        setResponded(true);
      }
    });
  }

  if (responded) {
    return (
      <div className="rounded-200 border border-neutral-200 bg-neutral-0 p-300">
        <p className="text-body-sm text-neutral-500">Response saved.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-200 rounded-200 border border-brand-calm-600/30 bg-brand-calm-600/5 p-300">
      <div>
        <p className="text-body-sm font-semibold text-neutral-950">
          {invitation.event_title}
        </p>
        <p className="text-body-sm text-neutral-600">
          {invitation.department_name}
          {invitation.sub_team_name ? ` · ${invitation.sub_team_name}` : ""} ·{" "}
          {formatEventDate(invitation.event_date)}
        </p>
      </div>
      <div className="flex items-center gap-200">
        <button
          onClick={() => handleResponse("accepted")}
          disabled={isPending}
          className="rounded-200 bg-semantic-success px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-90 disabled:opacity-50"
        >
          {pendingResponse === "accepted" ? "Saving…" : "Accept"}
        </button>
        <button
          onClick={() => handleResponse("declined")}
          disabled={isPending}
          className="rounded-200 border border-neutral-300 px-300 py-150 text-body-sm font-medium text-neutral-700 transition-colors duration-fast hover:border-neutral-400 hover:text-neutral-950 disabled:opacity-50"
        >
          {pendingResponse === "declined" ? "Saving…" : "Decline"}
        </button>
      </div>
      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
    </div>
  );
}
