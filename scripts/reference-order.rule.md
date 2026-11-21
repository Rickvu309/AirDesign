# No hand-kept list of what a folder holds: `pnpm typecheck` reads `apps/` and `packages/`, `pnpm test:tooling` reads `scripts/`, and the spec replay reads `specs/`

the `tsconfig-references` step of `pnpm check` fails when the root `tsconfig.json` lists references

the same step fails when a project that `tsc -b` builds depends on a workspace package none of its tsconfig references reach, so a fresh checkout builds every package the project imports
