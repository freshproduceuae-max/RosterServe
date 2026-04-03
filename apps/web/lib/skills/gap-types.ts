/**
 * GapState — describes the skill coverage state for a department roster.
 *
 * no_requirements  — no required skills defined; gap detection is inactive
 * fully_covered    — all required skills are held by at least one assigned volunteer
 * partial          — some required skills are covered, some are not
 * uncovered        — required skills exist but none are covered
 */
export type GapState =
  | "no_requirements"
  | "fully_covered"
  | "partial"
  | "uncovered";

/**
 * RosterGapSummary — result of a gap detection query for one event+department.
 *
 * required  — names of required skills (is_required = true catalog skills)
 * covered   — names of required skills held by at least one assigned volunteer
 *             with status = 'approved'
 * gaps      — names of required skills not yet covered
 * state     — derived summary state
 */
export type RosterGapSummary = {
  required: string[];
  covered: string[];
  gaps: string[];
  state: GapState;
};
