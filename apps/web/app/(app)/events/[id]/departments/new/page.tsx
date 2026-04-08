import { redirect } from "next/navigation";

export default async function LegacyDepartmentsNewPage() {
  redirect("/departments/new");
}
