"use client";

import { useCallback, useState } from "react";
import type { DepartmentForInterests, OnboardingState } from "@/lib/onboarding/types";
import { AvailabilityStep } from "./availability-step";
import { InterestsStep } from "./interests-step";
import { SkillsStep } from "./skills-step";

interface OnboardingFlowProps {
  initialData: OnboardingState;
  departments: DepartmentForInterests[];
}

export function OnboardingFlow({ initialData, departments }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const advance = useCallback(() => {
    setCurrentStep((s) => s + 1);
  }, []);

  if (currentStep === 1) {
    return <AvailabilityStep existing={initialData.availability} onAdvance={advance} />;
  }

  if (currentStep === 2) {
    return (
      <InterestsStep
        departments={departments}
        existing={initialData.interests}
        onAdvance={advance}
      />
    );
  }

  return <SkillsStep existing={initialData.skills} />;
}
