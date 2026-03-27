# RosterServe Design System

Status: Canonical
Last normalized: 2026-03-27
Applies to: PRD writing, feature planning, implementation plans, implementation, UI review, and code review

## 1. Purpose

This document governs the product's visual language, interaction behavior, component patterns, content tone, and naming system.

All future product planning and UI work must follow this document. If a plan, prompt, mockup, or implementation conflicts with this document, this document wins unless a higher-authority source is updated first.

## 2. Source Of Truth

Primary source:
- `VisionDocument_ChurchRosterApp.md` defines the product audience, emotional direction, responsive posture, and the required split between volunteer warmth and leader clarity.

Secondary source:
- `docs/RosteringSystem_Design_Style_Guide.md` provides useful system mechanics such as type layering, spacing discipline, border-driven surfaces, and restrained motion.

Current implementation authority:
- None. There is no live UI in the repo yet, so no implementation outranks the documents.

Conflict rules:
- The vision overrides the style guide on product personality, audience fit, and voice.
- This canonical design-system document overrides the raw style guide after normalization.
- The raw style guide's GOODWAVE/GWAVE branding, enterprise-infrastructure voice, pure-void palette, and anti-playful posture are not canonical for RosterServe.

Explicit vs inferred:
- Explicit rules are directly supported by the vision or raw guide.
- Inferred rules are included only where the source material was incomplete or contradictory and a practical canonical rule was needed to reduce drift.

## 3. Visual Direction

Explicit:
- Volunteer-facing experiences must feel warm, friendly, approachable, and encouraging.
- Leader-facing experiences must feel calm, professional, data-rich, and structured.
- The product must work on mobile and desktop.
- Leader surfaces can borrow the clarity and color-coded structure of Monday.com-style dashboards.

Inferred normalization:
- RosterServe uses one shared design language with two role expressions, not two separate brands.
- The shared foundation is clean, structured, modern, and high-clarity.
- Volunteer surfaces should be slightly softer, more spacious, and more welcoming.
- Leader surfaces should be denser, more operational, and more grid-aligned.
- The product should feel trustworthy and organized, not cold, intimidating, or aggressively industrial.

Avoid:
- A fully black, neon, infrastructure-brand aesthetic across the whole product.
- Cute or childish UI.
- Generic default SaaS styling with no role distinction.

## 4. Color System

Source note:
- The raw guide provides a precise palette, but it is tied to a different brand and tone. The token structure is useful; the exact GOODWAVE color identity is not canonical.

Inferred canonical palette:

| Token | Value | Use |
|---|---|---|
| `color.brand.warm.500` | `#F2C14E` | Volunteer emphasis, welcome moments, primary highlights |
| `color.brand.calm.600` | `#2F6FED` | Leader actions, selected nav, links, operational emphasis |
| `color.brand.support.500` | `#1FA39A` | Shared support accents, positive guidance, secondary highlights |
| `color.neutral.950` | `#1F2533` | Primary text and deepest UI chrome |
| `color.neutral.800` | `#384256` | Secondary text and strong outlines |
| `color.neutral.600` | `#667089` | Muted text, icons, metadata |
| `color.neutral.300` | `#D8DDE7` | Borders, dividers, disabled states |
| `color.neutral.100` | `#F5F7FA` | App canvas and soft section backgrounds |
| `color.neutral.0` | `#FFFFFF` | Cards, forms, overlays |
| `color.surface.warm` | `#FFF8E8` | Volunteer-tinted backgrounds and welcome surfaces |
| `color.surface.cool` | `#F3F7FF` | Leader-tinted surfaces and dashboard zones |
| `color.semantic.success` | `#229A5A` | Success states |
| `color.semantic.warning` | `#C98900` | Warning states |
| `color.semantic.error` | `#D64545` | Destructive and error states |
| `color.semantic.info` | `#2F6FED` | Informational states |

Usage rules:
- Neutrals carry the interface; accents are for action, status, and emphasis.
- Warm accents belong primarily on volunteer-facing flows and encouragement moments.
- Calm blue accents belong primarily on leader dashboards, navigation, and structured actions.
- Support teal can appear in either mode for shared utility states.
- Do not use saturated accent colors for large full-screen backgrounds.
- Do not use bright accent colors for body text.
- Semantic colors must keep the same meaning across volunteer and leader surfaces.

