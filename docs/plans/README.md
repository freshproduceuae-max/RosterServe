# Implementation Plans

## Purpose

This directory holds the required implementation plan for each feature before any code work begins.

The only allowed non-feature exception is a single bounded initialization or scaffolding plan when the repo is not yet runnable enough for normal feature execution.

The canonical workflow is:
1. Select the next feature from `docs/features/feature-list.json`
2. Create the feature plan in this directory
3. Review the plan
4. Explicitly approve the plan
5. Implement the feature
6. Review and validate the implementation
7. Update `docs/tracking/progress.md` and `docs/tracking/claude-progress.txt`

## Hard Rule

No approved plan = no code.

For avoidance of doubt:
- a feature requires its own approved feature plan
- one-time initialization work requires an approved scaffolding plan
- no other non-feature implementation plan types are allowed unless explicitly approved

That includes:
- application code
- scaffolding
- schema changes
- auth or access control changes
- infrastructure changes
- migrations
- tests written as part of implementation

Exploration and document drafting are allowed before approval. Implementation is not.

## File Naming

Use:

`docs/plans/plan-<feature-id-lowercase>-<slug>.md`

Example:

`docs/plans/plan-rs-f001-authentication-and-role-access.md`

## Required Plan Statuses

Each plan must carry a clear status near the top:
- `Draft`
- `In Review`
- `Approved`
- `Implemented`
- `Reviewed`
- `Blocked`

Approval means an explicit instruction to proceed. Do not infer approval.

## Required Plan Structure

Every implementation plan must contain all sections below.

### 1. Header

Include:
- feature ID
- feature name
- status
- source references:
  - PRD path
  - feature-list path
  - design-system path when `ui: true`

### 2. Objective

State the intended outcome of the feature in product terms, not code terms.

### 3. Scope And Non-Goals

List what the plan covers and what it intentionally does not cover in this pass.

### 4. Approach

Describe the implementation strategy at a level that another engineer can execute without re-deriving the architecture.

### 5. Files To Create Or Modify

List expected file paths and explain why each file is involved.

### 6. Rollout / Migration / Access Impact

This section is required whenever the feature touches any of:
- schema or data model
- authentication
- authorization
- roles or permissions
- storage
- background jobs
- infrastructure
- environment variables

If none apply, explicitly say `None`.

### 7. Numbered Implementation Steps

Provide an ordered list of concrete implementation steps.

Rules:
- steps must be numbered
- steps must be execution-sized
- steps must be specific enough to review
- steps must not mix unrelated work

### 8. Acceptance Criteria Mapping

Map the plan back to the feature registry.

Required:
- every feature `steps` entry from `docs/features/feature-list.json`
- the relevant PRD validation items
- the concrete verification expected after implementation

### 9. Style Guardrails For UI Work

Required for any feature with `ui: true`.

Reference `docs/design-system/design-system.md` and call out:
- target surfaces and users
- component patterns involved
- tone and copy posture
- layout and spacing considerations
- any states that need special fidelity, such as empty, loading, error, confirm, or dense dashboard views

If the feature is non-UI, say `No direct UI surface`.

### 10. Risks Or Blockers

List meaningful risks, open questions, or sequencing concerns.

### 11. Validation Plan

List the checks to run after implementation. Include manual validation and any automated tests expected.

### 12. Documentation Updates

State which docs must be updated when the feature lands, at minimum:
- `docs/tracking/progress.md`
- `docs/tracking/claude-progress.txt`

If the change alters requirements, design, or architecture, update the canonical source in the same effort.

## Minimum Review Standard

A plan is not ready for approval unless:
- the feature scope matches the canonical feature list
- dependencies are acknowledged
- file touch points are explicit
- risky data/auth/access/infrastructure changes are called out
- acceptance criteria map back to the feature registry and PRD
- UI work references the design system directly

## Template

```md
# Plan: <FEATURE ID> - <Feature Name>

Status: Draft
Feature: <FEATURE ID>
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

## Objective

## Scope And Non-Goals

## Approach

## Files To Create Or Modify

## Rollout / Migration / Access Impact

## Implementation Steps
1.
2.
3.

## Acceptance Criteria Mapping

## Style Guardrails For UI Work

## Risks Or Blockers

## Validation Plan

## Documentation Updates
```
