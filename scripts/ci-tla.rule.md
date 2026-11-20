# A ci job that replays the TLA+ specs gets the TLA+ tools from the one action before it runs them

`scripts/ci-tla.test.mjs` finds each job in `.github/workflows` that runs `pnpm check --part` or the mutation check, and fails when the job has no `./.github/actions/tla` step before it, when a workflow downloads the jar itself, or when the action's cache key or hash differs from the jar `scripts/check-specs.mjs` accepts
