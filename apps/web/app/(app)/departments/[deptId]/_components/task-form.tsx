"use client";

import { useState, useTransition } from "react";
import { createTask, updateTask } from "@/lib/tasks/actions";

interface TaskFormProps {
  departmentId: string;
  availableSkills: { id: string; name: string }[];
  initialValues?: { id: string; name: string; required_skill_id: string | null };
  onSuccess: () => void;
  onCancel: () => void;
}

export function TaskForm({
  departmentId,
  availableSkills,
  initialValues,
  onSuccess,
  onCancel,
}: TaskFormProps) {
  const isEditing = !!initialValues;
  const [name, setName] = useState(initialValues?.name ?? "");
  const [skillId, setSkillId] = useState(initialValues?.required_skill_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = isEditing
        ? await updateTask(initialValues.id, name, skillId || undefined)
        : await createTask(departmentId, name, skillId || undefined);
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-300 rounded-200 border border-neutral-200 bg-neutral-50 p-300"
    >
      <div className="flex flex-col gap-100">
        <label
          htmlFor="task-name"
          className="text-body-sm font-medium text-neutral-700"
        >
          Task name <span className="text-semantic-error">*</span>
        </label>
        <input
          id="task-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          disabled={isPending}
          placeholder="e.g. Sound desk"
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 placeholder:text-neutral-400 focus:border-brand-calm-600 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-100">
        <label
          htmlFor="task-skill"
          className="text-body-sm font-medium text-neutral-700"
        >
          Required skill
        </label>
        <select
          id="task-skill"
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          disabled={isPending}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none disabled:opacity-50"
        >
          <option value="">No skill required</option>
          {availableSkills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-body-sm text-semantic-error">{error}</p>
      )}

      <div className="flex gap-200">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : isEditing ? "Save changes" : "Add task"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-400 py-200 text-body-sm text-neutral-700 transition-colors duration-fast hover:bg-neutral-100 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
