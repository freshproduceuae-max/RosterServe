import { redirect } from "next/navigation";

export default async function LegacySubTeamEditPage({
  params,
}: {
  params: Promise<{ deptId: string; subTeamId: string }>;
}) {
  const { deptId, subTeamId } = await params;
  redirect(`/departments/${deptId}/teams/${subTeamId}/edit`);
}
