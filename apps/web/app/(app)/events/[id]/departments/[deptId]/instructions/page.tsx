import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/events/queries";
import { getInstructionsForDept } from "@/lib/instructions/queries";
import { InstructionCard } from "./_components/instruction-card";
import { CreateInstructionForm } from "./_components/create-instruction-form";

export default async function InstructionsPage({
  params,
}: {
  params: Promise<{ id: string; deptId: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { id: eventId, deptId } = await params;
  const { role, id: profileId } = session.profile;

  const supabase = await createSupabaseServerClient();

  // Fetch event (for breadcrumb title)
  const event = await getEventById(eventId);
  if (!event) notFound();

  // Fetch department + its teams
  const { data: dept } = await supabase
    .from("departments")
    .select("id, name, owner_id, teams(id, name, owner_id, deleted_at)")
    .eq("id", deptId)
    .is("deleted_at", null)
    .single();

  if (!dept) notFound();

  // ── Role guards ────────────────────────────────────────────────────────────

  if (role === "dept_head" && dept.owner_id !== profileId) {
    redirect("/dashboard");
  }

  if (role === "team_head") {
    type TeamRow = { id: string; owner_id: string | null; deleted_at: string | null };
    const deptTeams = (dept.teams as unknown as TeamRow[]) ?? [];
    const myTeams = deptTeams.filter(
      (t) => t.owner_id === profileId && t.deleted_at === null,
    );
    if (myTeams.length === 0) redirect("/dashboard");
  }

  if (role === "volunteer" || role === "supporter") {
    // Verify they have an active assignment in this dept+event
    const { count } = await supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("volunteer_id", profileId)
      .eq("department_id", deptId)
      .eq("event_id", eventId)
      .neq("status", "declined")
      .is("deleted_at", null);
    if (!count || count === 0) redirect("/dashboard");
  }

  // Redirect roles with no access
  if (
    !["dept_head", "team_head", "all_depts_leader", "super_admin", "volunteer", "supporter"].includes(
      role,
    )
  ) {
    redirect("/dashboard");
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  const instructions = await getInstructionsForDept(eventId, deptId);

  const isLeader = [
    "dept_head",
    "team_head",
    "all_depts_leader",
    "super_admin",
  ].includes(role);

  type TeamRow = { id: string; name: string; owner_id: string | null; deleted_at: string | null };
  const allActiveDeptTeams = ((dept.teams as unknown as TeamRow[]) ?? []).filter(
    (t) => t.deleted_at === null,
  );

  // team_head can only post to their own teams
  const formTeams =
    role === "team_head"
      ? allActiveDeptTeams.filter((t) => t.owner_id === profileId)
      : allActiveDeptTeams;

  // team_head cannot post dept-level instructions
  const allowDeptLevel = role !== "team_head";

  return (
    <div className="flex flex-col gap-400">
      {/* Back link */}
      <Link
        href={`/events/${eventId}/departments/${deptId}/roster`}
        className="text-body-sm text-neutral-600 hover:text-neutral-950 hover:underline"
      >
        &larr; Back to roster
      </Link>

      {/* Page header */}
      <div>
        <h1 className="font-display text-h1 text-neutral-950">Instructions</h1>
        <p className="mt-50 text-body-sm text-neutral-600">
          {event.title} · {dept.name}
        </p>
      </div>

      {/* Create form — leaders only */}
      {isLeader && (
        <CreateInstructionForm
          eventId={eventId}
          deptId={deptId}
          teams={formTeams.map((t) => ({ id: t.id, name: t.name }))}
          allowDeptLevel={allowDeptLevel}
        />
      )}

      {/* Instructions list */}
      {instructions.length === 0 ? (
        <p className="text-body text-neutral-600">No instructions posted yet.</p>
      ) : (
        <div className="flex flex-col gap-300">
          {instructions.map((instruction) => (
            <InstructionCard
              key={instruction.id}
              instruction={instruction}
              eventId={eventId}
              deptId={deptId}
              canDelete={
                isLeader &&
                (instruction.created_by === profileId ||
                  role === "dept_head" ||
                  role === "all_depts_leader" ||
                  role === "super_admin")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
