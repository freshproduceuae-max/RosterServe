"use client";

import { useActionState, useState } from "react";
import { finishOnboarding } from "@/lib/onboarding/actions";
import type { VolunteerSkill } from "@/lib/onboarding/types";
import { StepIndicator } from "./step-indicator";

interface SkillsStepProps {
  existing: VolunteerSkill[];
}

export function SkillsStep({ existing }: SkillsStepProps) {
  const [state, formAction, isPending] = useActionState(finishOnboarding, undefined);

  const [skills, setSkills] = useState<string[]>(
    existing.filter((s) => s.status === "pending").map((s) => s.name)
  );
  const [input, setInput] = useState("");

  function addSkill() {
    const trimmed = input.trim();
    if (trimmed && !skills.includes(trimmed)) {
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
        Add any skills you&apos;d like to be known for. A leader will review them. You can
        always update this later.
      </p>

      <form action={formAction} className="flex flex-col gap-500">
        {/* Hidden inputs carry skill values to the server action */}
        {skills.map((skill) => (
          <input key={skill} type="hidden" name="skill" value={skill} />
        ))}

        {/* Skill input + Add */}
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

        {state && "error" in state && (
          <p className="text-body-sm text-semantic-error">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-pill bg-brand-warm-500 px-500 py-200 text-body font-semibold text-neutral-950 transition-colors duration-fast hover:bg-brand-warm-500/90 disabled:opacity-50"
        >
          {isPending ? "Setting up your profile…" : "Complete setup"}
        </button>
      </form>
    </div>
  );
}
