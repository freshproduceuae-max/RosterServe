import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole } from "@/lib/auth/roles";
import { getDepartmentById } from "@/lib/departments/queries";
import { getEventById } from "@/lib/events/queries";
import {
  getAssignmentsForRoster,
  getTeamHeadAssignments,
  getAllAssignmentsForEventDept,
  getTeamHeadsInDept,
} from "@/lib/assignments/queries";
import {
  getSkillGapsForDepartmentRoster,
  getHeadcountGapsForRoster,
} from "@/lib/skills/gap-queries";
import { DeptHeadRosterView } from "./_components/dept-head-roster-view";
import { TeamHeadRosterView } from "./_components/team-head-roster-view";
import { SuperAdminRosterView } from "./_components/super-admin-roster-view";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string; deptId: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { role, id: profileId } = session.profile;
  if (!isLeaderRole(role)) redirect("/dashboard");

  const { id: eventId, deptId } = await params;

  const [department, event] = await Promise.all([
    getDepartmentById(deptId),
    getEventById(eventId),
  ]);

  if (!department || !event) notFound();

  // ── Dept head ──────────────────────────────────────────────────────────────
  if (role === "dept_head") {
    if (department.owner_id !== profileId) redirect("/dashboard");
    const [assignments, gapSummary, headcountGaps] = await Promise.all([
      getAssignmentsForRoster(eventId, deptId),
      getSkillGapsForDepartmentRoster(eventId, deptId),
      getHeadcountGapsForRoster(eventId, deptId),
    ]);

    // For each declined team_head assignment, load substitute options (other
    // team owners in the same dept). Deduplicate by volunteerId.
    const declinedTeamIds = [
      ...new Set(
        assignments
          .filter(
            (a) =>
              a.status === "declined" &&
              a.role === "team_head" &&
              a.sub_team_id,
          )
          .map((a) => a.sub_team_id as string),
      ),
    ];

    const substituteSets = await Promise.all(
      declinedTeamIds.map((tid) => getTeamHeadsInDept(deptId, tid)),
    );
    const substituteOptions = substituteSets
      .flat()
      .filter(
        (opt, i, arr) =>
          arr.findIndex((o) => o.volunteerId === opt.volunteerId) === i,
      );

    return (
      <PageShell eventId={eventId} deptId={deptId}>
        <DeptHeadRosterView
          eventId={eventId}
          deptId={deptId}
          eventTitle={event.title}
          department={department}
          assignments={assignments}
          volunteers={[]}
          gapSummary={gapSummary}
          headcountGaps={headcountGaps}
          substituteOptions={substituteOptions}
        />
      </PageShell>
    );
  }

  // ── Team head ──────────────────────────────────────────────────────────────
  if (role === "team_head") {
    const mySubTeams = department.teams.filter(
      (st) => st.owner_id === profileId && st.deleted_at === null,
    );

    if (mySubTeams.length === 0) redirect("/dashboard");

    const subTeamIds = mySubTeams.map((st) => st.id);

    const [assignments, gapSummary, headcountGaps] = await Promise.all([
      getTeamHeadAssignments(eventId, deptId, subTeamIds),
      getSkillGapsForDepartmentRoster(eventId, deptId),
      getHeadcountGapsForRoster(eventId, deptId, subTeamIds),
    ]);

    return (
      <PageShell eventId={eventId} deptId={deptId}>
        <TeamHeadRosterView
          eventTitle={event.title}
          profileId={profileId}
          subTeams={mySubTeams}
          assignments={assignments}
          gapSummary={gapSummary}
          headcountGaps={headcountGaps}
        />
      </PageShell>
    );
  }

  // ── Super admin + all_depts_leader ─────────────────────────────────────────
  if (role === "super_admin" || role === "all_depts_leader") {
    const [assignments, gapSummary, headcountGaps] = await Promise.all([
      getAllAssignmentsForEventDept(eventId, deptId),
      getSkillGapsForDepartmentRoster(eventId, deptId),
      getHeadcountGapsForRoster(eventId, deptId),
    ]);
    return (
      <PageShell eventId={eventId} deptId={deptId}>
        <SuperAdminRosterView
          eventTitle={event.title}
          department={department}
          assignments={assignments}
          gapSummary={gapSummary}
          headcountGaps={headcountGaps}
        />
      </PageShell>
    );
  }

  redirect("/dashboard");
}

function PageShell({
  eventId,
  deptId,
  children,
}: {
  eventId: string;
  deptId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-400">
      <Link
        href={`/events/${eventId}/departments/${deptId}`}
        className="text-body-sm text-neutral-600 hover:text-neutral-950 hover:underline"
      >
        &larr; Back to department
      </Link>
      {children}
    </div>
  );
}
