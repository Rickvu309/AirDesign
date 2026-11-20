# Unit tests run with nothing built: a test reads sources, never a package's `dist`

`scripts/source-only.mjs` makes vitest refuse to load any `apps/*/dist` or `packages/*/dist` file, so a test reading built output fails even after a build. `scripts/source-only.test.mjs` fails when a vitest project drops it. `pnpm check` runs `typecheck`, then `build` and `site-build`, because all write `dist`
