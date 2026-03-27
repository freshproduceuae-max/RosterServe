import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSessionWithProfile();

  if (session) {
    redirect("/dashboard");
  }

  redirect("/auth/sign-in");
}
