import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import { getAssignmentsForVolunteer } from "@/lib/assignments/queries";
import { ServiceRequestCard } from "./_components/service-request-card";

export default async function AssignmentsPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { role } = session.profile;
  // Leaders use the roster page within events; this page is for volunteers, team
  // heads, and supporters who need a central place to respond to requests.
  if (
    role !== "volunteer" &&
    role !== "team_head" &&
    role !== "supporter"
  ) {
    redirect("/dashboard");
  }

  const assignments = await getAssignmentsForVolunteer();

  return (
    <div className="flex flex-col gap-500">
      <div>
        <h1 className="text-h1 text-neutral-950">Requests to Serve</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Events you have been asked to serve in.
        </p>
      </div>

      {assignments.length === 0 ? (
        <p className="text-body-sm text-neutral-500">
          No requests to serve yet.
        </p>
      ) : (
        <div className="flex flex-col gap-300">
          {assignments.map((a) => (
            <ServiceRequestCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
}
