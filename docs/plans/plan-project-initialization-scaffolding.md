# Plan: Project Initialization Scaffolding

Status: Implemented
Type: One-time setup
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md
Tracking Docs: docs/tracking/progress.md, docs/tracking/claude-progress.txt

## Objective

Create the minimum runnable project foundation required to begin feature-by-feature implementation without mixing application setup into `RS-F001` and later feature plans.

## Why Scaffolding Is Necessary

The repo currently contains only canonical documentation. It does not yet contain:
- a runnable Next.js application
- a workspace or package manifest
- shared environment configuration
- a Supabase project directory
- base design-system token wiring

Without this one-time setup, the first feature plan would be forced to absorb generic initialization work that is not part of the feature itself. That would blur the execution boundary between setup and product work, especially for `RS-F001`, `RS-F002`, and `RS-F003`.

## Scope And Non-Goals

Included:
- root workspace initialization for the documented stack
- creation of the application root at `apps/web/`
- creation of the backend project root at `supabase/`
- minimal environment and configuration setup required for later auth and data work
- base design-token and global-style wiring needed by all UI work
- a neutral application shell that proves the app boots, without implementing product features

Explicitly excluded:
- authentication flows
- role logic or route protection
- event, department, sub-team, or assignment features
- database schema for product entities
- feature-specific UI screens
- notifications, jobs, or media handling
- speculative shared abstractions with no immediate use

## Files Or Areas To Create Or Modify

Root:
- `package.json`
- workspace manifest for the chosen package manager
- lockfile for the chosen package manager
- `.gitignore`
- `.env.example`

Application:
- `apps/web/`
- Next.js App Router setup
- TypeScript configuration
- Tailwind setup required by the chosen version
- app-level layout and neutral shell route
- global styles, font wiring, and base design tokens
- shared env access helpers
- shared Supabase client/server setup points only

Backend project:
- `supabase/`
- project configuration required to support later auth and data work
- placeholder migration or schema area only if required by the selected Supabase workflow

## Implementation Steps

1. Initialize the repository as a runnable workspace aligned to the documented stack and path conventions.
2. Create `apps/web/` as a Next.js + TypeScript + Tailwind application using the App Router.
3. Add the minimum root and app configuration required for install, dev, typecheck, and lint workflows.
4. Wire the canonical design-system foundation into global styles:
   - font loading for the approved font stack
   - base color, spacing, radius, and motion tokens
   - neutral application shell styling only
5. Create shared environment configuration and `.env.example` entries for the baseline web app and Supabase integration.
6. Create the `supabase/` project root and only the base configuration needed for later auth and database work.
7. Add shared Supabase integration entry points for later feature work, without implementing auth flows or feature data access.
8. Verify the initialized app installs, boots, and renders a neutral shell without feature behavior.

## Acceptance Criteria

- The repo contains a runnable root workspace and an application at `apps/web/`.
- The repo contains a `supabase/` directory prepared for later feature work.
- The web app uses the documented stack direction: Next.js, TypeScript, Tailwind, and design-system-aligned global styling.
- Base design tokens and font choices are wired centrally, not scattered into feature code.
- Environment variables required for baseline app and Supabase setup are documented in `.env.example`.
- The initialized app can boot to a neutral non-feature shell.
- No product feature behavior from `RS-F001` or later is implemented in this scaffolding pass.

## Risks Or Blockers

- Package-manager choice must stay consistent once initialization is implemented.
- Tailwind version choice may affect the exact config files created.
- Supabase local workflow details may require small implementation adjustments depending on selected tooling.
- The app shell must stay neutral so feature work does not get smuggled into setup.

## How This Enables The First Features

This setup enables:
- `RS-F001` to focus on authentication and role access instead of creating the app from scratch
- `RS-F002` and `RS-F003` to land inside an existing application and backend structure
- all UI features to inherit one token-driven design baseline from the start

This plan does not pre-build those features. It only removes generic initialization work from their implementation scope.

## Implementation Result

Implemented:
- root npm workspace initialization with shared scripts
- root `.gitignore`, `.env.example`, and generated `package-lock.json`
- `apps/web/` Next.js App Router application with TypeScript, Tailwind, linting, and build configuration
- centralized global design tokens, font wiring, and a neutral non-feature shell route
- shared environment helper and Supabase browser/server client entry points
- `supabase/` project root with base configuration and migrations directory

Remaining open:
- None within the approved scaffolding scope

Deviations from the approved plan:
- npm workspaces were used, so the root `package.json` serves as the workspace manifest and no separate workspace manifest file was needed
- Supabase setup was kept at the configuration-entry-point level only; no local auth or schema behavior was introduced

Validation run:
- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- dev-server smoke test with HTTP `200` response from the neutral shell
