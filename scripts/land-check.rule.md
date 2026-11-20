# A commit whose test failed is not pushed; a failed test is load only when it passes alone

`pnpm gate` and `pnpm check` withhold the stamp if step `unit-tests` fails. `pnpm land` stamps after the alone rerun (`scripts/land-check.mjs`)
