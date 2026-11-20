# No hand-kept list of what a folder holds: `pnpm typecheck` reads `apps/` and `packages/`, `pnpm test:tooling` reads `scripts/`, and the spec replay reads `specs/`

the `tsconfig-references` step of `pnpm check` fails when the root `tsconfig.json` lists references
