import { z } from "zod";

export const createDepartmentSchema = z.object({
  eventId: z.string().uuid("Invalid event ID."),
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

export const createSubTeamSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID."),
  name: z
    .string()
    .trim()
    .min(1, "Sub-team name is required.")
    .max(100, "Sub-team name must be under 100 characters."),
  ownerId: z.string().uuid("Invalid owner.").optional().or(z.literal("")),
});

export const updateSubTeamSchema = z.object({
  id: z.string().uuid("Invalid sub-team ID."),
  name: z
    .string()
    .trim()
    .min(1, "Sub-team name is required.")
    .max(100, "Sub-team name must be under 100 characters."),
  ownerId: z.string().uuid("Invalid owner.").optional().or(z.literal("")),
});

export type CreateDepartmentValues = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentValues = z.infer<typeof updateDepartmentSchema>;
export type CreateSubTeamValues = z.infer<typeof createSubTeamSchema>;
export type UpdateSubTeamValues = z.infer<typeof updateSubTeamSchema>;
