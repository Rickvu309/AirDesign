# A committed `.only` fails ci instead of silently skipping every other test

`vitest.config.mts` sets `allowOnly: !process.env.CI` and `playwright.config.ts` sets `forbidOnly` from `onCi(process.env)`, so a `.only` that reaches ci fails the run, while a local run may still focus one test. `scripts/forbid-only.test.mjs` loads both configs with `CI` set and unset and fails when either setting is dropped
