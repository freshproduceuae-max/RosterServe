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
  getVolunteersForAssignment,
} from "@/lib/assignments/queries";
import { getSkillGapsForDepartmentRoster } from "@/lib/skills/gap-queries";
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
  if (role === "dept_head" && department.owner_id === profileId) {
    const [assignments, volunteers, gapSummary] = await Promise.all([
      getAssignmentsForRoster(eventId, deptId),
      getVolunteersForAssignment(deptId, eventId),
      getSkillGapsForDepartmentRoster(eventId, deptId),
    ]);

    return (
      <PageShell eventId={eventId} deptId={deptId}>
        <DeptHeadRosterView
          eventId={eventId}
          deptId={deptId}
          eventTitle={event.title}
          department={department}
          assignments={assignments}
          volunteers={volunteers}
          gapSummary={gapSummary}
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

    const [assignments, volunteers, gapSummary] = await Promise.all([
      getTeamHeadAssignments(eventId, deptId, subTeamIds),
      getVolunteersForAssignment(deptId, eventId),
      getSkillGapsForDepartmentRoster(eventId, deptId),
    ]);

    return (
      <PageShell eventId={eventId} deptId={deptId}>
        <TeamHeadRosterView
          eventId={eventId}
          deptId={deptId}
          eventTitle={event.title}
          subTeams={mySubTeams}
          assignments={assignments}
          volunteers={volunteers}
          gapSummary={gapSummary}
        />
      </PageShell>
    );
  }

  // ── Super admin ────────────────────────────────────────────────────────────
  if (role === "super_admin") {
    const assignments = await getAllAssignmentsForEventDept(eventId, deptId);

    return (
      <PageShell eventId={eventId} deptId={deptId}>
        <SuperAdminRosterView
          eventTitle={event.title}
          department={department}
          assignments={assignments}
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
