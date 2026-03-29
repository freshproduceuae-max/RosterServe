interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-500">
      <p className="mb-200 text-label text-neutral-600">
        Step {currentStep} of {totalSteps}
      </p>
      <div className="h-1 w-full rounded-pill bg-neutral-300">
        <div
          className="h-1 rounded-pill bg-brand-warm-500 transition-all duration-slow"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
