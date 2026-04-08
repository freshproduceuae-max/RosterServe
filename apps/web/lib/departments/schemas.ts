import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Department name is required.")
    .max(100, "Department name must be under 100 characters."),
  ownerId: z.string().uuid("Invalid owner.").optional().or(z.literal("")),
});

export const updateDepartmentSchema = z.object({
  id: z.string().uuid("Invalid department ID."),
  name: z
    .string()
    .trim()
    .min(1, "Department name is required.")
    .max(100, "Department name must be under 100 characters."),
  ownerId: z.string().uuid("Invalid owner.").optional().or(z.literal("")),
});

export const createTeamSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID."),
  name: z
    .string()
    .trim()
    .min(1, "Team name is required.")
    .max(100, "Team name must be under 100 characters."),
  rotationLabel: z.enum(["A", "B", "C"]).optional().or(z.literal("")),
  ownerId: z.string().uuid("Invalid owner.").optional().or(z.literal("")),
});

export const updateTeamSchema = z.object({
  id: z.string().uuid("Invalid team ID."),
  name: z
    .string()
    .trim()
    .min(1, "Team name is required.")
    .max(100, "Team name must be under 100 characters."),
  rotationLabel: z.enum(["A", "B", "C"]).optional().or(z.literal("")),
  ownerId: z.string().uuid("Invalid owner.").optional().or(z.literal("")),
});

export const setHeadcountRequirementSchema = z.object({
  teamId: z.string().uuid("Invalid team ID."),
  eventType: z
    .string()
    .trim()
    .min(1, "Event type is required.")
    .max(100, "Event type must be under 100 characters."),
  requiredCount: z
    .number({ error: "Required count must be a number." })
    .int("Required count must be a whole number.")
    .min(1, "Required count must be at least 1."),
});

export type CreateDepartmentValues = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentValues = z.infer<typeof updateDepartmentSchema>;
export type CreateTeamValues = z.infer<typeof createTeamSchema>;
export type UpdateTeamValues = z.infer<typeof updateTeamSchema>;
export type SetHeadcountRequirementValues = z.infer<typeof setHeadcountRequirementSchema>;
