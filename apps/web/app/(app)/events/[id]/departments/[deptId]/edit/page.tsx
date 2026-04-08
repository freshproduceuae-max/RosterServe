import { redirect } from "next/navigation";

export default async function LegacyDepartmentEditPage({
  params,
}: {
  params: Promise<{ deptId: string }>;
}) {
  const { deptId } = await params;
  redirect(`/departments/${deptId}/edit`);
}