## 5. Typography System

Explicit:
- The raw guide's font pairing is strong and reusable.

Canonical families:
- Display and headings: `Space Grotesk`, fallback `system-ui, sans-serif`
- Body and UI: `DM Sans`, fallback `sans-serif`
- Data, status, metadata: `JetBrains Mono`, fallback `monospace`

Canonical hierarchy:

| Style | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| `type.display` | 56-64px | 700 | 0.95 | Marketing hero or major onboarding moments only |
| `type.h1` | 40-48px | 600 | 1.0 | Page titles and key dashboard headings |
| `type.h2` | 28-32px | 600 | 1.1 | Section headings |
| `type.h3` | 20-24px | 600 | 1.2 | Card and module headings |
| `type.body` | 16px | 400 | 1.6 | Default body copy |
| `type.body-sm` | 14px | 400 | 1.5 | Secondary UI text |
| `type.label` | 12px | 600 | 1.2 | Field labels, chips, metadata |
| `type.mono` | 11-12px | 700 | 1.1 | Status tags, timestamps, counts, audit labels |

Rules:
- Use Space Grotesk sparingly and intentionally. It should not dominate dense app screens.
- Use DM Sans for most reading and interaction surfaces.
- Use JetBrains Mono only for data-like content, compact labels, and status language.
- Default body copy stays sentence case.
- Uppercase is reserved for tiny mono labels, tags, and metadata accents.

## 6. Spacing And Layout Rules

Explicit:
- Base spacing follows an 8px grid.
- The raw guide's wide-section spacing discipline is useful.
- The product is responsive across mobile and desktop.

Canonical spacing tokens:
- `space.100 = 8px`
- `space.200 = 16px`
- `space.300 = 24px`
- `space.400 = 32px`
- `space.500 = 48px`
- `space.700 = 96px`
- `space.900 = 160px`

Layout rules:
- Use mobile-first layouts.
- Volunteer screens should prefer simple single-column flows on mobile and tablet.
- Leader screens may expand into multi-panel dashboards from `1024px` upward.
- Max content width is `1600px`, but standard working widths should usually stay between `1120px` and `1440px`.
- Large page sections should use `space.500` to `space.700`; only hero-level sections should reach `space.900`.
- Compact data clusters may use `space.100` or `space.200`.

Responsive posture:
- Mobile: 320px and up
- Tablet: 768px and up
- Desktop: 1024px and up
- Ultra-wide: 1600px and up

## 7. Surfaces And Elevation

Explicit:
- The raw guide is right to prefer border-driven structure over heavy fuzzy shadows.

Canonical surface rules:
- Default app canvas uses `color.neutral.100`.
- Default surface uses `color.neutral.0`.
- Tinted sections may use `color.surface.warm` or `color.surface.cool` depending on context.
- Standard borders use `1px solid color.neutral.300`.
- Shadows are minimal and reserved for overlays, sticky bars, and modals.

Canonical radius tokens:
- `radius.0 = 0px` for data tables and very structural panels
- `radius.200 = 8px` for inputs, cards, and basic controls
- `radius.300 = 12px` for larger panels and feature cards
- `radius.pill = 9999px` for badges and selective high-emphasis CTA treatments

Avoid:
- Full-app glassmorphism
- Heavy blur
- Large soft shadow stacks
- Neon glows as a default style

## 8. Component Behavior And Patterns

Buttons:
- Primary buttons use the role-appropriate accent token, sentence-case labels, and medium visual weight.
- Secondary buttons use neutral surfaces with a border.
- Tertiary buttons use text or ghost treatment for low-emphasis actions.
- Pill-shaped CTAs are reserved for welcome or promotional moments, not dense dashboard tables.

Inputs and forms:
- Labels sit above fields and remain visible.
- Use full-border inputs with clear focus treatment, not bottom-border-only styling.
- Validation should appear inline and near the field.
- Destructive confirmations must use explicit confirmation modals as required by the vision.

Navigation:
- Leader desktop flows may use a sidebar plus local filters/tabs.
- Volunteer flows should keep navigation lighter, with clear upcoming-service focus.
- Active state treatment must be visible without relying on color alone.

