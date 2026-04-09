import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import {
  getSoftDeletedRecords,
  getSupporterAssignments,
  getLeaderProfiles,
} from "@/lib/admin/queries";
import { DeleteApprovalTable } from "./_components/delete-approval-table";
import { SupporterAssignmentsSection } from "./_components/supporter-assignments-section";

export default async function AdminOversightPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (session.profile.role !== "super_admin") redirect("/dashboard");

  const [records, supporters, leaders] = await Promise.all([
    getSoftDeletedRecords(),
    getSupporterAssignments(),
    getLeaderProfiles(),
  ]);

  return (
    <div className="flex flex-col gap-400">
      <div>
        <h1 className="font-display text-h1 text-neutral-950">
          Admin oversight
        </h1>
        <p className="text-body-sm text-neutral-600">
          Review and action soft-deleted records. Restore to make them active
          again, or delete permanently.
        </p>
      </div>

      {records.total === 0 ? (
        <p className="text-body-sm text-neutral-500">
          No records pending review.
        </p>
      ) : (
        <>
          <DeleteApprovalTable
            records={records.departments}
            sectionTitle="Departments"
          />
          <DeleteApprovalTable
            records={records.events}
            sectionTitle="Events"
          />
          <DeleteApprovalTable
            records={records.teams}
            sectionTitle="Teams"
          />
        </>
      )}

      <SupporterAssignmentsSection
        supporters={supporters}
        leaders={leaders}
      />
    </div>
  );
}
