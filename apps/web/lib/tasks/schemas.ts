import { z } from "zod";

export const createTaskSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID."),
  name: z
    .string()
    .trim()
    .min(1, "Task name is required.")
    .max(100, "Task name must be under 100 characters."),
  requiredSkillId: z.string().uuid("Invalid skill.").optional().or(z.literal("")),
});

export const updateTaskSchema = z.object({
  id: z.string().uuid("Invalid task ID."),
  name: z
    .string()
    .trim()
    .min(1, "Task name is required.")
    .max(100, "Task name must be under 100 characters."),
  requiredSkillId: z.string().uuid("Invalid skill.").optional().or(z.literal("")),
});

export type CreateTaskValues = z.infer<typeof createTaskSchema>;
export type UpdateTaskValues = z.infer<typeof updateTaskSchema>;
