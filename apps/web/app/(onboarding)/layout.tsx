import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionWithProfile();

  // No session → sign in
  if (!session) redirect("/sign-in");

  // Non-volunteer roles go to their dashboard (no onboarding needed)
  if (session.profile.role !== "volunteer") redirect("/dashboard");

  // Already completed → skip back to dashboard (no re-gating)
  if (session.profile.onboarding_complete) redirect("/dashboard");

  return <div className="min-h-screen bg-surface-warm">{children}</div>;
}
