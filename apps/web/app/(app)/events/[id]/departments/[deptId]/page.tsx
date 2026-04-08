import { redirect } from "next/navigation";

export default async function LegacyDepartmentDetailPage({
  params,
}: {
  params: Promise<{ deptId: string }>;
}) {
  const { deptId } = await params;
  redirect(`/departments/${deptId}`);
}
