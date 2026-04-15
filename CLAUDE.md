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
- All 20 features complete (RS-F001–RS-F020) as of 2026-04-15.
- Phase 2 production hardening complete (phases A–F) as of 2026-04-15.
- Application is live on Vercel. All 38 migrations applied to production Supabase.
- Canonical docs: `/VisionDocument_ChurchRosterApp.md`, `/CLAUDE.md`, and the full `/docs/` workspace.
- No next feature scheduled. Any new work requires a new approved plan in `/docs/plans/`.

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

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
