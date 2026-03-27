# RosterServe

## Project Summary
- RosterServe is a church rostering platform for leaders and volunteers.
- It matches volunteers to roles using availability and approved skills.
- It centralizes assignments, instructions, media, and roster visibility that currently live in spreadsheets, WhatsApp, and email.

## Canonical Product Authority
- The canonical vision document is `/VisionDocument_ChurchRosterApp.md`.
- Treat that file as the source of truth for product scope, roles, constraints, UX direction, and v1 boundaries.
- If another doc conflicts with the vision, the vision wins until an explicit approved update changes it.
- Do not invent product scope, integrations, or workflows beyond the vision.

## Confirmed Stack
- Frontend: Next.js + TypeScript + Tailwind CSS.
- Backend platform: Supabase for Postgres, Auth, Storage, Realtime, and RLS.
- Deployment: Vercel.
- Supporting libraries expected: Zod, date-fns, and Resend or Supabase Edge Functions for email flows.
- Do not switch to a Prisma-first architecture unless an approved plan explains why Supabase-native patterns are insufficient.

## Current Repo State
- Scaffolding and RS-F001 (Authentication and role access) are implemented.
- The repo contains a runnable Next.js app at `/apps/web/`, Supabase config at `/supabase/`, and auth infrastructure (migration, middleware, auth library, sign-in/sign-up UI, role-aware dashboard stub).
- Canonical docs: `/VisionDocument_ChurchRosterApp.md`, `/CLAUDE.md`, and the full `/docs/` workspace.
- 1 of 15 features completed (RS-F001). Next: RS-F002.

## Key Paths
- Current vision: `/VisionDocument_ChurchRosterApp.md`
- Operating contract: `/CLAUDE.md`
- Canonical docs workspace for future project docs: `/docs/`
- Future PRD path: `/docs/prd/prd.md`
- Future feature docs path: `/docs/features/`
- Future implementation plans path: `/docs/plans/`
- Future design-system docs path: `/docs/design-system/`
- Canonical design-system doc: `/docs/design-system/design-system.md`
- Future handoff docs path: `/docs/handoffs/`
- Future tracking docs path: `/docs/tracking/`
- Recommended application root when implementation begins: `/apps/web/`
- Recommended Supabase root when backend setup begins: `/supabase/`

## Architecture Workflow
1. Audit repo and documents.
2. Confirm the canonical vision.
3. Complete design-system normalization.
4. Create the PRD from the normalized design direction.
5. Break approved scope into feature docs with stable feature IDs.
6. Write an implementation plan for each approved feature or delivery slice.
7. Begin implementation only after the relevant plan is approved.
8. Verify behavior and update docs that changed.

## Documentation Authority Rules
- Authority order: Vision -> design-system docs -> PRD -> feature docs -> implementation plans -> handoffs/tracking notes.
- Higher-authority docs override lower-authority docs.
- Working docs belong in `/docs/`; avoid scattering planning docs across the repo.
- Do not treat chat history as durable authority. Important decisions must be written into the correct doc.
- If a decision changes scope, UX rules, naming, or architecture, update the authoritative doc in the same change.

## Naming Rules
- Use lowercase kebab-case for doc file names.
- Do not use spaces, `final`, `new`, `latest`, or version suffixes like `v2` unless versioning is intentional and approved.
- Feature IDs use `RS-F001`, `RS-F002`, `RS-F003`, and continue sequentially.
- Feature docs use `/docs/features/<feature-id>-<slug>.md`.
- Implementation plans use `/docs/plans/plan-<feature-id>-<slug>.md`.
- The canonical design-system doc is `/docs/design-system/design-system.md`.
- Supplemental design-system docs use `/docs/design-system/design-system-<topic>.md`.
- Handoff docs should later use `/docs/handoffs/YYYY-MM-DD-<topic>.md`.
- Tracking docs should later include `/docs/tracking/feature-status.md` and `/docs/tracking/decision-log.md`.

## Execution Guardrails
- No implementation starts before an approved implementation plan exists.
- Design-system normalization must happen before PRD creation.
- Do not create the PRD or feature list until design-system normalization is complete and approved.
- Preserve the role hierarchy and data visibility model defined in the vision.
- All destructive or high-impact actions require confirmation UX.
- All deletes must remain soft-delete with admin approval before permanent removal.
- Only approved skills count in skill-gap calculations.
- Never expose volunteer contact details outside allowed views.
- Never hardcode role checks; centralize authorization rules.
- Prefer small, reviewable increments and keep docs aligned with the current approved plan.
