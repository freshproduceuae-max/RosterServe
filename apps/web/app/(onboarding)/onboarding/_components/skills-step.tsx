"use client";

import { useActionState, useState } from "react";
import { saveVolunteerSkills, finishOnboarding } from "@/lib/onboarding/actions";
import type { VolunteerSkill } from "@/lib/onboarding/types";
import { StepIndicator } from "./step-indicator";

interface SkillsStepProps {
  existing: VolunteerSkill[];
}

export function SkillsStep({ existing }: SkillsStepProps) {
  // Two independent action states: one for intermediate save, one for completion.
  const [saveState, saveFormAction, isSavePending] = useActionState(
    saveVolunteerSkills,
    undefined
  );
  const [finishState, finishFormAction, isFinishPending] = useActionState(
    finishOnboarding,
    undefined
  );

  const [skills, setSkills] = useState<string[]>(
    existing.filter((s) => s.status === "pending").map((s) => s.name)
  );
  const [input, setInput] = useState("");

  function addSkill() {
    const trimmed = input.trim();
    if (trimmed && !skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills([...skills, trimmed]);
    }
    setInput("");
  }

  function removeSkill(name: string) {
    setSkills(skills.filter((s) => s !== name));
  }

  return (
    <div className="mx-auto w-full max-w-md px-300 py-700">
      <div className="mb-400 text-center">
        <span className="font-display text-h3 text-neutral-950">RosterServe</span>
      </div>

      <StepIndicator currentStep={3} totalSteps={3} />

      <h1 className="mb-100 font-display text-h2 text-neutral-950">
        What are your skills?
      </h1>
      <p className="mb-500 text-body text-neutral-600">
        Add any skills you&apos;d like to be known for. A leader will review them. You
        can always update this later.
      </p>

      {/*
        Single form — both submit buttons share the same skill inputs.
        "Save skills" uses formAction to call saveVolunteerSkills (no redirect).
        "Complete setup" uses the form's action to call finishOnboarding (redirects).
      */}
      <form action={finishFormAction} className="flex flex-col gap-500">
        {/* Hidden inputs carry skill values to whichever server action runs */}
        {skills.map((skill) => (
          <input key={skill} type="hidden" name="skill" value={skill} />
        ))}

        {/* Skill text input + Add */}
        <div className="flex gap-200">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="e.g. Guitar, Sound engineering"
            maxLength={100}
            className="flex-1 rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 outline-none transition-colors duration-fast focus:border-brand-warm-500 focus:ring-2 focus:ring-brand-warm-500/20"
          />
          <button
            type="button"
            onClick={addSkill}
            disabled={!input.trim()}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body-sm font-semibold text-neutral-950 transition-colors duration-fast hover:bg-neutral-100 disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {/* Skill list */}
        {skills.length > 0 && (
          <ul className="flex flex-col gap-100">
            {skills.map((skill) => (
              <li
                key={skill}
                className="flex items-center justify-between rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200"
              >
                <span className="text-body text-neutral-950">{skill}</span>
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="text-body-sm text-neutral-600 transition-colors duration-fast hover:text-semantic-error"
                  aria-label={`Remove ${skill}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Inline error and save confirmation */}
        {saveState && "error" in saveState && (
          <p className="text-body-sm text-semantic-error">{saveState.error}</p>
        )}
        {saveState && "success" in saveState && (
          <p className="text-body-sm text-semantic-success">
            Skills saved — they&apos;ll be here if you close the browser and come back.
          </p>
        )}
        {finishState && "error" in finishState && (
          <p className="text-body-sm text-semantic-error">{finishState.error}</p>
        )}

        <div className="flex flex-col gap-200">
          {/* Intermediate save — persists skills without completing onboarding */}
          <button
            type="submit"
            formAction={saveFormAction}
            disabled={isSavePending || isFinishPending}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-500 py-200 text-body font-semibold text-neutral-950 transition-colors duration-fast hover:bg-neutral-100 disabled:opacity-50"
          >
            {isSavePending ? "Saving…" : "Save skills"}
          </button>

          {/* Final completion — saves any remaining skills and marks onboarding done */}
          <button
            type="submit"
            disabled={isSavePending || isFinishPending}
            className="rounded-pill bg-brand-warm-500 px-500 py-200 text-body font-semibold text-neutral-950 transition-colors duration-fast hover:bg-brand-warm-500/90 disabled:opacity-50"
          >
            {isFinishPending ? "Setting up your profile…" : "Complete setup"}
          </button>
        </div>
      </form>
    </div>
  );
}
