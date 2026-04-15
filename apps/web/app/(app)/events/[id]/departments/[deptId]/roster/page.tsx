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
  getCrossTeamSuggestions,
} from "@/lib/assignments/queries";
import {
  getSkillGapsForDepartmentRoster,
  getHeadcountGapsForRoster,
} from "@/lib/skills/gap-queries";
import { DeptHeadRosterView } from "./_components/dept-head-roster-view";
import { TeamHeadRosterView } from "./_components/team-head-roster-view";
import { SuperAdminRosterView } from "./_components/super-admin-roster-view";
import { getEventTaskSlotsWithCandidates } from "@/lib/tasks/queries";

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
    const [assignments, gapSummary, headcountGaps, crossTeamSuggestions, taskData] =
      await Promise.all([
        getAssignmentsForRoster(eventId, deptId),
        getSkillGapsForDepartmentRoster(eventId, deptId),
        getHeadcountGapsForRoster(eventId, deptId),
        getCrossTeamSuggestions(eventId, deptId),
        getEventTaskSlotsWithCandidates(eventId, deptId),
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
          crossTeamSuggestions={crossTeamSuggestions}
          taskSlots={taskData.slots}
          candidatesByTask={taskData.candidatesByTask}
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

    // Skill gaps are department-wide (pre-existing behaviour: team_head sees full dept
    // skill coverage to understand the whole picture). Headcount gaps are scoped to
    // the team_head's own teams via subTeamIds.
    const [assignments, gapSummary, headcountGaps] = await Promise.all([
      getTeamHeadAssignments(eventId, deptId, subTeamIds),
      getSkillGapsForDepartmentRoster(eventId, deptId),
      getHeadcountGapsForRoster(eventId, deptId, subTeamIds),
    ]);

    // Scope task candidates to team head's own team members only (D6)
    const ownTeamMemberIds = assignments
      .filter((a) => subTeamIds.includes(a.sub_team_id ?? ""))
      .map((a) => a.volunteer_id)
      .filter((id): id is string => !!id);
    const taskData = await getEventTaskSlotsWithCandidates(eventId, deptId, ownTeamMemberIds);

    return (
      <PageShell eventId={eventId} deptId={deptId}>
        <TeamHeadRosterView
          eventId={eventId}
          deptId={deptId}
          eventTitle={event.title}
          profileId={profileId}
          subTeams={mySubTeams}
          assignments={assignments}
          gapSummary={gapSummary}
          headcountGaps={headcountGaps}
          taskSlots={taskData.slots}
          candidatesByTask={taskData.candidatesByTask}
        />
      </PageShell>
    );
  }

  // ── Super admin + all_depts_leader ─────────────────────────────────────────
  if (role === "super_admin" || role === "all_depts_leader") {
    const [assignments, gapSummary, headcountGaps, taskData] = await Promise.all([
      getAllAssignmentsForEventDept(eventId, deptId),
      getSkillGapsForDepartmentRoster(eventId, deptId),
      getHeadcountGapsForRoster(eventId, deptId),
      getEventTaskSlotsWithCandidates(eventId, deptId),
    ]);
    return (
      <PageShell eventId={eventId} deptId={deptId}>
        <SuperAdminRosterView
          eventTitle={event.title}
          department={department}
          assignments={assignments}
          gapSummary={gapSummary}
          headcountGaps={headcountGaps}
          taskSlots={taskData.slots}
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
      <div className="flex items-center justify-between">
        <Link
          href={`/events/${eventId}/departments/${deptId}`}
          className="text-body-sm text-neutral-600 hover:text-neutral-950 hover:underline"
        >
          &larr; Back to department
        </Link>
        <Link
          href={`/events/${eventId}/departments/${deptId}/instructions`}
          className="text-body-sm text-brand-calm-600 underline-offset-2 hover:underline"
        >
          Instructions
        </Link>
      </div>
      {children}
    </div>
  );
}
