import { z } from "zod";

export const createInstructionSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  body: z
    .string()
    .max(2000, "Notes must be 2000 characters or fewer")
    .optional(),
  // Empty string means no team selected (dept-level); UUID means team-specific
  team_id: z
    .string()
    .uuid("Invalid team selection")
    .optional()
    .or(z.literal("")),
});
