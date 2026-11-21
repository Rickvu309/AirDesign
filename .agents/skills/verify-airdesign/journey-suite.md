# Journey suite

Run the shipped journeys from the repo root.

```sh
pnpm test:journeys
```

The command builds `@airdesign/api` and `apps/web` once. Playwright's global setup launches a stack with `$V launch --no-build` and teardown stops it. Each journey in `tests/journeys/journeys.spec.ts` signs in to its own account. Evidence lands under `~/tmp/verify-airdesign/<run>/`.

Journeys run in parallel. Put a journey that calls `kit.aira()` in the `recorded Aira` group, which runs serially because the stack has one queue of recorded model streams. Tests never retry. Mark a known failure with `test.fail()` in the spec and remove the mark with the fix.

CI runs the journeys job on a pull request that affects journeys. It selects named journeys when the change map can name them and splits the full suite across two shards otherwise. See [COMMANDS.md](../../../COMMANDS.md) for the checks CI runs.
