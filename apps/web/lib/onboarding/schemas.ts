import { z } from "zod";

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const TIMES = ["morning", "afternoon", "evening"] as const;

export const availabilityPreferencesSchema = z.object({
  preferred_days: z.array(z.enum(DAYS)).default([]),
  preferred_times: z.array(z.enum(TIMES)).default([]),
});

export const volunteerInterestsSchema = z.object({
  department_ids: z.array(z.string().uuid("Invalid department ID.")).default([]),
});

export const volunteerSkillsSchema = z.object({
  skills: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Skill name cannot be empty.")
        .max(100, "Each skill must be under 100 characters.")
    )
    .default([]),
});

export type AvailabilityPreferencesValues = z.infer<typeof availabilityPreferencesSchema>;
export type VolunteerInterestsValues = z.infer<typeof volunteerInterestsSchema>;
export type VolunteerSkillsValues = z.infer<typeof volunteerSkillsSchema>;
