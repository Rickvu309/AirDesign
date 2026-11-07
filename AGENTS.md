# AirDesign

AirDesign makes logical, consulting-quality decks for executives. Start from an idea or a PowerPoint, build with an agent, and export to PowerPoint with no loss.

## Rules for all code

- When an agent finds an issue in code, the fixing agent adds or extends a lint rule against it in the same change. Show that the rule rejects the original mistake and accepts the fix. If lint cannot catch it, add a behavior test.
- Put context into file paths: domain, feature and responsibility. Prefer `deck/export/export-status.tsx` over `utils.ts`.
- Comments are banned by a lint rule, suppression comments included. If code needs explaining, the fix is a better name or a test.
- Make illegal states unrepresentable with types: discriminated unions, distinct identifier types and exhaustive handling. Share invariant types across packages so the compiler enforces global rules across the codebase.

## Read for your task

- Screen, style, font or copy changes: [verify-design](.agents/skills/verify-design/SKILL.md).
- Any change: the matching section of [CODING_STANDARDS.md](CODING_STANDARDS.md).
- PR body: the `/pr` skill.
- v0.1 delivery order: [the nine-PR plan](docs/planning/v0.1/delivery/autopilot-plan.md).
- Import, export, sync, undo, agent tools or quality gates: [engine-constraints.md](docs/planning/v0.1/content/engine-constraints.md).
- Where an app, package or module goes: [monorepo-map.md](docs/planning/v0.1/content/monorepo-map.md).
- Build order, slide drawing or journeys: [the planning index](docs/planning/v0.1/README.md).
- Screens, visuals or copy: [the design index](docs/design/v0.1/README.md).
- After every deployment: run [verify-live](.agents/skills/verify-live/SKILL.md) against the expected deployed commit.
