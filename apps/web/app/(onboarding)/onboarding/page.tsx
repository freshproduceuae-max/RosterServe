import { getSessionWithProfile } from "@/lib/auth/session";
import {
  getActiveDepartmentsForInterests,
  getOnboardingState,
} from "@/lib/onboarding/queries";
import { OnboardingFlow } from "./_components/onboarding-flow";

export default async function OnboardingPage() {
  // Session is guaranteed by (onboarding)/layout.tsx — redundant check as safety net.
  const session = await getSessionWithProfile();
  if (!session) return null;

  const [onboardingState, departments] = await Promise.all([
    getOnboardingState(session.user.id),
    getActiveDepartmentsForInterests(),
  ]);

  return <OnboardingFlow initialData={onboardingState} departments={departments} />;
}
