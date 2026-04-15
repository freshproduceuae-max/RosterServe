"use client";

import { useState, useTransition } from "react";
import type { DepartmentTask } from "@/lib/tasks/types";
import { deleteTask } from "@/lib/tasks/actions";
import { TaskForm } from "./task-form";

interface TaskLibrarySectionProps {
  departmentId: string;
  tasks: DepartmentTask[];
  availableSkills: { id: string; name: string }[];
  canManage: boolean;
}

export function TaskLibrarySection({
  departmentId,
  tasks,
  availableSkills,
  canManage,
}: TaskLibrarySectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<DepartmentTask | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPendingDelete, startDeleteTransition] = useTransition();

  function handleFormSuccess() {
    setShowForm(false);
    setEditingTask(null);
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditingTask(null);
  }

  function handleEdit(task: DepartmentTask) {
    setShowForm(false);
    setEditingTask(task);
  }

  function handleDeleteConfirm(taskId: string) {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteTask(taskId);
      if (result.error) {
        setDeleteError(result.error);
        setDeletingTaskId(null);
      } else {
        setDeletingTaskId(null);
      }
    });
  }

  // Hide section if no tasks and cannot manage
  if (!canManage && tasks.length === 0) return null;

  const deletingTask = tasks.find((t) => t.id === deletingTaskId);

  return (
    <section className="flex flex-col gap-300">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 font-semibold text-neutral-950">Task Library</h2>
        {canManage && !showForm && !editingTask && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
          >
            Add task
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <TaskForm
          departmentId={departmentId}
          availableSkills={availableSkills}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {/* Task list */}
      {tasks.length === 0 && canManage && !showForm && (
        <p className="text-body text-neutral-600">
          No tasks yet. Add tasks to build your department&apos;s task library.
        </p>
      )}

      {tasks.length > 0 && (
        <ul className="flex flex-col gap-200">
          {tasks.map((task) => (
            <li key={task.id}>
              {editingTask?.id === task.id ? (
                <TaskForm
                  departmentId={departmentId}
                  availableSkills={availableSkills}
                  initialValues={{
                    id: task.id,
                    name: task.name,
                    required_skill_id: task.required_skill_id,
                  }}
                  onSuccess={handleFormSuccess}
                  onCancel={handleFormCancel}
                />
              ) : (
                <div className="flex items-center justify-between rounded-200 border border-neutral-300 bg-neutral-0 p-400">
                  <div className="flex flex-col gap-100">
                    <span className="text-body font-semibold text-neutral-950">
                      {task.name}
                    </span>
                    {task.required_skill_name && (
                      <span className="rounded-100 border border-neutral-300 bg-neutral-100 px-200 py-50 text-body-sm font-medium text-neutral-700 self-start">
                        requires: {task.required_skill_name}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex gap-200">
                      <button
                        type="button"
                        onClick={() => handleEdit(task)}
                        className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingTaskId(task.id);
                        }}
                        className="rounded-200 border border-semantic-error/30 bg-neutral-0 px-300 py-100 text-body-sm text-semantic-error transition-colors duration-fast hover:bg-semantic-error/10"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleteError && (
        <p className="text-body-sm text-semantic-error">{deleteError}</p>
      )}

      {/* Delete confirmation modal */}
      {deletingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-400">
          <div className="w-full max-w-md rounded-300 border border-neutral-300 bg-neutral-0 p-500 shadow-lg">
            <h2 className="font-display text-h3 text-neutral-950">
              Delete {deletingTask.name}?
            </h2>
            <p className="mt-200 text-body text-neutral-700">
              Deleting this task will remove it from the library and unassign it
              from all upcoming events.
            </p>
            {deleteError && (
              <p className="mt-200 text-body-sm text-semantic-error">{deleteError}</p>
            )}
            <div className="mt-400 flex gap-200">
              <button
                type="button"
                onClick={() => setDeletingTaskId(null)}
                disabled={isPendingDelete}
                className="rounded-200 border border-neutral-300 bg-neutral-0 px-400 py-200 text-body text-neutral-700 transition-colors duration-fast hover:bg-neutral-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deletingTask.id)}
                disabled={isPendingDelete}
                className="rounded-200 bg-semantic-error px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-semantic-error/90 disabled:opacity-50"
              >
                {isPendingDelete ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
