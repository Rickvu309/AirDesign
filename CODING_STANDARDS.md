# Coding standards

Apply these rules to every app and package in this monorepo and to research tools. Root lint and build checks do not exist yet.

## Code

### Keep the planned boundaries

- Follow [monorepo-map.md](docs/planning/v0.1/content/monorepo-map.md) for ownership and runtimes. Apps import packages; packages never import apps. Feature modules import core, never each other. `apps/site` imports only `ui` and `guides` packages.
- Keep `packages/deck` dependency-free, plain JSON and pure operations, without DOM or Node APIs. Parse external data once, at its adapter, and keep business rules in packages. Read untrusted uploads in the worker with the planned file limits.
- Route Studio, Aira and MCP through the same core operations. Use the shared renderer for Studio and capture. Keep prototypes and design generators out of production imports.

### Keep implementation lean

- Keep state local and derive values instead of synchronizing copies.
- Extend the owning module before adding a package or abstraction. Remove pass-through wrappers and dead code. When replacing an internal API, migrate its callers and delete it in the same change.

### Enforce the rules

The lint-on-issue, file path, comment and type rules live in [AGENTS.md](AGENTS.md#rules-for-all-code).

- Enforce package boundaries with repository-wide lint and shared type invariants with compiler checks. Add checks with implementation; documentation alone is not enforcement.
- Test public behavior through module interfaces. Use the test layer defined in the monorepo map; prove shared RPC and MCP behavior with the same scenarios.

## Planning, design and research

- Edit the authoritative v0.1 source, reached through the [planning](docs/planning/v0.1/README.md) or [design](docs/design/v0.1/README.md) index. Use the design folder's keyed copy and backlog. Name conflicts and follow the later recorded decision.
- Keep research results within their README's stated limits. Run checks from the research folder. Verify changed Markdown links and run `git diff --check`. Sequence implementation within [the nine-PR plan](docs/planning/v0.1/delivery/autopilot-plan.md).

## Agent instructions

- Keep `AGENTS.md` as a task router. Put the task condition before each link and load only the relevant material.
- Remove no-op instructions, duplicate rules and facts available through a direct repository lookup. Keep each rule in one authoritative place.