Cards and panels:
- Assignment cards, instruction cards, and dashboard summary cards should share spacing, border, and radius rules.
- Volunteer cards may use warmer surface tints and friendlier empty-state copy.
- Leader cards should prioritize hierarchy, scannability, status, and density control.

Tables and dense data:
- Use tables for leader/admin workflows, not as the default volunteer experience.
- Sticky headers, row status chips, and clear column alignment are preferred.
- Use `radius.0` or `radius.200` depending on whether the table is embedded in a panel.

Modals and drawers:
- Use modals for confirmation, approval, decline, and delete flows.
- Use drawers or side panels for secondary detail editing when they preserve context better than a modal.

Loading and empty states:
- Prefer skeletons, thin progress bars, or inline progress labels.
- Avoid decorative spinners as the primary loading language.
- Empty states should be calm and helpful, never jokey or infantilized.

Core product patterns that future plans must treat consistently:
- Volunteer onboarding
- Weekly dashboard
- Assignment accept/decline
- Interest request submission and review
- Skill approval
- Leader roster building
- Soft-delete approval flows

## 9. Motion And Interaction

Explicit:
- Motion should be quick, controlled, and should avoid layout thrash.

Canonical motion tokens:
- `motion.duration.fast = 150ms`
- `motion.duration.base = 250ms`
- `motion.duration.slow = 400ms`
- `motion.duration.macro = 800ms` for page-introduction moments only
- `motion.ease.standard = cubic-bezier(0.16, 1, 0.3, 1)`

Rules:
- Animate opacity, transform, color, and shadow intensity only when necessary.
- Keep hover feedback immediate and readable.
- Focus states must be visible and not replaced by hover-only styling.
- Do not animate large structural reflows or dashboard layout jumps.
- Do not use floaty, bouncy, playful motion.

## 10. Content And UI Tone

Explicit:
- Volunteer tone should be warm and encouraging.
- Leader tone should be calm and professional.

Canonical tone rules:
- Use plain English and sentence case.
- Button labels should start with clear verbs: `Accept assignment`, `Save changes`, `Request to serve`.
- Volunteer copy may sound supportive and welcoming.
- Leader copy should be concise, direct, and operational.
- Error messages should be human, calm, and actionable.

Avoid:
- Cold enterprise jargon like `Node unreachable` in normal product UI.
- Cutesy startup language like `Oops`, `magic`, or `super easy`.
- Marketing hype inside operational screens.

## 11. Naming Convention

Token naming:
- Use dot notation by category and scale, for example `color.neutral.300`, `color.role.leader.primary`, `space.300`, `radius.200`, `motion.duration.fast`.
- Prefer foundation tokens first, then semantic or role aliases.
- Do not create one-off tokens for individual screens.

Component naming:
- Use PascalCase for reusable components.
- Use role/context prefixes only when behavior differs materially, for example `LeaderDashboardNav` or `VolunteerScheduleCard`.
- Prefer durable nouns over stylistic names, for example `AssignmentCard` instead of `GlowTile`.

Pattern naming:
- Use descriptive kebab-case for documented UI patterns, for example `weekly-dashboard`, `assignment-confirmation`, `skill-approval-flow`.
- Pattern names should describe user intent, not visual style.

Motion naming:
- Use intent-based names such as `enter`, `exit`, `emphasize`, `progress`, `focus`.

## 12. Implementation Guardrails

Future agents must preserve:
- The dual-audience posture: warm volunteer surfaces and calm leader surfaces within one shared system.
- The typography stack and disciplined token structure.
- Border-first surfaces, restrained shadows, and clear state communication.
- Consistent meaning for semantic colors and status patterns.

Design drift includes:
- Applying the GOODWAVE industrial brand language directly to RosterServe.
- Making the whole product feel cold, black, neon, or hostile.
- Using raw framework defaults with no project-specific token mapping.
- Introducing extra font families, arbitrary radii, or new shadow systems without approval.
- Making volunteer and leader experiences feel like unrelated products.

Acceptable extension includes:
- Adding new component variants that map cleanly to the existing token system.
- Adding role-specific accents only when they preserve the shared foundation.
- Extending pattern documentation when a new workflow appears in an approved plan.

Do not improvise:
- A new brand direction
- A second design language for a single feature
- Novel animation styles that conflict with the established motion rules
- New status colors with competing meanings
